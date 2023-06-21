#!/usr/bin/env python3
import os

import aws_cdk as cdk

from api_gateway_demo.api_gateway_demo_stack import ApiGatewayDemoStack


app = cdk.App()
ApiGatewayDemoStack(app, "ApiGatewayDemoStack",
    env=cdk.Environment(account=os.getenv('CDK_DEFAULT_ACCOUNT'), region=os.getenv('CDK_DEFAULT_REGION')),
   )

app.synth()
