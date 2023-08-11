import boto3
import logging
from os import environ

from botocore.exceptions import ClientError
from botocore.config import Config

# Set up logging.
logger = logging.getLogger(__name__)

# Get the table name from the environment
bucket_name = environ['BUCKET_NAME']

# Boto configurations for the retries in Rekognition
config = Config(
   retries = {
      'max_attempts': 10,
      'mode': 'standard'
   }
)

# Get the boto3 client.
rek_client = boto3.client('rekognition', config=config)

def lambda_handler(event, context):

    images = []

    # Determine image source, whether it is in batch, single, or nonexistent
    if 'items' in event:
        items = event['items']
        for item in items:
            images.append({
                'S3Object':
                {
                    'Bucket': item['Bucket'],
                    'Name': item['Name']
                }
            })

    else:
        raise ValueError(
            'Invalid source. Please provide the right event source.')

    # For debugging
    print(images)

    # Detect the top label from the image, and form a list of payload to return
    labels = []
    for image in images:
        name = image['S3Object']['Name']
        if (image['S3Object']['Name'][-4:] == '.jpg'):
            response = rek_client.detect_labels(Image=image,
                MaxLabels=1,
                MinConfidence=80)
            label = response['Labels']
            values = { item['Name']: item['Confidence'] for item in label }
            payload = {
                "Name": name,
                "Labels": values
            }
            labels.append(payload)
    

    lambda_response = {
        "statusCode": 200,
        "body": labels
    }

    return lambda_response