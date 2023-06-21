from aws_cdk import (
    CfnOutput,
    Stack,
    aws_dynamodb as dynamodb,
    aws_apigateway as apigateway,
    aws_lambda as lambda_,
    aws_cognito as cognito,
    Duration as duration,
)
from constructs import Construct

class ApiGatewayDemoStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # create a lambda function with the name "api_books"
        api_books_lambda = lambda_.Function(
            self, "api_books_lambda",
            runtime=lambda_.Runtime.PYTHON_3_9,
            code=lambda_.Code.from_asset('lambda/'),
            handler="api_books_lambda.lambda_handler",
            tracing=lambda_.Tracing.ACTIVE
        )

        # create a dynamodb table with the name "books"
        books_table = dynamodb.Table(
            self, "books",
            partition_key=dynamodb.Attribute(name="id", type=dynamodb.AttributeType.NUMBER),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            )
        # grant scan read and write permission to lambda function
        books_table.grant_read_write_data(api_books_lambda)

        # include env variables in the lambda function
        api_books_lambda.add_environment("BOOKS_TABLE_NAME", books_table.table_name)

        # create an api gateway with the name "api_books" and lambda proxy integration
        api_books = apigateway.LambdaRestApi(
            self, "api_books",
            handler=api_books_lambda,
            proxy=False,
            deploy_options=apigateway.StageOptions(
                stage_name="dev",
                tracing_enabled=True,
            )
        )

        # create resource for api_books
        api_books_resource = api_books.root.add_resource("books")
        api_books_resource.add_method("GET")      

        # books: apigateway.Resource
        user_pool = cognito.UserPool(self, "BooksUserPool",
                                     auto_verify=cognito.AutoVerifiedAttrs(email=True),
                                     password_policy=cognito.PasswordPolicy(
            min_length=6,
            temp_password_validity=duration.days(7)))

        auth = apigateway.CognitoUserPoolsAuthorizer(self, "booksAuthorizer",
            cognito_user_pools=[user_pool])
    
        api_books_resource.add_method("POST",
            authorizer=auth,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        api_books_resource.add_method("DELETE",
            authorizer=auth,
            authorization_type=apigateway.AuthorizationType.COGNITO
        )

        # create a cognito domain and user pool

        cognito_domain = cognito.CfnUserPoolDomain(
            self, "BooksDomain",
            domain="books",
            user_pool_id=user_pool.user_pool_id)
        
        poolClient = user_pool.add_client("BooksUserPoolClient",
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(
                    authorization_code_grant=True,
                    implicit_code_grant=True
                ),
                scopes=[cognito.OAuthScope.OPENID,cognito.OAuthScope.EMAIL,cognito.OAuthScope.COGNITO_ADMIN],
                callback_urls=["https://localhost:3000/"],
                logout_urls=["https://localhost:3000/"]
            )
        )

        CfnOutput(self, "user_pool_id", value=user_pool.user_pool_id)
