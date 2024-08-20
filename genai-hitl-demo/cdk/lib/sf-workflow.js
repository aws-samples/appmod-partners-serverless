const cdk = require('aws-cdk-lib');
const iam = require('aws-cdk-lib/aws-iam');
const lambda = require('aws-cdk-lib/aws-lambda');
const s3 = require('aws-cdk-lib/aws-s3');
const assets = require('aws-cdk-lib/aws-s3-assets');

const stepfunctions = require('aws-cdk-lib/aws-stepfunctions');

const TranscriptionJob = 'ServerlessVideoGenerativeAI';

class StepFunctionsWorkflowStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const corsRule = {
            allowedMethods: [s3.HttpMethods.GET],
            allowedOrigins: ['allowedOrigins'],
            allowedHeaders: ['allowedHeaders'],
            exposedHeaders: ['exposedHeaders'],
            id: 'id',
            maxAge: 123
        };

        const bucket = new s3.Bucket(this, `GenAiHitlDemoVideoBucket`, {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: true,
            removalPolicy:  cdk.RemovalPolicy.DESTROY,
            cors: [corsRule]
        });

        const SendResponseLambdaRole = new iam.Role(this, 'SendResponseLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            roleName: `SendResponseLambdaRole_${this.stackName}`
        });

        SendResponseLambdaRole.attachInlinePolicy(
            new iam.Policy(this, 'SendResponseInlinePolicy', {
                statements: [
                    new iam.PolicyStatement({
                        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                        resources: ['*']
                    }),
                    new iam.PolicyStatement({
                        actions: ['s3:getObject'],
                        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`]
                    }),
                    new iam.PolicyStatement({
                        actions: ['iot:DescribeEndpoint', 'iot:Publish'],
                        resources: ['*']
                    })
                ]
            })
        );

        const sendResponseLambda = new lambda.Function(this, 'send-response', {
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: 'lambda_function.lambda_handler',
            code: lambda.Code.fromAsset('./src/send-response'),
            functionName: `send-response-${this.stackName}`,
            timeout: cdk.Duration.seconds(20),
            role: SendResponseLambdaRole,
            memorySize: 256
        });

        const StateMachineRole = new iam.Role(this, 'StateMachineRole', {
            assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
            roleName: `StateMachineRole_${this.stackName}`
        });

        StateMachineRole.attachInlinePolicy(
            new iam.Policy(this, 'StateMachineRoleInlinePolicy', {
                statements: [
                    new iam.PolicyStatement({
                        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                        resources: ['*']
                    }),
                    new iam.PolicyStatement({
                        actions: ['Bedrock:InvokeModel'],
                        resources: [
                            `arn:aws:bedrock:${this.region}::foundation-model/anthropic.*`,
                            `arn:aws:bedrock:${this.region}::foundation-model/anthropic.*`,
                            `arn:aws:bedrock:${this.region}::foundation-model/stability.*`
                        ]
                    }),
                    new iam.PolicyStatement({
                        actions: ['lambda:invokeFunction'],
                        resources: [sendResponseLambda.functionArn]
                    }),
                    new iam.PolicyStatement({
                        actions: ['s3:getObject*', 's3:putObject', 's3:ListBucket'],
                        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`]
                    }),
                    new iam.PolicyStatement({
                        actions: ['Transcribe:startTranscriptionJob', 'Transcribe:getTranscriptionJob'],
                        resources: [`arn:aws:transcribe:${this.region}:${this.account}:transcription-job/${TranscriptionJob}*`]
                    })
                ]
            })
        );

        const workflow = new stepfunctions.StateMachine(this, 'serverlessVideoGenerativeAI', {
            definitionBody: stepfunctions.DefinitionBody.fromFile('./src/workflow.asl.json'),
            definitionSubstitutions: {
                TranscriptionJob: TranscriptionJob,
                send_response_lambda: sendResponseLambda.functionArn,
                bucket: bucket.bucketName,
                key: 'bezos-vogels.mp4',
                region: this.region
            },
            role: StateMachineRole
        });

        new cdk.CfnOutput(this, 'VideoBucketOutput', {
            exportName: 'genai-hitl-video-bucket',
            value: bucket.bucketName
        });

        this.workflow = workflow;
    }
}

module.exports = { StepFunctionsWorkflowStack };