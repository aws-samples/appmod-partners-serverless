import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';

import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Role, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export interface DistributedMapStackProps extends cdk.StackProps {
    labelLambda: lambda.Function;
    recordLambda: lambda.Function;
    dataBucket: s3.IBucket;
    executionOutputBucket: s3.Bucket;
    table: Table;
    mapProps: {
        maxConcurrency: number;
        toleratedFailurePercentage: number;
    };
}

export class DistributedMapStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: DistributedMapStackProps) {
        super(scope, id, props);

        // Create a new role for Step Functions State Machine
        const stateMachineRole = new Role(this, 'StateMachineRole', {
            assumedBy: new ServicePrincipal('states.amazonaws.com'),
        });

        // Allow the state machine to invoke the Lambda functions
        stateMachineRole.addToPolicy(
            new PolicyStatement({
                actions: ['lambda:InvokeFunction'],
                resources: [
                    props.labelLambda.functionArn,
                    props.recordLambda.functionArn,
                    `${props.labelLambda.functionArn}:*`,
                    `${props.recordLambda.functionArn}:*`,
                ],
            })
        );

        // Allow the state machine to list the data bucket
        stateMachineRole.addToPolicy(
            new PolicyStatement({
                actions: ['s3:ListBucket'],
                resources: [props.dataBucket.bucketArn],
            })
        );

        // Allow the state machine role to start execution on the state machine
        stateMachineRole.addToPolicy(
            new PolicyStatement({
                actions: [
                    'states:StartExecution',
                    'states:DescribeExecution',
                    'states:StopExecution',
                ],
                resources: ['*'],
            })
        );

        // Allow the state machine role to write to the execution output bucket
        stateMachineRole.addToPolicy(
            new PolicyStatement({
                actions: [
                    's3:PutObject',
                    's3:GetObject',
                    's3:ListMultipartUploadParts',
                    's3:AbortMultipartUpload',
                ],
                resources: [
                    props.executionOutputBucket.bucketArn,
                    `${props.executionOutputBucket.bucketArn}/*`,
                ],
            })
        );

        // Custom State for Distributed Map (It is not native on CDK yet)
        const distributedMap = new sfn.CustomState(
            this,
            'DataProcessingDistributedMap',
            {
                stateJson: {
                    Type: 'Map',
                    MaxConcurrency: props.mapProps.maxConcurrency,
                    ItemProcessor: {
                        ProcessorConfig: {
                            Mode: 'DISTRIBUTED',
                            ExecutionType: 'STANDARD',
                        },
                        StartAt: 'Detect Labels',
                        States: {
                            'Detect Labels': {
                                Type: 'Task',
                                Resource: 'arn:aws:states:::lambda:invoke',
                                OutputPath: '$.Payload',
                                Parameters: {
                                    FunctionName: `${props.labelLambda.functionArn}:$LATEST`,
                                    Payload: {
                                        S3Object: {
                                            'Bucket.$': '$.Bucket',
                                            'Name.$': '$.Name',
                                        },
                                    },
                                },
                                Retry: [
                                    {
                                        ErrorEquals: [
                                            'Lambda.ServiceException',
                                            'Lambda.AWSLambdaException',
                                            'Lambda.SdkClientException',
                                            'Lambda.TooManyRequestsException',
                                        ],
                                        IntervalSeconds: 2,
                                        MaxAttempts: 6,
                                        BackoffRate: 2,
                                    },
                                ],
                                Next: 'Write data to DDB',
                            },
                            'Write data to DDB': {
                                Type: 'Task',
                                Resource: 'arn:aws:states:::lambda:invoke',
                                OutputPath: '$.Payload',
                                Parameters: {
                                    'Payload.$': '$',
                                    FunctionName: `${props.recordLambda.functionArn}:$LATEST`,
                                },
                                Retry: [
                                    {
                                        ErrorEquals: [
                                            'Lambda.ServiceException',
                                            'Lambda.AWSLambdaException',
                                            'Lambda.SdkClientException',
                                            'Lambda.TooManyRequestsException',
                                        ],
                                        IntervalSeconds: 2,
                                        MaxAttempts: 6,
                                        BackoffRate: 2,
                                    },
                                ],
                                End: true,
                            },
                        },
                    },
                    ItemReader: {
                        Resource: 'arn:aws:states:::s3:listObjectsV2',
                        Parameters: {
                            Bucket: props.dataBucket.bucketName,
                            'Prefix.$':
                                '$$.Execution.Input.myStateInput.Prefix',
                        },
                    },
                    ItemSelector: {
                        'Bucket.$': '$$.Execution.Input.myStateInput.Bucket',
                        'Name.$': '$$.Map.Item.Value.Key',
                    },
                    ResultWriter: {
                        Resource: 'arn:aws:states:::s3:putObject',
                        Parameters: {
                            Bucket: props.executionOutputBucket.bucketName,
                            Prefix: 'imageLabelJobs',
                        },
                    },
                    ToleratedFailurePercentage:
                        props.mapProps.toleratedFailurePercentage,
                },
            }
        );

        const dMapStateMachine = new sfn.StateMachine(
            this,
            'DMapStateMachine',
            {
                definitionBody:
                    sfn.DefinitionBody.fromChainable(distributedMap),
                role: stateMachineRole,
                tracingEnabled: true,
                logs: {
                    destination: new LogGroup(
                        this,
                        'DMapStateMachineLogGroup',
                        {
                            logGroupName: '/aws/lambda/DMapStateMachine',
                            retention: RetentionDays.ONE_MONTH,
                            removalPolicy: cdk.RemovalPolicy.DESTROY,
                        }
                    ),
                    level: sfn.LogLevel.ALL,
                },
            }
        );

        new cdk.CfnOutput(this, 'DMapStateMachineArnOutput', {
            description: 'ARN of the State Machine',
            value: dMapStateMachine.stateMachineArn,
        });

        new cdk.CfnOutput(this, 'DMapStateMachineConsoleUrl', {
            description: 'State Machine Console URL',
            value: `https://${process.env.CDK_DEFAULT_REGION}.console.aws.amazon.com/states/home?region=${process.env.CDK_DEFAULT_REGION}#/statemachines/view/${dMapStateMachine.stateMachineArn}`
        });
    }
}
