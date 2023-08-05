# Serverless Data Processing
This project demonstrates an example pattern for data processing using Serverless compute and integration services.

- **Books Application** is implemented with these features
  - Create Book: The Api Gateway receives the request with the authorization token and the new book information in the body, calls a lambda function, and maintains it in Amazon DynamoDB
  - Get Books: The Api Gateway triggers the AWS Lambda function and runs a query on the DynamoDB book table to get all books.

## Reference Architecture
![Reference Architecture](resources/api-gateway-demo.png)

# Requirement

https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-python.html

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
3. Export to the following variables in your terminal:
    S3_BUCKET_NAME = Name of the S3 bucket which has your image files.
    DYNAMODB_TABLE_NAME = Name of the DynamoDB table that will be created to record data.

    ```bash
    export S3_BUCKET_NAME='youngj-image-dataset-bucket'
    export DYNAMODB_TABLE_NAME='serverless-data-processing-table'
    ```
4. Run the CDK commands to deploy the infrastructure with the Lambda functions:
    ```bash
    cdk synth
    cdk deploy
    ```
