//************************ UPDATE  ****************************************/

const IOT_ENDPOINT = '<REPLACE_ME>';
const API_ENDPOINT = '<REPLACE_ME>';

//************************ UPDATE  ****************************************/


const WSS_AUTHORIZER_NAME = 'genai-hitl-workflow-iot';
const WSS_CLIENT_ID = 'genai-test-client'
const TOPIC_DATA = 'genai-workflow';
const VIDEO_FILE_S3KEY = "bezos-vogels.mp4"

let wssClient;

$(document).ready(onReady);
let BEDROCK_RESPONSE1 = {};
let BEDROCK_RESPONSE2 = {};
let TOKEN = "";

function onReady() {
    console.log('onReady');

    $("#wssServerUrl").val(IOT_ENDPOINT);
    $("#wssClientId").val(WSS_CLIENT_ID);
    $("#wssAuthorizerName").val(WSS_AUTHORIZER_NAME);
    $("#prompt").val("prompt");

    $("#connectButton").click(connectButtonClicked);
    $("#GenerateButton").click(generateButtonClicked);
    $("#BedrockButton1").click(bedrockButtonClicked1);
    $("#BedrockButton2").click(bedrockButtonClicked2);
    $("#NoButton").click(noButtonClicked);
    
    $("#connectButton").click();
}

function connectButtonClicked() {
    console.log('connectButtonClicked');

    const wssServerUrl = IOT_ENDPOINT;
    const wssClientId = WSS_CLIENT_ID;
    const wssAuthorizerName = WSS_AUTHORIZER_NAME;

    const connectionUrl = `${wssServerUrl}/mqtt?x-amz-customauthorizer-name=${wssAuthorizerName}`;
    console.log(`connectButtonClicked connectionUrl=${connectionUrl}`);
    connect(connectionUrl, wssClientId);
}


function connect(connectionUrl, wssClientId) {
    console.log('connect')
    toggleConfigPane(false, "Connecting...");

    wssClient = mqtt.connect(connectionUrl, {
        clientId: wssClientId,
        reconnectPeriod: 0
    });

    console.debug(wssClient);
    
    wssClient.on('connect', onConnect);
    wssClient.on('message', onMessage);
    wssClient.on('error', onError);
    wssClient.on('close', onClose);
    wssClient.on('offline', onClose);
}

function onConnect() {
    console.log('onConnect subscribing...')
    toggleConfigPane(false, "Subscribing...");
    wssClient.subscribe(TOPIC_DATA, onSubscribe);
}

function onSubscribe(err, granted) {
    console.log('onSubscribe')
    if (err) {
        console.error('onSubscribe error', err);
        toggleConfigPane(true, "Connect");
    } else {
        console.log(`onSubscribe granted=${JSON.stringify(granted)}`);
        toggleConfigPane(false, "Subscribed");
        toggleControlsMessagePane("subscribed");
    }
}

function toggleConfigPane(enabled, buttonText) {
    console.log(`toggleConfigPane enabled=${enabled}`);
    if (enabled) {
        $("#connectButton").text(buttonText).removeClass("disabled");
        $("#configPane input").prop("readonly", false);
    } else {
        $("#connectButton").text(buttonText).addClass("disabled");;
        $("#configPane input").prop("readonly", true);
    }
}

function toggleControlsMessagePane(status) {
    console.log(`toggleControlsMessagePane status=${status}`);
    switch (status) {
        case 'subscribed':
            $("#controlsPane").fadeIn();
            $("#messagesPane").fadeOut();
            $("#waitPane").fadeOut();
            $("#resultPane").fadeOut();
            break;
        case 'wait':
            $("#waitPane").fadeIn();
            $("#controlsPane").fadeOut();
            $("#messagesPane").fadeOut();            
            break;
        case 'message':
            $("#waitPane").fadeOut();
            $("#controlsPane").fadeOut();
            $("#messagesPane").fadeIn();
            break;
        case 'avatar':
            $("#resultPane").fadeIn();
            $("#waitPane").fadeOut();
            $("#messagesPane").fadeOut();
            break;
        default:
            console.errr(`Unsupported status: ${status}`);
    }
}

