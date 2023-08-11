import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ResourcesStack } from './resources';
import { DistributedMapStack } from './dmap';
import { EventBridgeStack } from './eb';

export interface ServerlessDataProcessingStackProps extends cdk.StackProps {
    // Name of the DynamoDB table to create
    tableName: string;

    // Name of the existing S3 bucket to read from
    s3BucketName: string;

    // Maximum number of items to process in a batch (default: 1)
    // Only applicable if batch is enabled
    maxItems: string;
}

export class ServerlessDataProcessingStack extends cdk.Stack {
    constructor(
        scope: Construct,
        id: string,
        props: ServerlessDataProcessingStackProps
    ) {
        super(scope, id, props);

        const maxItems = parseInt(props.maxItems);
        const resources = new ResourcesStack(this, 'ResourcesStack', {
            tableName: props.tableName,
            dataBucketName: props.s3BucketName,
            maxItems: maxItems,
        });

        const distributedMap = new DistributedMapStack(
            this,
            'DistributedMapStack',
            {
                dataBucket: resources.getDataBucket(),
                labelLambda: resources.getLabelLambda(),
                recordLambda: resources.getRecordLambda(),
                executionOutputBucket: resources.getExecutionOutputBucket(),
                table: resources.getTable(),
                mapProps: {
                    maxConcurrency: 500,
                    toleratedFailurePercentage: 5,
                },
                maxItems: maxItems,
            }
        );

        const eventBridge = new EventBridgeStack(this, 'EventBridgeStack', {
            stateMachine: distributedMap.getStateMachine(),
        });

        const stateMachineArn =
            distributedMap.getStateMachine().stateMachineArn;

        const eventBridgeBus = eventBridge.getEventBus();

        new cdk.CfnOutput(this, 'DMapStateMachineArnOutput', {
            description: 'ARN of the State Machine',
            value: stateMachineArn,
        });

        new cdk.CfnOutput(this, 'DMapStateMachineConsoleUrl', {
            description: 'State Machine Console URL',
            value: `https://${process.env.CDK_DEFAULT_REGION}.console.aws.amazon.com/states/home?region=${process.env.CDK_DEFAULT_REGION}#/statemachines/view/${stateMachineArn}`,
        });

        new cdk.CfnOutput(this, 'DMapEventBusArnOutput', {
            description: 'ARN of the Event Bus',
            value: eventBridgeBus.eventBusArn,
        });

        new cdk.CfnOutput(this, 'DMapEventBusConsoleUrl', {
            description: 'EventBridge Event Bus Console URL',
            value: `https://${process.env.CDK_DEFAULT_REGION}.console.aws.amazon.com/events/home?region=${process.env.CDK_DEFAULT_REGION}#/eventbus/${eventBridgeBus.eventBusName}`,
        });
    }
}
