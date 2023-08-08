import boto3
import logging
from os import environ

from botocore.exceptions import ClientError

# Set up logging.
logger = logging.getLogger(__name__)

# Get the table name from the environment
bucket_name = environ['BUCKET_NAME']

# Get the boto3 client.
rek_client = boto3.client('rekognition', region_name="us-west-2")

def lambda_handler(event, context):

    try:
        # Determine image source.
        if 'S3Object' in event:
            image = {
                'S3Object':
                {
                    'Bucket': event['S3Object']['Bucket'],
                    'Name': event['S3Object']['Name']
                }
            }

        else:
            raise ValueError(
                'Invalid source. Only image base 64 encoded image bytes or S3Object are supported.')


        # Detect Top 2 labels from the image.
        response = rek_client.detect_labels(Image=image,
            MaxLabels=1,
            MinConfidence=80)

        # Extract value
        labels = response['Labels']
        name = event['S3Object']['Name']
        values = {label['Name']: label['Confidence'] for label in labels}

        # Form a payload to return
        payload = {
            "Name": name,
            "Labels": values
        }

        lambda_response = {
            "statusCode": 200,
            "body": payload
        }

    except ClientError as err:
        error_message = f"Couldn't analyze image. " + \
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