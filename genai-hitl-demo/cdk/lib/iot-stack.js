const cdk = require('aws-cdk-lib');
const iot = require('aws-cdk-lib/aws-iot');
const iam = require('aws-cdk-lib/aws-iam');
const lambda = require('aws-cdk-lib/aws-lambda');

class IoTStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const authHandlerLambdaExecutionRole = new iam.Role(this, 'AuthHandlerLambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            roleName: `IoTAuthHandlerLambdaExecutionRole_${this.stackName}`,
        });
        authHandlerLambdaExecutionRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
        );

        const fnIoTAuthorizer = new lambda.Function(this, 'GenAIAsyncResponseIoTAuthorizer', {
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: 'lambda_function.lambda_handler',
            code: lambda.Code.fromAsset('./src/iot-authorizer'),
            role: authHandlerLambdaExecutionRole,
            functionName: `async-response-iot-authorizer-${this.stackName}`,
            environment: {
                ACCOUNT_ID: this.account,
                REGION: this.region,
            },
        });

        const principal = new iam.ServicePrincipal('iot.amazonaws.com');
        fnIoTAuthorizer.grantInvoke(principal);

        const iotAuthorizer = new iot.CfnAuthorizer(this, 'iotAuthorizer', {
            authorizerName: 'genai-hitl-workflow-iot',
            authorizerFunctionArn: fnIoTAuthorizer.functionArn,
            signingDisabled: true,
            status: 'ACTIVE',
        });

        const getIoTEndpoint = new cdk.custom_resources.AwsCustomResource(this, 'IoTEndpoint', {
            onCreate: {
                service: 'Iot',
                action: 'describeEndpoint',
                physicalResourceId: cdk.custom_resources.PhysicalResourceId.fromResponse('endpointAddress'),
                parameters: {
                    "endpointType": "iot:Data-ATS"
                }
            },
            policy: cdk.custom_resources.AwsCustomResourcePolicy.fromSdkCalls({resources: cdk.custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE})
        });


        const iotEndpoint = getIoTEndpoint.getResponseField('endpointAddress')
        new cdk.CfnOutput(this, 'IotEndpointOutput', {
            exportName: 'genai-hitl-iot-endpoint',
            value: `wss://${iotEndpoint}`
        });
    }
}

module.exports = { IoTStack };