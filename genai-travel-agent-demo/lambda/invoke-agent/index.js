const { BedrockAgentRuntimeClient, InvokeAgentCommand } = require("@aws-sdk/client-bedrock-agent-runtime");

const bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient();

const AGENT_ID = process.env.AGENT_ID;
const AGENT_ALIAS_ID = process.env.AGENT_ALIAS_ID;


const ENABLE_TRACE = true;

const SESSION_ID_VALID_CHARS = /[^0-9a-zA-Z._:-]/g;


exports.handler = async (event) => {

    try {
        const connectionId = event.connectionId;
        const sessionId = connectionId.replace(SESSION_ID_VALID_CHARS, '');

        const body = event.body;
        const prompt = body.message;
        const action = body.action;

        const completion = await invokeAgent(sessionId, prompt);

        const response = {
            action: action,
            connectionId: connectionId,
            data: completion
        };

        return response;
    } catch(err) {
        console.error(err);
        throw new Error(err);
    }
};


async function invokeAgent(sessionId, prompt) {
    const input = {
        agentId: AGENT_ID,
        agentAliasId: AGENT_ALIAS_ID,
        enableTrace: ENABLE_TRACE,
        sessionId: sessionId,
        inputText: prompt,
        sessionState: {
            promptSessionAttributes: {
                "currentDate": new Date().toISOString().slice(0, 10)
            }
        }
    };

    console.log('Input:', input);

    const command = new InvokeAgentCommand(input);
    const response = await bedrockAgentRuntimeClient.send(command);

    if (response.completion === undefined) {
        throw new Error("Completion is undefined");
    }

    let completion = '';
    for await (let event of response.completion) {
        if(event.chunk) {
            const decodedResponse = new TextDecoder("utf-8").decode(event.chunk.bytes);
            completion += decodedResponse;
        }

        if(event.trace && event.trace.trace.orchestrationTrace && event.trace.trace.orchestrationTrace.rationale) {
            console.log('Rationale:', event.trace.trace.orchestrationTrace.rationale.text);
        }
    }

    console.log('Output:', completion);
    return completion;
}