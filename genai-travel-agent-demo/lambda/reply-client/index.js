const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi"); // CommonJS import

//API_ENDPOINT
const endpoint = process.env.API_GATEWAY_ENDPOINT;

exports.handler = async (event) => {
    console.log(event);

    try {
        const connectionId = event.connectionId;
        const action = event.action;
        const data = event.data;

        await postDataOnWebSocket(connectionId, action, data);
        console.log("WebSocket message sent successfully!");
    } catch (error) {
        console.error("Error sending WebSocket message:", error);
        throw new Error(error);
    }

    return {"message":"sent"};
};

async function postDataOnWebSocket(connectionId, action, data) {
    const client = new ApiGatewayManagementApiClient({
        endpoint: endpoint
    });

    const message = {
        action: action,
        data: data
    };

    const command = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
    });

    await client.send(command);
}