function generateButtonClicked() {

    const prompt = $("#prompt").val();

    console.log(`generateButtonClicked publishing test action with prompt=${prompt} `);
    const request = {
        message : prompt,
        topic: TOPIC_DATA,
        key:VIDEO_FILE_S3KEY

    }
    callAPI("invokeModel",request)
    
    toggleControlsMessagePane("wait");
}

function bedrockButtonClicked1() {
    console.log('bedrockButtonClicked1');
    const request = {
        output: JSON.stringify({
        message : BEDROCK_RESPONSE1,
        topic: TOPIC_DATA,
        approved: "yes",
        }),
        taskToken:TOKEN,

    }
    disableButtons();
    callAPI("feedback",request);
    toggleControlsMessagePane("wait");
    setResult('bedrock_title1', 'bedrock_desc1');
}

function bedrockButtonClicked2() {
    console.log('bedrockButtonClicked2');

    const request = {
        output: JSON.stringify({
            message : BEDROCK_RESPONSE2,
            topic: TOPIC_DATA,
            approved: "yes",
            }),
        taskToken:TOKEN,
    
    }
    disableButtons()
    callAPI("feedback",request)
    toggleControlsMessagePane("wait");
    setResult('bedrock_title2', 'bedrock_desc2');
}

function setResult(titleId, descriptionId) {
    const title = document.getElementById(titleId).innerText;
    const description = document.getElementById(descriptionId).innerText;
    document.getElementById("result_title").innerText = title;
    document.getElementById("result_description").innerText = description;
}

function noButtonClicked() {
    console.log('noButtonClicked');

    const request = {
        output: JSON.stringify({
            message : "regenerate",
            topic: TOPIC_DATA,
            approved: "no",
            }),
        taskToken:TOKEN

    }
    disableButtons()

    callAPI("feedback",request)

}
function disableButtons() {
    console.log("disable buttons")
    $("#BedrockButton1").class = "disabled"
    $("#BedrockButton2").class = "disabled"
    $("#NoButton").class = "disabled"
}

function callAPI(api, request){
    fetch(API_ENDPOINT+api, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',

        },
        body: JSON.stringify(request)
    })
   .then(response => console.log("response,", JSON.stringify(response)))
}

function onMessage(topic, message) {
    console.log(`onMessage topic=${topic} message=${message}`);
    const messageJson = JSON.parse(message);

    if (messageJson["downloadURL"]) {
        toggleControlsMessagePane("avatar");
        document.getElementById("avatar").src = messageJson["downloadURL"]
    } else {
        TOKEN =  messageJson["token"]
        bedrock1 = jsonPath(messageJson, "$.message[*].Bedrock")[0]
        bedrock2 = jsonPath(messageJson, "$.message[*].Bedrock")[1]

        toggleControlsMessagePane("message");
        formatted_bedrock1 = bedrock1["model_response"].substring(bedrock1["model_response"].indexOf("{"));
        formatted_bedrock2 = bedrock2["model_response"].substring(bedrock2["model_response"].indexOf("{"));

        BEDROCK_RESPONSE1 = JSON.parse(formatted_bedrock1)
        BEDROCK_RESPONSE2 = JSON.parse(formatted_bedrock2)

        document.getElementById("bedrock_title1").innerText = BEDROCK_RESPONSE1["title"]
        document.getElementById("bedrock_title2").innerText = BEDROCK_RESPONSE2["title"]
        document.getElementById("bedrock_desc1").innerText = BEDROCK_RESPONSE1["description"]
        document.getElementById("bedrock_desc2").innerText = BEDROCK_RESPONSE2["description"]

        document.getElementById("bedrock_model1").innerText = bedrock1["model"]
        document.getElementById("bedrock_model2").innerText =  bedrock2["model"]             
    }
}

function onError(err) {
    console.error('onError', err);
}
function onClose(err) {
    console.error('onClose', err);
}