const {DynamoDBClient, PutItemCommand, QueryCommand} = require("@aws-sdk/client-dynamodb");
const {marshall, unmarshall} = require("@aws-sdk/util-dynamodb");

const ddbClient = new DynamoDBClient();

const DDB_TABLE_NAME = process.env.DDB_TABLE_NAME;

class Database {
    async insertOrder(order) {
        const input = {
            TableName: DDB_TABLE_NAME,
            Item: marshall(order)
        };

        const command = new PutItemCommand(input);
        await ddbClient.send(command);
    }

    async retrieveOrder(id) {
        const input = {
            TableName: DDB_TABLE_NAME,
            KeyConditionExpression: 'id = :orderId',
            ExpressionAttributeValues: {
                ':orderId': {N: id.toString()}
            },
            ScanIndexForward: false, // Sort descending
            Limit: 1 // Return only the first item
        };
        const command = new QueryCommand(input);
        let orders = await ddbClient.send(command);

        return unmarshall(orders.Items[0]);
    }

}

exports.Database = Database;