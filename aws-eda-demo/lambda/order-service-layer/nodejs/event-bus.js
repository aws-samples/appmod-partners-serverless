const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");
const ebClient = new EventBridgeClient();

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;

class EventBus {
    async publishOrderEvent(order) {
        const input = {
            Entries: [
                {
                    Source: "order-service",
                    DetailType: order.status,
                    EventBusName: EVENT_BUS_NAME,
                    Detail: JSON.stringify({
                        id: order.id,
                        amount: order.amount
                    })
                }
            ]
        };
        const command = new PutEventsCommand(input);
        await ebClient.send(command);
    }
}

exports.EventBus = EventBus;