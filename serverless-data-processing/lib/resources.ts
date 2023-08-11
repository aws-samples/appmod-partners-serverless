import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface ResourcesStackProps extends cdk.NestedStackProps {
    // Name of the DynamoDB table to create
    tableName: string;

    // Name of the existing S3 bucket to read from
    dataBucketName: string;

    // Maximum number of items to process in a batch
    maxItems: number;
}

export class ResourcesStack extends cdk.NestedStack {
    private labelLambda: lambda.Function;
    private recordLambda: lambda.Function;
    private dataBucket: s3.IBucket;
    private executionOutputBucket: s3.Bucket;
    private table: dynamodb.Table;

    constructor(scope: Construct, id: string, props: ResourcesStackProps) {
        super(scope, id, props);

        // Define an existing S3 bucket
        this.dataBucket = s3.Bucket.fromBucketName(
            this,
            'Bucket',
            props.dataBucketName
        );

        // Create a new S3 bucket for collecting State Machine output
        this.executionOutputBucket = new s3.Bucket(
            this,
            'ExecutionOutputBucket',
            {
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            }
        );

        // Define a new DynamoDB table
        this.table = new dynamodb.Table(this, 'Table', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
            tableName: props.tableName,
            writeCapacity: 300 * props.maxItems,
        });

        // Define a new Lambda function
        this.labelLambda = new lambda.Function(this, 'RekognitionHandler', {
            runtime: lambda.Runtime.PYTHON_3_10,
            code: lambda.Code.fromAsset('lambda'),
            handler: 'rekognition.lambda_handler',
            memorySize: 1024,
            timeout: cdk.Duration.seconds(5 * props.maxItems),
            environment: {
                BUCKET_NAME: this.dataBucket.bucketName,
            },
        });

        // Grant the lambda function permissions to invoke the Rekognition
        this.labelLambda.addToRolePolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: ['rekognition:*'],
                resources: ['*'],
            })
        );

        // Grant the lambda function permissions to invoke the S3 bucket
        this.labelLambda.addToRolePolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: ['s3:*'],
                resources: [
                    `arn:aws:s3:::${this.dataBucket.bucketName}`,
                    `arn:aws:s3:::${this.dataBucket.bucketName}/*`,
                ],
            })
        );

        // Define a new Lambda function
        this.recordLambda = new lambda.Function(this, 'DynamoDBHandler', {
            runtime: lambda.Runtime.PYTHON_3_10,
            code: lambda.Code.fromAsset('lambda'),
            handler: 'ddb.lambda_handler',
            memorySize: 256,
            timeout: cdk.Duration.seconds(5 * props.maxItems),
            environment: {
                TABLE_NAME: props.tableName,
            },
        });

        // Grant the Lambda function permissions to write to the DynamoDB table
        this.recordLambda.addToRolePolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: ['dynamodb:*'],
                resources: [
                    `arn:aws:dynamodb:${this.region}:${this.account}:table/${this.table.tableName}`,
                    `arn:aws:dynamodb:${this.region}:${this.account}:table/${this.table.tableName}/index/*`,
                ],
            })
        );
    }

    getLabelLambda(): lambda.Function {
        return this.labelLambda;
    }

    getRecordLambda(): lambda.Function {
        return this.recordLambda;
    }

    getDataBucket(): s3.IBucket {
        return this.dataBucket;
    }

    getExecutionOutputBucket(): s3.Bucket {
        return this.executionOutputBucket;
    }

    getTable(): dynamodb.Table {
        return this.table;
    }
}
