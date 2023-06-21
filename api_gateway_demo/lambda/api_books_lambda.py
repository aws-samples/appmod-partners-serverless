import boto3
import simplejson as json
import logging 
logger = logging.getLogger()
logger.setLevel(logging.INFO)
import os
  
dynamodbTableName = os.environ['BOOKS_TABLE_NAME']
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(dynamodbTableName)


getMethod = 'GET'
postMethod = 'POST'
healthPath = '/health'
libaryPath = '/books'

def lambda_handler(event, contest):
    logger.info(event)
    httpMethod = event['httpMethod']
    path = event['path']
    if httpMethod == getMethod and path == healthPath:
        response = buildResponse(200)
    elif httpMethod == getMethod:
        response = getBooks()
    elif httpMethod == postMethod:
        response = saveBook(event['body'])    
    else:
        response = buildResponse(404, 'Not Found')
    return response

def getBooks():
    try:
        response = table.scan()
        result = response['Items']

        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            result.extend(response['Items'])

        body = {'books': result}
        
        return buildResponse(200, body)
    except:
        logger.exception('Log it here for now')

def saveBook(requestBody):
    logger.info(requestBody)
    requestBody = json.loads(requestBody)
    try:
        table.put_item(Item=requestBody)
        body = {
            'Operation': 'SAVE',
            'Message': 'SUCCESS',
            'Item': requestBody
        }
        return buildResponse(200, body)
    except:
        logger.exception('Error')
        body = {
            'Item': requestBody
        }
        return buildResponse(400, body)

def buildResponse(statusCode, body=None):
    response = {
        'statusCode': statusCode,
        'headers': {
            'ContentType': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    }
    if body is not None:
        response['body'] = json.dumps(body)
    return response