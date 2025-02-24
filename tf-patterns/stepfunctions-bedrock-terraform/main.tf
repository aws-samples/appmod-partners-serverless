variable "aws_region" {
  type = string
  description = "AWS region"
  default = "us-east-1"
}

provider "aws" {
  region = var.aws_region
}

variable "model_id" {
  description = "The ARN of the Bedrock model to use"
  type        = string
  default     = "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2:1"
}

# Resources
resource "aws_cloudwatch_log_group" "sfn_log_group" {
  name = "/stepfunctions/StateMachineExpressSyncToBedrock-${random_pet.suffix.id}"
}

resource "aws_iam_role" "sfn_execution_role" {
  name = "StatesExecutionRole-${random_pet.suffix.id}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.${var.aws_region}.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "CWLogs-${random_pet.suffix.id}"
  role = aws_iam_role.sfn_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:CreateLogStream",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutLogEvents",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "bedrock_access" {
  name = "BedrockAccess-${random_pet.suffix.id}"
  role = aws_iam_role.sfn_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = var.model_id
      }
    ]
  })
}

resource "aws_sfn_state_machine" "bedrock_integration" {
  name     = "StateMachineExpressSyncToBedrock-${random_pet.suffix.id}"
  role_arn = aws_iam_role.sfn_execution_role.arn

  definition = jsonencode({
    Comment = "This state machine demonstrates the integration with Amazon Bedrock Anthropic Claude v2.1 Model"
    StartAt = "Bedrock InvokeModel"
    States = {
      "Bedrock InvokeModel" = {
        Type     = "Task"
        Resource = "arn:aws:states:::bedrock:invokeModel"
        Parameters = {
          ModelId = var.model_id
          Body = {
            "prompt.$"           = "$.prompt"
            max_tokens_to_sample = 200
          }
        }
        Retry = [
          {
            ErrorEquals     = ["States.TaskFailed"]
            IntervalSeconds = 20
            MaxAttempts     = 5
            BackoffRate     = 10
          }
        ]
        End = true
      }
    }
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.sfn_log_group.arn}:*"
    include_execution_data = false
    level                  = "ALL"
  }

  type = "EXPRESS"
}

# Outputs
output "StateMachineExpressSyncToBedrockArn" {
  value       = aws_sfn_state_machine.bedrock_integration.arn
  description = "StateMachineExpressSyncToBedrock Arn"
}

##################
# Extra resources
##################

resource "random_pet" "suffix" {
  length = 2
}
