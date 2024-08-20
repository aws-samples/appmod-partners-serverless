const cdk = require('aws-cdk-lib');
const sqs = require('aws-cdk-lib/aws-sqs');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');
const lambda = require('aws-cdk-lib/aws-lambda');
const eventsources = require('aws-cdk-lib/aws-lambda-event-sources');

const { Duration } = require('aws-cdk-lib');
const { exec } = require('child_process');

class ApigwSqsLambdaStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        // Get config values from cdk.out.context
        const params = this.node.tryGetContext('params');
        const SQS_ESM_CONCURRENCY = params.SQS_ESM_CONCURRENCY;

        const deadLetterQueue = new sqs.Queue(this, 'genai-hitl-request-dlq', {
            queueName: `genai-dlq-${this.stackName}`,
            encryption: sqs.QueueEncryption.KMS_MANAGED,
            retentionPeriod: Duration.days(14),
        });

        // Create a SQS queue for storing message that APIGateway will receive.
        const sqsQueue = new sqs.Queue(this, 'genai-hitl-request-queue', {
            queueName: `genai-hitl-request-queue-${this.stackName}`,
            encryption: sqs.QueueEncryption.KMS_MANAGED,
            deadLetterQueue: {
                maxReceiveCount: 3,
                queue: deadLetterQueue,
            },
            visibilityTimeout: Duration.seconds(120),
        });

        // Create an inline Policy document that grants permission to access SQS queue
        const sqsInlinePolicy = new iam.PolicyStatement({
            actions: ['sqs:SendMessage'],
            resources: [sqsQueue.queueArn],
        });
        const statesInlinePolicy = new iam.PolicyStatement({
            actions: ['states:SendTaskSuccess'],
            resources: ['*'],
        });

        // Create an IAM apigateway execution role.
        const apigwRole = new iam.Role(this, `apigw_role_${this.stackName}`, {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('apigateway.amazonaws.com'),
                new iam.ServicePrincipal('lambda.amazonaws.com')
            ),
            description: 'This is the role for apigateway to access SQS queue.',
        });

        apigwRole.attachInlinePolicy(
            new iam.Policy(this, 'apigwPolicy', {
                statements: [sqsInlinePolicy, statesInlinePolicy],
            })
        );

        const defaultIntegrationResponse = {
            statusCode: '200',
            responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': "'*'"
            }
        };

        // Create new Integration Options that can for adding request parameters and templates.
        const sqsIntegrationOptions = {
            credentialsRole: apigwRole,
            requestParameters: {
                'integration.request.header.Content-Type': "'application/x-www-form-urlencoded'",
            },
            passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
            requestTemplates: {
                'application/json': 'Action=SendMessage&MessageBody=$input.body',
            },
            integrationResponses: [ defaultIntegrationResponse ]
        };

        const sfnIntegrationOptions = {
            credentialsRole: apigwRole,
            requestParameters: {
                'integration.request.header.Content-Type': "'application/json'",
            },
            passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
            integrationResponses: [ defaultIntegrationResponse ]
        };

        // Create new apigateway rest api.
        const api = new apigateway.RestApi(this, 'genai-hitl-api', {
            description: 'This is genAI serverless API',
            endpointTypes: [apigateway.EndpointType.REGIONAL],
            defaultCorsPreflightOptions: {
                allowOrigins: '*'
            }
        });

        const defaultMethodResponse = {
            statusCode: '200',
            responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
            }
        };

        // Create a apigateway resource method with authorizer needed
        const invokeResource = api.root.addResource('invokeModel');
        invokeResource.addMethod('POST', new apigateway.AwsIntegration({
            region: this.region,
            service: 'sqs',
            integrationHttpMethod: 'POST',
            path: sqsQueue.queueName,
            options: sqsIntegrationOptions,
        }), {
            methodResponses: [ defaultMethodResponse ],
            authorizationType: apigateway.AuthorizationType.NONE,
        });

        // invokeResource.addMethod('OPTIONS', new apigateway.MockIntegration({
        //     integrationResponses: [{
        //         statusCode: '200',
        //         responseParameters: {
        //             'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        //             'method.response.header.Access-Control-Allow-Origin': "'*'",
        //             'method.response.header.Access-Control-Allow-Credentials': "'false'",
        //             'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
        //         },
        //     }],
        //     passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        //     requestTemplates: {
        //         'application/json': '{"statusCode": 200}',
        //     },
        // }), {
        //     methodResponses: [
        //         {
        //             statusCode: '200',
        //             responseParameters: {
        //                 'method.response.header.Access-Control-Allow-Headers': true,
        //                 'method.response.header.Access-Control-Allow-Methods': true,
        //                 'method.response.header.Access-Control-Allow-Credentials': true,
        //                 'method.response.header.Access-Control-Allow-Origin': true,
        //             },
        //         },
        //     ],
        //     authorizationType: apigateway.AuthorizationType.NONE,
        // });

        const feedbackResource = api.root.addResource('feedback');
        feedbackResource.addMethod('POST', new apigateway.AwsIntegration({
            region: this.region,
            service: 'states',
            integrationHttpMethod: 'POST',
            action: 'SendTaskSuccess',
            options: sfnIntegrationOptions,
        }), {
            methodResponses: [ defaultMethodResponse ],
            authorizationType: apigateway.AuthorizationType.NONE,
        });

        // feedbackResource.addMethod('OPTIONS', new apigateway.MockIntegration({
        //     integrationResponses: [{
        //         statusCode: '200',
        //         responseParameters: {
        //             'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        //             'method.response.header.Access-Control-Allow-Origin': "'*'",
        //             'method.response.header.Access-Control-Allow-Credentials': "'false'",
        //             'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
        //         },
        //     }],
        //     passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        //     requestTemplates: {
        //         'application/json': '{"statusCode": 200}',
        //     },
        // }), {
        //     methodResponses: [
        //         {
        //             statusCode: '200',
        //             responseParameters: {
        //                 'method.response.header.Access-Control-Allow-Headers': true,
        //                 'method.response.header.Access-Control-Allow-Methods': true,
        //                 'method.response.header.Access-Control-Allow-Credentials': true,
        //                 'method.response.header.Access-Control-Allow-Origin': true,
        //             },
        //         },
        //     ],
        //     authorizationType: apigateway.AuthorizationType.NONE,
        // });

        const sqsHandlerLambdaExecutionRole = new iam.Role(this, 'SqsHandlerLambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            roleName: `SqsHandlerLambdaExecutionRole_${this.stackName}`,
        });

        sqsHandlerLambdaExecutionRole.attachInlinePolicy(new iam.Policy(this, 'lambdaPolicy', {
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents',
                    ],
                    resources: ['*']
                }),
                new iam.PolicyStatement({
                    actions: [
                        'states:startExecution',
                        'states:sendTaskSuccess',
                        'states:sendTaskFailure',
                    ],
                    resources: [props.sfWorkflow.stateMachineArn]
                }),
                new iam.PolicyStatement({
                    actions: ['iot:DescribeEndpoint', 'iot:Publish'],
                    resources: ['*']
                }),
                new iam.PolicyStatement({
                    actions: [
                        'sqs:ReceiveMessage',
                        'sqs:DeleteMessage',
                        'sqs:GetQueueAttributes',
                    ],
                    resources: [sqsQueue.queueArn]
                }),
                new iam.PolicyStatement({
                    actions: [
                        'sqs:SendMessage',
                    ],
                    resources: [sqsQueue.queueArn]
                }),
            ]
        }));

        const fnSqsHandler = new lambda.Function(this, 'SqsHandlerFunction', {
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: 'lambda_function.lambda_handler',
            code: lambda.Code.fromAsset('./src/invoke-workflow'),
            role: sqsHandlerLambdaExecutionRole,
            functionName: `invoke-workflow-${this.stackName}`,
            timeout: Duration.seconds(10),
            environment: {
                STATE_ARN: props.sfWorkflow.stateMachineArn
            }
        });

        // Add SQS as event source to trigger Lambda
        fnSqsHandler.addEventSource(new eventsources.SqsEventSource(sqsQueue, { maxBatchingWindow: Duration.seconds(SQS_ESM_CONCURRENCY) }));

        new cdk.CfnOutput(this, 'ApiEndointOutput', {
            exportName: 'genai-hitl-api-endpoint',
            value: api.url
        });
    }

    createDependenciesLayer(projectName, functionName) {
        const requirementsFile = `./src/${functionName}/requirements.txt`;
        const outputDir = `./src/build/${functionName}/`;

        if (!process.env.SKIP_PIP) {
            exec(`pip3 install -r ${requirementsFile} -t ${outputDir}/python`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    return;
                }
                console.log(`stdout: ${stdout}`);
                console.error(`stderr: ${stderr}`);
            });
        }

        const layerId = `${projectName}-${functionName}-dependencies`;
        const layerCode = lambda.Code.fromAsset(outputDir);

        return new lambda.LayerVersion(this, layerId, {
            code: layerCode,
        });
    }
}

module.exports = {ApigwSqsLambdaStack};