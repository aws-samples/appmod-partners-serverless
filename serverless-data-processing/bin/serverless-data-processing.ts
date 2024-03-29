#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ServerlessDataProcessingStack } from '../lib/serverless-data-processing';

const app = new cdk.App();

new ServerlessDataProcessingStack(app, 'ServerlessDataProcessingStack', {
    s3BucketName: process.env.S3_BUCKET_NAME!,
    tableName: process.env.DYNAMODB_TABLE_NAME!,
    maxItems: process.env.MAX_ITEMS!,
});
