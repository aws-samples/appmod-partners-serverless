const crypto = require('crypto');
const {
    DynamoDBClient,
    ScanCommand,
    GetItemCommand,
    PutItemCommand,
    DeleteItemCommand
} = require('@aws-sdk/client-dynamodb');
const {marshall, unmarshall} = require("@aws-sdk/util-dynamodb");

const DDB_TABLE = process.env.DDB_TABLE;

const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    console.log(event);
    let response;
    try {
        const id = (event.pathParameters) ? event.pathParameters.id : undefined;

        switch (event.httpMethod) {
            case 'GET':
                response = (id) ?
                    await getItem(id) :
                    await getAllItems();
                break;
            case 'POST':
                response = await createItem(JSON.parse(event.body));
                break;
            case 'PUT':
                response = await updateItem(JSON.parse(event.body));
                break;
            case 'DELETE':
                response = await deleteItem(id);
                break;
            default:
                throw new Error(`Unsupported method: ${event.httpMethod}`);
        }
        return response;
    } catch (err) {
        console.error(err);
        return {statusCode: 500, body: {error: err}};
    }
};

async function getAllItems() {
    const params = {
        TableName: DDB_TABLE
    };
    const {Items} = await dynamoDbClient.send(new ScanCommand(params));
    return {statusCode: 200, body: JSON.stringify(Items.map((item) => unmarshall(item)))};
}

async function createItem(item) {
    item.id = crypto.randomUUID();
    const params = {
        TableName: DDB_TABLE,
        Item: marshall(item)
    };
    await dynamoDbClient.send(new PutItemCommand(params));
    return {statusCode: 201, body: JSON.stringify(item)};
}

async function updateItem(item) {
    const params = {
        TableName: DDB_TABLE,
        Item: marshall(item)
    };
    await dynamoDbClient.send(new PutItemCommand(params));
    return {statusCode: 200, body: JSON.stringify(item)};
}

async function getItem(id) {
    const params = {
        TableName: DDB_TABLE,
        Key: marshall({id})
    };
    const {Item} = await dynamoDbClient.send(new GetItemCommand(params));
    if (Item) {
        return {statusCode: 200, body: JSON.stringify(unmarshall(Item))};
    } else {
        return {statusCode: 404};
    }
}

async function deleteItem(id) {
    const params = {
        TableName: DDB_TABLE,
        Key: marshall({id})
    };
    await dynamoDbClient.send(new DeleteItemCommand(params));
    return {statusCode: 204};
}