const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const snsClient = new SNSClient();

const NOTIFICATION_TOPIC_ARN = process.env.NOTIFICATION_TOPIC_ARN;


exports.handler = async (event) => {
     const input = {
         Message: JSON.stringify({
             source: event.source,
             event: event['detail-type'],
             order: event.detail.id,
             time: event.time
         }, null, 2),
         TopicArn: NOTIFICATION_TOPIC_ARN
     };

    const command = new PublishCommand(input);
    const response = await snsClient.send(command);

    return {statusCode: 200};
}