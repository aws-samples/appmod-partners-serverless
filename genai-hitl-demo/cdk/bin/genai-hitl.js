#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const {ApigwSqsLambdaStack} = require('../lib/apigw-sqs-lambda-stack');
const {IoTStack} = require('../lib/iot-stack');
const {StepFunctionsWorkflowStack} = require('../lib/sf-workflow');

const app = new cdk.App();
const ioStack = new IoTStack(app, 'IoTStack', {});
const sfStack = new StepFunctionsWorkflowStack(app, 'StepFunctionsStack', {});
const apigwSqsLambdaStack = new ApigwSqsLambdaStack(app, 'ApigwSqsLambdaStack', {
    sfWorkflow: sfStack.workflow
});

