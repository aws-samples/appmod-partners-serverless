const {Construct} = require('constructs');
const lambda  = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const eventbridge = require('aws-cdk-lib/aws-events');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const sns = require('aws-cdk-lib/aws-sns');
const snsSub = require('aws-cdk-lib/aws-sns-subscriptions');
const {RemovalPolicy} = require('aws-cdk-lib');

class OrderServiceConstruct extends Construct {
    constructor(scope, id, props) {
        super(scope, id, props);

        const orderLayer = new lambda.LayerVersion(this, 'OrderLayer', {
            code: lambda.Code.fromAsset('lambda/order-service-layer')
        });

        const createOrderLambda = new lambda.Function(this, 'CreateOrderLambda', {
            functionName: 'eda-demo-create-order',
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/order-service/create-order'),
            handler: 'create-order.handler',
            environment: {
                'DDB_TABLE_NAME': props.tableName,
                'EVENT_BUS_NAME': props.eventBusName
            },
            layers: [orderLayer]
        });

        const updateOrderLambda = new lambda.Function(this, 'UpdateOrderLambda', {
            functionName: 'eda-demo-update-order',
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/order-service/update-order'),
            handler: 'update-order.handler',
            environment: {
                'DDB_TABLE_NAME': props.tableName,
                'EVENT_BUS_NAME': props.eventBusName
            },
            layers: [orderLayer]
        });

        const notificationLambda = new lambda.Function(this, 'NotificationLambda', {
            functionName: 'eda-demo-notification',
            runtime: lambda.Runtime.NODEJS_18_X,
            code: lambda.Code.fromAsset('lambda/notification-service'),
            handler: 'index.handler'
        });

        const ordersTable = new dynamodb.Table(this, 'OrderTable', {
            tableName: props.tableName,
            partitionKey: {
                name: 'id',
                type: dynamodb.AttributeType.NUMBER
            },
            sortKey: {
                name: 'timestamp',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY
        });
        ordersTable.grantWriteData(createOrderLambda);
        ordersTable.grantWriteData(updateOrderLambda);
        ordersTable.grantReadData(updateOrderLambda);

        const eventBus = eventbridge.EventBus.fromEventBusName(this,'eventbus', props.eventBusName);
        eventBus.grantPutEventsTo(createOrderLambda);
        eventBus.grantPutEventsTo(updateOrderLambda);

        const notificationTopic = new sns.Topic(this, 'OrderNotificationTopic', {
            topicName: 'eda-demo-order-notification',
            displayName: 'Order Notification',
            fifo: false,
        })
        notificationTopic.addSubscription(new snsSub.EmailSubscription(props.notificationEmail));
        notificationTopic.grantPublish(notificationLambda);
        notificationLambda.addEnvironment('NOTIFICATION_TOPIC_ARN', notificationTopic.topicArn);

        const api = new apigateway.RestApi(this, 'OrderServiceAPI', {
            restApiName: 'Order Service',
            description: 'Order Service API'

        });

        // expose lambda as a rest api endpoint
        const orderResource = api.root.addResource('order');
        orderResource.addMethod('POST', new apigateway.LambdaIntegration(createOrderLambda),{
            proxy: true
        });


    }
}

exports.OrderServiceConstruct = OrderServiceConstruct;