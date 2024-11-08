provider "aws" { }

locals {
  aws_account_id = data.aws_caller_identity.this.account_id
  aws_region = data.aws_region.this.name
}

locals {
  # required to break circular dependency
  reply_client_function_name = "${var.prefix}-reply-client"
  invoke_agent_function_name = "${var.prefix}-invoke-agent"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "reply_client" {
  name               = "${var.prefix}-lambda-reply-client"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy" "reply_client" {
  name = "apigw_post_on_wss"
  role   = aws_iam_role.reply_client.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections"
        ]
        Resource = "arn:aws:execute-api:${local.aws_region}:${local.aws_account_id}:*/@connections/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachments_exclusive" "lambda_basic_policy_for_reply_client" {
  policy_arns = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
  role_name = aws_iam_role.reply_client.name
}

resource "aws_iam_role" "invoke_agent" {
  name               = "${var.prefix}-lambda-invoke-agent"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy" "invoke_agent" {
  name = "invoke_bedrock_agent"
  role   = aws_iam_role.invoke_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeAgent"
        ]
        Resource = aws_bedrockagent_agent_alias.travel_agent.agent_alias_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachments_exclusive" "lambda_basic_policy_for_invoke_agent" {
  policy_arns = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
  role_name = aws_iam_role.invoke_agent.name
}

resource "aws_iam_role" "flight_management" {
  name = "${var.prefix}-lambda-flight-management"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachments_exclusive" "lambda_basic_policy_for_flight_management" {
  policy_arns = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
  role_name = aws_iam_role.flight_management.name
}

data "archive_file" "lambda_reply_client" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/reply-client"
  output_path = "${path.module}/build/reply-client.zip"
}

resource "aws_lambda_function" "reply_client" {
  runtime = "nodejs20.x"
  handler       = "index.handler"
  function_name = local.reply_client_function_name
  role          = aws_iam_role.reply_client.arn
  filename      = "${path.module}/build/reply-client.zip"
  source_code_hash = data.archive_file.lambda_reply_client.output_base64sha256
  timeout = 5

  environment {
    variables = {
      API_GATEWAY_ENDPOINT = "https://${aws_apigatewayv2_api.websocket_api.id}.execute-api.${local.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.stage.name}"
    }
  }
}

data "archive_file" "lambda_invoke_agent" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/invoke-agent"
  output_path = "${path.module}/build/invoke-agent.zip"
}

resource "aws_lambda_function" "invoke_agent" {
  runtime = "nodejs20.x"
  handler       = "index.handler"
  function_name = local.invoke_agent_function_name
  role          = aws_iam_role.invoke_agent.arn
  filename      = "${path.module}/build/invoke-agent.zip"
  source_code_hash = data.archive_file.lambda_invoke_agent.output_base64sha256
  timeout = 60

  environment {
    variables = {
      AGENT_ID = aws_bedrockagent_agent_alias.travel_agent.agent_id
      AGENT_ALIAS_ID = aws_bedrockagent_agent_alias.travel_agent.agent_alias_id
    }
  }
}

data "archive_file" "lambda_flight_management" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/flight-management"
  output_path = "${path.module}/build/flight-management.zip"
}

resource "aws_lambda_function" "flight_management" {
  runtime = "nodejs20.x"
  handler       = "index.handler"
  function_name = "${var.prefix}-flight-management"
  role          = aws_iam_role.flight_management.arn
  filename      = "${path.module}/build/flight-management.zip"
  source_code_hash = data.archive_file.lambda_flight_management.output_base64sha256

}

resource "aws_lambda_permission" "flight_management" {
  statement_id = "BedrockAgentInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.flight_management.function_name
  principal     = "bedrock.amazonaws.com"
}

resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "${var.prefix}-api"
  protocol_type             = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_iam_role" "api_gateway" {
  name = "${var.prefix}-api-gateway"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_gateway_sfn" {
  name = "api-gateway-sfn"
  role = aws_iam_role.api_gateway.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "states:StartExecution"
        ]
        Resource = "*"
      }
    ]
  })
}

locals {
  vtl_sf_input = "{\\\"connectionId\\\":\\\"$context.connectionId\\\",\\\"body\\\":$util.escapeJavaScript($input.json('$')).replaceAll(\"\\\\'\",\"'\")}"
}

