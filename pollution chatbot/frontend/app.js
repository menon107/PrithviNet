const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

const API_URL = 'http://localhost:8000/chat';

function appendMessage(role, text, metadata = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Use marked.js for full markdown support (tables, lists, bold, etc.)
    // Safely parse and sanitize the HTML
    const rawHtml = marked.parse(text);
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);
    
    contentDiv.innerHTML = sanitizedHtml;
    
    if (metadata && metadata.retrieved_data_summary) {
        const summary = metadata.retrieved_data_summary;
        const keys = Object.keys(summary);
        if (keys.length > 0) {
            const badge = document.createElement('div');
            badge.className = 'data-badge';
            badge.innerText = `Data Source: ${keys.join(', ')}`;
            contentDiv.appendChild(badge);
        }
    }
    
    messageDiv.appendChild(contentDiv);
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message system loading-msg';
    loadingDiv.innerHTML = `
        <div class="loading">
            <span></span><span></span><span></span>
        </div>
    `;
    chatWindow.appendChild(loadingDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return loadingDiv;
}

async function sendMessage(question) {
    if (!question.trim()) return;

    appendMessage('user', question);
    userInput.value = '';
    
    const loadingMsg = showLoading();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        });

        const data = await response.json();
        chatWindow.removeChild(loadingMsg);

        if (data.answer) {
            appendMessage('system', data.answer, data);
        } else {
            appendMessage('system', 'Sorry, I encountered an error processing your request.');
        }
    } catch (error) {
        chatWindow.removeChild(loadingMsg);
        appendMessage('system', 'Could not connect to the backend assistant. Make sure the server is running on port 8000.');
        console.error('Error:', error);
    }
}

sendBtn.addEventListener('click', () => {
    sendMessage(userInput.value);
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage(userInput.value);
    }
});

function quickAsk(text) {
    userInput.value = text;
    sendMessage(text);
}

// Initial focus
userInput.focus();
