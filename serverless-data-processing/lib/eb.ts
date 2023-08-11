import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sf from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface EventBridgeProps extends cdk.NestedStackProps {
    stateMachine: sf.StateMachine;
}

export class EventBridgeStack extends cdk.NestedStack {
    private bus: events.EventBus;

    constructor(scope: Construct, id: string, props: EventBridgeProps) {
        super(scope, id, props);

        // Create a new EventBridge Bus
        this.bus = new events.EventBus(this, 'ServerlessDataProcessingBus', {});

        // Create a new EventBridge Rule
        const rule = new events.Rule(this, 'ServerlessDataProcessingRule', {
            eventBus: this.bus,
            eventPattern: {
                source: ['serverless-data-processing'],
                detailType: ['ServerlessDataProcessing'],
            },
        });

        // Create a role
        const role = new iam.Role(this, 'Role', {
            assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
        });

        // Create a new event target for the state machine
        rule.addTarget(
            new targets.SfnStateMachine(props.stateMachine, {
                role: role,
                input: events.RuleTargetInput.fromEventPath('$.detail')
            })
        );
    }

    getEventBus(): events.EventBus {
        return this.bus;
    }
}
