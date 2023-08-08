import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ResourcesStack } from './resources';
import { DistributedMapStack } from './dmap';

export interface ServerlessDataProcessingStackProps extends cdk.StackProps {
    // Name of the DynamoDB table to create
    tableName: string;

    // Name of the existing S3 bucket to read from
    s3BucketName: string;
}

export class ServerlessDataProcessingStack extends cdk.Stack {
    constructor(
        scope: Construct,
        id: string,
        props: ServerlessDataProcessingStackProps
    ) {
        super(scope, id, props);

        const resources = new ResourcesStack(this, 'ResourcesStack', {
            tableName: props.tableName,
            dataBucketName: props.s3BucketName,
        });

        new DistributedMapStack(this, 'DistributedMapStack', {
            dataBucket: resources.getDataBucket(),
            labelLambda: resources.getLabelLambda(),
            recordLambda: resources.getRecordLambda(),
            executionOutputBucket: resources.getExecutionOutputBucket(),
            table: resources.getTable(),
            mapProps: {
                maxConcurrency: 1000,
                toleratedFailurePercentage: 5,
            },
        });
    }
}
