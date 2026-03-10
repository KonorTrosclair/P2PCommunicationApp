// chat.js

let ws;
let peer;
let channel;

let isInitiator = false;


const leaveBtn = document.getElementById('leaveHost') || document.getElementById('leaveClient');

if (leaveBtn) {
    leaveBtn.onclick = async (e) => {
        e.preventDefault();

        if (channel) channel.close();
        if (peer) peer.close();
        if (ws) ws.close();

        const tauri = window.__TAURI__;
        const invoke = tauri?.core?.invoke || tauri?.invoke;

        if (invoke) {
            try {
                await invoke("stop_signaling");
            } catch (err) {
                console.error("Failed to stop signaling:", err);
            }
        }

        window.location.href = '../dashboard/dashboard.html';
    };
}

//const params = new URLSearchParams(window.location.search);

async function initChat() {

    const room = localStorage.getItem('room') || 'test';
    const isHost = sessionStorage.getItem("isHost") === "true";
    console.log("Is host:", isHost);

    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    //console.log("message: ", messageInput);

    const tauri = window.__TAURI__;
    const invoke = tauri?.core?.invoke || tauri?.invoke;

    let ip;

    if (isHost) {
        ip = await invoke("get_local_ip");
        console.log("Host IP:", ip);
    } else {
        ip = localStorage.getItem("connectIp");
        console.log("Connecting to host IP:", ip);
    }

    ip = ip.trim();

    console.log("Connecting to signaling server:", ip);

    ws = new WebSocket(`ws://${ip}:3000/ws`);

    setupPeer();

    ws.onopen = () => {

        ws.send(JSON.stringify({
            type: "join",
            room
        }));
    };


    ws.onmessage = async (event) => {
        console.log("Received message:", event.data);  // <-- this shows EVERYTHING from server

        const msg = JSON.parse(event.data);

        console.log("message type:", msg.type);
        switch (msg.type) {
            case "role":
                isInitiator = msg.initiator;
                console.log("Initiator:", isInitiator);
                console.log("Received role message:", msg);
                if (isInitiator) {
                    //createOffer();
                }
                break;

            case "offer":
                console.log("Received offer:", msg.offer);

                await peer.setRemoteDescription(msg.offer);
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                ws.send(JSON.stringify({
                    type: "answer",
                    room: "test",
                    answer
                }));
                break;
            case "peer-joined":
                console.log("A peer joined, creating offer now...");
                createOffer();
            break;

            case "answer":
                console.log("Received answer:", msg.answer);
                await peer.setRemoteDescription(msg.answer);
                break;

            case "ice":
                await peer.addIceCandidate(msg.candidate);
                break;
        }
    };


    ws.onclose = () => {
        displayMessage("Disconnected from signaling server", "peer");
    };


    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
    };


    chatForm.addEventListener("submit", (e) => {

        e.preventDefault();
        console.log("Form submitted");

        const text = messageInput.value.trim();

        console.log("Text:", text);
        console.log("Channel state:", channel?.readyState);

        if (!text) {
            console.log("No text entered");
            return;
        }

        if (!channel) {
            console.log("Channel not created yet");
            return;
        }

        if (channel.readyState !== "open") {
            console.log("Channel not open:", channel.readyState);
            return;
        }

        channel.send(text);

        console.log("Message sent");

        displayMessage(text, "self");

        messageInput.value = "";
    });
}



function setupPeer() {

    peer = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    peer.onconnectionstatechange = () => {
        console.log("Connection state:", peer.connectionState);
    };

    peer.oniceconnectionstatechange = () => {
        console.log("ICE state:", peer.iceConnectionState);
    };


    peer.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: "ice",
                room: "test", // add this
                candidate: event.candidate
            }));
        }
    };


    peer.ondatachannel = (event) => {
        channel = event.channel;
        setupChannel(); 

        // channel.onopen = () => {
        //     console.log("Client WebRTC channel open");
        // };

        // channel.onmessage = (event) => {
        //     displayMessage(event.data, "peer");
        // };
    };
}



function setupChannel() {
    channel.onopen = () => {
        console.log("Channel open, readyState:", channel.readyState);
    };
    channel.onmessage = (event) => {
        console.log("Message received:", event.data);
        displayMessage(event.data, "peer");
    };
    channel.onclose = () => console.log("Channel closed");
    channel.onerror = (e) => console.error("Channel error:", e);
}



async function createOffer() {
    // Initiator creates channel
    console.log("createOffer called, peer state:", peer?.signalingState);
    channel = peer.createDataChannel("chat");
    console.log("channel created:", channel);
    
    channel.onopen = () => {
        console.log("Host WebRTC channel open");
    };

    channel.onmessage = (event) => {
        displayMessage(event.data, "peer");
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    ws.send(JSON.stringify({
        type: "offer",
        room: "test",
        offer
    }));
}



function displayMessage(text, type) {
    const messagesDiv = document.getElementById("messages");
    const div = document.createElement("div");
    div.textContent = text;
    div.className = type;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}



initChat();