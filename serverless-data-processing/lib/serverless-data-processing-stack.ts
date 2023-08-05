import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface ServerlessDataProcessingStackProps extends cdk.StackProps {
  // Name of the DynamoDB table to create
  tableName: string;

  // Name of the existing S3 bucket to read from
  s3BucketName: string;
}

export class ServerlessDataProcessingStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: ServerlessDataProcessingStackProps) {
    super(scope, id, props);

    // Define an existing S3 bucket
    const bucket = s3.Bucket.fromBucketName(this, 'Bucket', props.s3BucketName);

    // Define a new DynamoDB table
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      tableName: props.tableName
    });

    // Define a new Lambda function  
    const labelFunction = new lambda.Function(this, 'RekognitionHandler', {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'rekognition.lambda_handler',
      environment: {
        'BUCKET_NAME': bucket.bucketName
      }
    }); 

    // Grant the lambda function permissions to invoke the Rekognition 
    labelFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['rekognition:*'],
      resources: ['*']
    }));

    // Grant the lambda function permissions to invoke the S3 bucket
    labelFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['s3:*'],
      resources: [
        `arn:aws:s3:::${bucket.bucketName}`,
        `arn:aws:s3:::${bucket.bucketName}/*`
      ]
    }));

    // Define a new Lambda function  
    const recordFunction = new lambda.Function(this, 'DynamoDBHandler', {
      runtime: lambda.Runtime.PYTHON_3_10,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'ddb.lambda_handler',
      environment: {
        'TABLE_NAME': props.tableName,
      }
    }); 

    // Grant the Lambda function permissions to write to the DynamoDB table
    recordFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['dynamodb:*'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${table.tableName}`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${table.tableName}/index/*`
      ]
    }));
  }
}