resource "aws_apigatewayv2_integration" "agent_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS"
  connection_type           = "INTERNET"
  content_handling_strategy = "CONVERT_TO_TEXT"
  description              = "Step Functions StartExecution for agent route"
  integration_method       = "POST"
  integration_uri         = "arn:aws:apigateway:${local.aws_region}:states:action/StartExecution"
  passthrough_behavior    = "WHEN_NO_MATCH"
  credentials_arn = aws_iam_role.api_gateway.arn

  request_templates = {
    #"$default" = "{\"stateMachineArn\":\"$stageVariables.agentChatStateMachineArn\",\"input\":\"{\\\"connectionId\\\":\\\"$context.connectionId\\\",\\\"body\\\":$util.escapeJavaScript($input.json('$')).replaceAll(\"\\\\'\",\"'\")}\"}"
    "$default" = replace(jsonencode({
      stateMachineArn = "$stageVariables.agentChatStateMachineArn"
      input           =  "vtl_sf_input"
      }),"vtl_sf_input",local.vtl_sf_input)
  }
}

resource "aws_apigatewayv2_integration" "image_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS"
  connection_type           = "INTERNET"
  content_handling_strategy = "CONVERT_TO_TEXT"
  description              = "Step Functions StartExecution for image route"
  integration_method       = "POST"
  integration_uri         = "arn:aws:apigateway:${local.aws_region}:states:action/StartExecution"
  passthrough_behavior    = "WHEN_NO_MATCH"
  credentials_arn = aws_iam_role.api_gateway.arn

  request_templates = {
    #"$default" = "{\"stateMachineArn\":\"$stageVariables.recommendLocationStateMachineArn\",\"input\":\"{\\\"connectionId\\\":\\\"$context.connectionId\\\",\\\"body\\\":$util.escapeJavaScript($input.json('$')).replaceAll(\"\\\\'\",\"'\")}\"}"
    "$default" = replace(jsonencode({
      stateMachineArn = "$stageVariables.recommendLocationStateMachineArn"
      input           =  "vtl_sf_input"
    }),"vtl_sf_input",local.vtl_sf_input)
  }
}

resource "aws_apigatewayv2_route" "agent_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "agent"
  target    = "integrations/${aws_apigatewayv2_integration.agent_integration.id}"
}

resource "aws_apigatewayv2_route" "image_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "image"
  target    = "integrations/${aws_apigatewayv2_integration.image_integration.id}"
}

resource "aws_apigatewayv2_stage" "stage" {
  api_id = aws_apigatewayv2_api.websocket_api.id
  name   = "prod"
  auto_deploy = "true"

  stage_variables = {
    agentChatStateMachineArn = aws_sfn_state_machine.agent_chat.arn
    recommendLocationStateMachineArn = aws_sfn_state_machine.recommend_location.arn
  }

  default_route_settings {
    logging_level      = "ERROR"
    data_trace_enabled = "true"
    throttling_rate_limit = 100
    throttling_burst_limit = 50
  }
}

resource "aws_iam_role" "recommend_location" {
  name = "${var.prefix}-sf-recommend-location"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "recommend_location" {
  name = "${var.prefix}-recommend-location"
  role = aws_iam_role.recommend_location.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["bedrock:InvokeModel"]
        Resource = ["arn:aws:bedrock:${local.aws_region}::foundation-model/*"]
      },
      {
        Effect = "Allow"
        Action = ["lambda:InvokeFunction"]
        Resource = [
          "arn:aws:lambda:${local.aws_region}:${local.aws_account_id}:function:${local.reply_client_function_name}",
        ]
      },
      {
        "Effect" = "Allow",
        "Action" = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ],
        "Resource" = ["*"]
      }
    ]
  })
}

resource "aws_sfn_state_machine" "recommend_location" {
  name     = "${var.prefix}-recommend-location"
  role_arn = aws_iam_role.recommend_location.arn
  type = "EXPRESS"
  definition = templatefile("${path.module}/sfn/recommend-location.json", {
    reply_client_function_name = local.reply_client_function_name
    bedrock_model_id = var.bedrock_model_id
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.recommend_location.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }
}

resource "aws_cloudwatch_log_group" "recommend_location" {
  name              = "/aws/stepfunctions/${var.prefix}-recommend-location"
  retention_in_days = 14
}

resource "aws_iam_role" "agent_chat" {
  name = "${var.prefix}-sf-agent-chat"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "agent_chat" {
  name = "agent_chat"
  role = aws_iam_role.agent_chat.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["lambda:InvokeFunction"]
        Resource = [
          "arn:aws:lambda:${local.aws_region}:${local.aws_account_id}:function:${local.reply_client_function_name}",
          "arn:aws:lambda:${local.aws_region}:${local.aws_account_id}:function:${local.invoke_agent_function_name}"
        ]
      },
      {
        "Effect" = "Allow",
        "Action" = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ],
        "Resource" = ["*"]
      }
    ]
  })
}

