import boto3
import json
import logging
from os import environ
from decimal import Decimal

from botocore.exceptions import ClientError

# Set up logging.
logger = logging.getLogger(__name__)

# Get the table name from the environment
db = environ['TABLE_NAME']

# Get the boto3 client.
ddb = boto3.resource('dynamodb')
table = ddb.Table(db)


def lambda_handler(event, context):
    try:
        # Save the name and label
        body = event['body']
        print(body)
        if 'Name' and 'Labels' in body:
            id = body['Name']
            data = json.loads(json.dumps(body['Labels']), parse_float=Decimal)
            
        else:
            raise ValueError(
                'Invalid source. The name must be included.')

        # Input the data to DynamoDB
        response = table.put_item(
            Item={
                'id': id,
                'label1': data.popitem(),
                'label2': data.popitem()
            }
        )

        lambda_response = {
            "statusCode": 200,
            "body": json.dumps(response)
        }

    except ClientError as err:
        error_message = f"Couldn't record the label. " + \
            err.response['Error']['Message']

        lambda_response = {
            'statusCode': 400,
            'body': {
                "Error": err.response['Error']['Code'],
                "ErrorMessage": error_message
            }
        }
        logger.error("Error function %s: %s",
            context.invoked_function_arn, error_message)

    except ValueError as val_error:
        lambda_response = {
            'statusCode': 400,
            'body': {
                "Error": "ValueError",
                "ErrorMessage": format(val_error)
            }
        }
        logger.error("Error function %s: %s",
            context.invoked_function_arn, format(val_error))

    return lambda_response
