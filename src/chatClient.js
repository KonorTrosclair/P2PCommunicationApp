// chat.js
//import { serverIp } from "./connect.js";

async function initChat() {
    const room = localStorage.getItem('room') || 'test';
    const messagesDiv = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');

    // 1. Safe Invoke Resolution
    const tauri = window.__TAURI__;
    const invoke = tauri?.core?.invoke || tauri?.invoke;

    if (!invoke) {
        console.error("Tauri API not found.");
        displayMessage("System Error: Tauri not initialized", "peer");
        return;
    }

    try {
        // 2. Get IP and connect
        const ip = localStorage.getItem('connectIp');
        console.log("Local IP:", ip);
        const ws = new WebSocket(`ws://${ip}:3000/ws`);

        ws.onopen = () => {
            console.log('Connected');
            ws.send(JSON.stringify({ type: 'join', room }));
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'signal' && msg.data.kind === 'chat') {
                displayMessage(msg.data.text, 'peer');
            }
        };

        ws.onclose = () => displayMessage('Disconnected from server', 'peer');
        ws.onerror = (err) => console.error('WebSocket Error:', err);

        // 3. Form Listener
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = messageInput.value.trim(); 
            if (!text || ws.readyState !== WebSocket.OPEN) return;

            ws.send(JSON.stringify({
                type: 'signal',
                room,
                data: { kind: 'chat', text }
            }));

            displayMessage(text, 'self');
            messageInput.value = '';
        });

    } catch (err) {
        console.error("Failed to invoke get_local_ip:", err);
        displayMessage("Error: Could not reach Rust backend", "peer");
    }
}

function displayMessage(text, type) {
    const messagesDiv = document.getElementById('messages');
    const div = document.createElement('div');
    div.textContent = text;
    div.className = type;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Start the app
initChat();
