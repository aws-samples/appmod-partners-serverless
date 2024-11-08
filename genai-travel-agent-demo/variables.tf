variable "prefix" {
  type = string
  description = "Prefix for resources"
  default = "travel-agent"
}

variable "lambda_output_dir" {
  type = string
  description = "Lambda output directory"
  default = "build"
}

variable "bedrock_agent_name" {
  type = string
  description = "Bedrock agent name"
  default = "travel-agent"
}

variable "bedrock_model_id" {
  type = string
  description = "Bedrock model id"
  default = "anthropic.claude-3-sonnet-20240229-v1:0"
}

variable "bedrock_agent_model_id" {
  type = string
  description = "Bedrock agent model id"
  default = "anthropic.claude-3-sonnet-20240229-v1:0"
}