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

        data = []
        for image in body:
            print(image)
            if 'Name' in image:
                id = image['Name']
                if 'Labels' in image:
                    labelData = json.loads(json.dumps(image['Labels']), parse_float=Decimal)
                    item = {
                        'id': id,
                        'labels': labelData.popitem()
                    }
                    print(item)
                    data.append(item)
                else:
                    raise ValueError('The labels must be included.')
                
            else:
                raise ValueError('Invalid source. The name must be included.')
            
        print(data)
        # Input the data to DynamoDB
        responses = []
        for item in data:
            response = table.put_item(
                Item=item
            )
            responses.append(response)
            
        print(responses)
        lambda_response = {
            "statusCode": 200,
        }

    except ClientError as err:
        error_message = f"Couldn't record the label. " + \
            err.response['Error']['Message']

        lambda_response = {
            'statusCode': 400,
            'error': error_message
        }
        logger.error("Error function %s: %s",
            context.invoked_function_arn, error_message)

    except ValueError as val_error:
        lambda_response = {
            'statusCode': 400,
            'name': event['body'],
            'error': format(val_error)
        }
        logger.error("Error function %s: %s",
            context.invoked_function_arn, format(val_error))
        
    except KeyError as key_error:
        lambda_response = {
            'statusCode': 400,
            'name': event['body'],
            'error': format(key_error)
        }
        logger.error("Error function %s: %s",
            context.invoked_function_arn, format(key_error))

    return lambda_response