resource "aws_sfn_state_machine" "agent_chat" {
  name     = "${var.prefix}-agent-chat"
  role_arn = aws_iam_role.agent_chat.arn
  type = "EXPRESS"
  definition = templatefile("${path.module}/sfn/agent-chat.json", {
    reply_client_function_name = local.reply_client_function_name
    invoke_agent_function_name = aws_lambda_function.invoke_agent.function_name
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.agent_chat.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }
}

resource "aws_cloudwatch_log_group" "agent_chat" {
  name              = "/aws/stepfunctions/${var.prefix}-agent-chat"
  retention_in_days = 14
}

resource "aws_iam_role" "travel_agent" {
  name = "${var.prefix}-travel-agent"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "travel_agent" {
  name = "travel_agent"
  role   = aws_iam_role.travel_agent.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["bedrock:InvokeModel"]
        Resource = ["arn:aws:bedrock:${local.aws_region}::foundation-model/*"]
      },
      {
        "Effect" = "Allow",
        "Action" = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ],
        "Resource" = ["*"]
      }
    ]
  })
}

resource "aws_bedrockagent_agent" "travel_agent" {
  agent_name              = var.bedrock_agent_name
  agent_resource_role_arn = aws_iam_role.travel_agent.arn
  foundation_model        = var.bedrock_agent_model_id
  instruction             = "You are a travel agent designed to help people find great places to spend their spare time."
  skip_resource_in_use_check = true
}

resource "aws_bedrockagent_agent_action_group" "user_input" {
  action_group_name = "UserInputAction"
  agent_id          = aws_bedrockagent_agent.travel_agent.id
  agent_version     = "DRAFT"
  parent_action_group_signature = "AMAZON.UserInput"
  skip_resource_in_use_check = true
}

resource "aws_bedrockagent_agent_action_group" "flight_management" {
  action_group_state = "ENABLED"
  action_group_name = "FlightManagement"
  description = "Allow flight management activities like search, book or cancel a flight"
  agent_id          = aws_bedrockagent_agent.travel_agent.id
  agent_version     = "DRAFT"
  skip_resource_in_use_check = true
  action_group_executor {
    lambda = aws_lambda_function.flight_management.arn
  }
  function_schema {
    member_functions {
      functions {
        name = "FlightSearch"
        description = "Search for available flights"
        parameters {
          map_block_key = "origin"
          type = "string"
          description = "origin airport code"
          required = true
        }
        parameters {
          map_block_key = "destination"
          type = "string"
          description = "destination airport code"
          required = true
        }
        parameters {
          map_block_key = "departureDate"
          type = "string"
          description = "departure date in ISO 8601 format "
          required = true
        }
      parameters {
        map_block_key = "returnDate"
        type = "string"
        description = "return date in ISO 8601 format "
        required = true
      }
      }
      functions {
        name = "FlightBook"
        description = "Book a flight"
        parameters {
          map_block_key = "flightId"
          type = "string"
          description = "unique flight identifier"
          required = true
        }
      }
      functions {
        name = "FlightCancel"
        description = "Cancel a flight"
        parameters {
          map_block_key = "confirmation"
          type          = "string"
          description = "flight confirmation identifier"
          required     = true
        }
      }
    }
  }
}

resource "aws_bedrockagent_agent_alias" "travel_agent" {
  depends_on = [
    aws_bedrockagent_agent_action_group.user_input,
    aws_bedrockagent_agent_action_group.flight_management,
    null_resource.wait_bedrock_agent_be_prepared
  ]
  agent_alias_name = "latest"
  agent_id         = aws_bedrockagent_agent.travel_agent.id
}

# address issues where the alias cannot be created because the agent isn't prepared
resource "null_resource" "wait_bedrock_agent_be_prepared" {
  triggers = {
    "agent_id" = aws_bedrockagent_agent.travel_agent.id
  }

  provisioner "local-exec" {
    when    = create
    command = <<EOT
      #!/bin/bash
      agent_id="${self.triggers.agent_id}"

      echo "Waiting for Bedrock Agent to reach PREPARED status..."

      while true; do
        # Fetch the agent status
        status=$(aws bedrock-agent get-agent --agent-id "$agent_id" --query "agent.agentStatus" --output text)

        # Check if the status is PREPARED
        if [ "$status" == "PREPARED" ]; then
          echo "Agent is in PREPARED status."
          exit 0
        fi

        # If not PREPARED, wait and check again
        echo "Current status: $status. Retrying..."
        sleep 3
      done
    EOT
  }
}