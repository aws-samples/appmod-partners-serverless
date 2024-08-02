variable "name" {
  type = string
  description = "Name of the microservice"
  default = "test"
}

variable "aws_region" {
  type = string
  description = "AWS region"
  default = "us-east-1"
}

provider "aws" {
  region = var.aws_region
}

### IAM
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

data "aws_iam_policy_document" "lambda_ddb_policy" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:Scan",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem"
    ]
    resources = ["arn:aws:dynamodb:${var.aws_region}:*:table/${aws_dynamodb_table.dynamodb-table.name}"]
  }
}

resource "aws_iam_role" "iam_for_lambda" {
  name               = "${var.name}_serverless_microservice"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
  inline_policy {
    name = "lambda_ddb_policy"
    policy = data.aws_iam_policy_document.lambda_ddb_policy.json
  }
}

### DynamoDB
resource "aws_dynamodb_table" "dynamodb-table" {
  name           = "${var.name}_serverless_microservice"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

### Lambda
resource "aws_lambda_permission" "allow_api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_microservice.function_name
  principal     = "apigateway.amazonaws.com"

  # The "/*/*" portion grants access from any method on any resource within the API Gateway REST API.
  source_arn = "${aws_api_gateway_rest_api.microservice_api.execution_arn}/*/*"
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/src"
  output_path = "${path.module}/src.zip"
}

resource "aws_lambda_function" "lambda_microservice" {
  # If the file is not in the current working directory you will need to include a
  # path.module in the filename.
  runtime = "nodejs20.x"
  handler       = "index.handler"
  function_name = "${var.name}_microservice"
  role          = aws_iam_role.iam_for_lambda.arn
  filename      = "src.zip"
  source_code_hash = data.archive_file.lambda.output_base64sha256

  environment {
    variables = {
      DDB_TABLE = aws_dynamodb_table.dynamodb-table.name
    }
  }
}

### API Gateway
resource "aws_api_gateway_rest_api" "microservice_api" {
  name = "${var.name}-microservice-api"
  description = "Example API Gateway"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "microservice_id_resource" {
  parent_id   = aws_api_gateway_rest_api.microservice_api.root_resource_id
  rest_api_id = aws_api_gateway_rest_api.microservice_api.id
  path_part   = "{id}"
}

## GET /
resource "aws_api_gateway_method" "microservice_get_root_method" {
  rest_api_id   = aws_api_gateway_rest_api.microservice_api.id
  resource_id   = aws_api_gateway_rest_api.microservice_api.root_resource_id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "microservice_get_root_integration" {
  rest_api_id             = aws_api_gateway_rest_api.microservice_api.id
  resource_id             = aws_api_gateway_rest_api.microservice_api.root_resource_id
  http_method             = aws_api_gateway_method.microservice_get_root_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda_microservice.invoke_arn
}

## POST /
resource "aws_api_gateway_method" "microservice_post_method" {
  rest_api_id   = aws_api_gateway_rest_api.microservice_api.id
  resource_id   = aws_api_gateway_rest_api.microservice_api.root_resource_id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "microservice_post_integration" {
  rest_api_id             = aws_api_gateway_rest_api.microservice_api.id
  resource_id             = aws_api_gateway_rest_api.microservice_api.root_resource_id
  http_method             = aws_api_gateway_method.microservice_post_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda_microservice.invoke_arn
}

## PUT /
resource "aws_api_gateway_method" "microservice_put_method" {
  rest_api_id   = aws_api_gateway_rest_api.microservice_api.id
  resource_id   = aws_api_gateway_rest_api.microservice_api.root_resource_id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "microservice_put_integration" {
  rest_api_id             = aws_api_gateway_rest_api.microservice_api.id
  resource_id             = aws_api_gateway_rest_api.microservice_api.root_resource_id
  http_method             = aws_api_gateway_method.microservice_put_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda_microservice.invoke_arn
}

## GET /{id}
resource "aws_api_gateway_method" "microservice_get_method" {
  rest_api_id   = aws_api_gateway_rest_api.microservice_api.id
  resource_id   = aws_api_gateway_resource.microservice_id_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "microservice_get_integration" {
  rest_api_id             = aws_api_gateway_rest_api.microservice_api.id
  resource_id             = aws_api_gateway_resource.microservice_id_resource.id
  http_method             = aws_api_gateway_method.microservice_get_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda_microservice.invoke_arn
}

## DELETE /{id}
resource "aws_api_gateway_method" "microservice_delete_method" {
  rest_api_id   = aws_api_gateway_rest_api.microservice_api.id
  resource_id   = aws_api_gateway_resource.microservice_id_resource.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "microservice_delete_integration" {
  rest_api_id             = aws_api_gateway_rest_api.microservice_api.id
  resource_id             = aws_api_gateway_resource.microservice_id_resource.id
  http_method             = aws_api_gateway_method.microservice_delete_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda_microservice.invoke_arn
}

resource "aws_api_gateway_deployment" "microservice_deployment" {
  rest_api_id = aws_api_gateway_rest_api.microservice_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_rest_api.microservice_api.root_resource_id,
      aws_api_gateway_method.microservice_get_root_method.id,
      aws_api_gateway_method.microservice_get_method.id,
      aws_api_gateway_method.microservice_post_method.id,
      aws_api_gateway_method.microservice_put_method.id,
      aws_api_gateway_method.microservice_delete_method.id,
      aws_api_gateway_integration.microservice_get_root_integration.id,
      aws_api_gateway_integration.microservice_get_integration.id,
      aws_api_gateway_integration.microservice_post_integration.id,
      aws_api_gateway_integration.microservice_put_integration.id,
      aws_api_gateway_integration.microservice_delete_integration.id
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "microservice_stage" {
  deployment_id = aws_api_gateway_deployment.microservice_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.microservice_api.id
  stage_name    = "dev"
}

output "api_endpoint" {
  value = "${aws_api_gateway_deployment.microservice_deployment.invoke_url}${aws_api_gateway_stage.microservice_stage.stage_name}/"
}