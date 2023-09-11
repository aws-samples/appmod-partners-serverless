# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os

def lambda_handler(event, context):
    if event["key"]=="success":
        print(f"Function: Logging something which logging extension will send to successful S3")
    else:
        print("sending to S3 bucket for function logs")
        print(a)
    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }
