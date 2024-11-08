// config
const WEBSOCKET_URL = 'REPLACE_ME_WITH_API_GATEWAY_ENDPOINT_OUTPUT';

// backend constants
const WEBSOCKET_IMAGE_ACTION_KEY = 'image';
const WEBSOCKET_AGENT_ACTION_KEY = 'agent';

// frontend constants
const SENDER_AGENT = 'Agent';
const SENDER_CLIENT = 'You';

// frontend components
const dropArea = document.getElementById('drop-area');
const preview = document.getElementById('preview');
const messages = document.getElementById('messages');
const loader = document.getElementById('loader');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
// runtime vars
let socket;
let waitingForResponse = false;
let context = { sent: false, message: ''};

// WebSocket connection
function connectWebSocket() {
    socket = new WebSocket(WEBSOCKET_URL);

    socket.onopen = () => {
        console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
        loader.style.display = 'none';

        const message = JSON.parse(event.data);
        const data = message.data;
        console.log(`Incoming message: `, message);
        displayMessage(SENDER_AGENT, data);
        if(message.action === WEBSOCKET_IMAGE_ACTION_KEY) {
            context.message = data;
        }
        waitingForResponse = false;
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onclose = (event) => {
        console.log('WebSocket disconnected', event);
    };
}

// Drag and drop functionality
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    dropArea.classList.add('highlight');
}

function unhighlight() {
    dropArea.classList.remove('highlight');
}

dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    handleFile(file);
}

function handleFile(file) {
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const size = e.total;
            // API Gateway WSS Payload Quota Limit
            if(size > 30000) {
                alert('Error: Image size exceeds the limit of 30kb.');
            } else {
                const label = dropArea.firstElementChild;
                dropArea.removeChild(label);
                preview.src = e.target.result;
                preview.style.display = 'block';
                // remove metadata to avoid issues with bedrock
                const base64Image = e.target.result.replace(/^data:image\/[a-z]+;base64,/, '');
                const imageData = {type: file.type, name: file.name, data: base64Image};

                uploadImage(imageData);
            }
        };

        reader.readAsDataURL(file); // read file in base64 format
    } else {
        alert('Please drop an image file.');
    }
}

function uploadImage(imageData) {
    sendToWebsocket(WEBSOCKET_IMAGE_ACTION_KEY, imageData);
    waitingForResponse = true;
}

// Chat functionality
function displayMessage(sender, message) {
    const messageElement = document.createElement('pre');
    if(sender === SENDER_CLIENT) {
        messageElement.className = 'client-message';
    }
    messageElement.textContent = `${message}`;
    messages.appendChild(messageElement);
    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth' // Smooth scrolling
    });
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    let prompt = userInput.value.trim();
    if (prompt && !waitingForResponse) {
        displayMessage(SENDER_CLIENT, prompt);
        // first message you add context to the user prompt
        if(!context.sent) {
            prompt = `prompt: ${prompt} \n context: ${context.message}`;
            context.sent = true;
        }

        sendToWebsocket(WEBSOCKET_AGENT_ACTION_KEY, prompt);
        userInput.value = '';
        userInput.disabled = true;
        sendBtn.disabled = true;
        waitingForResponse = true;
    }
}

function sendToWebsocket(action, message) {
    loader.style.display = 'block';
    const payload = JSON.stringify({action: action, message: message});
    //if(action === WEBSOCKET_AGENT_ACTION_KEY) console.log(payload);
    socket.send(payload);
}

// Initialize WebSocket connection
connectWebSocket();