# Serverless Data Processing
This project demonstrates an example pattern for data processing using Serverless compute and integration services.

Using [Step Functions Distributed Maps](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-asl-use-map-state-distributed.html), you can now process high number of images in an S3 bucket for any data processing in parallel. In this example, you will provide an S3 bucket with any number of images, and the workflow will 1/ call Rekognition API to detect labels in the image and then 2/ Process the response and record it as an item in a DynamoDB table.

## Reference Architecture
![Reference Architecture](images/serverless-data-processing-pattern.png)

# Requirement

1. AWS CDK
2. Python 3.10 (if you want to revise the Lambda functions)
3. An existing large scale S3 bucket (1000s of images, either in the main bucket or under a folder)

# Project Deployment

## Project Deployment
1. Clone the repository
    ```bash
    git clone https://github.com/aws-samples/appmod-partners-serverless
    ```
2. Access the directory
    ```bash
    cd serverless-data-processing
    ```
3. Export to the following variables in your terminal (If you do not set these, **the stack deploy will fail**.):
    - S3_BUCKET_NAME = Name of the S3 bucket which has your image files.
    - DYNAMODB_TABLE_NAME = Name of the DynamoDB table that will be created to record data.
    - MAX_ITEMS = Maximum number of items to run in a batch. Read more about batching [here](https://docs.aws.amazon.com/step-functions/latest/dg/input-output-itembatcher.html). For example:

    ```bash
    export S3_BUCKET_NAME='youngj-image-dataset-bucket'
    export DYNAMODB_TABLE_NAME='serverless-data-processing-table'
    export MAX_ITEMS=5
    ```
4. Run the CDK commands to deploy the resources:
    ```bash
    cdk synth
    cdk deploy ServerlessDataProcessingStack
    ```

5. One of the CloudFormation Output is called "DMapEventBusConsoleUrl". Access that website on your browser (it will be in the form of: "https://<your-region>.console.aws.amazon.com/events/home?region=<your-region>#/eventbus/<name-of-your-event-bus>")

6. Click "Send events" and provide the following:

Event source: 'serverless-data-processing'
Event Detail: (if your images are in the main S3 bucket, provide "" for the Prefix. Otherwise, provide the actual subfolder within the S3 bucket, i.e. "images" or "data/images") For example,

```json
{
    "myStateInput": {
        "Bucket": "youngj-image-dataset-bucket",
        "Prefix": "sample"    
    }
}
```

7. You will now be able to access the Distributed Map State Machine, by accessing the console URL from the CDK output called "DMapEventBusConsoleUrl". It will be in the form of: "https://<your-region>.console.aws.amazon.com/states/home?region=<your-region>#/eventbus/view/<arn-of-your-states-machine>"). Open the console to look at the execution in details.