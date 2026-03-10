// chat.js
import { db, auth } from "../firebase/config.js";
import { doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

let ws;
let peer;
let channel;
let isInitiator = false;
let room;
let currentUser = null;

// Firestore signaling mode vs WS mode
const dmRoomId = localStorage.getItem("dmRoomId");
const isDM = !!dmRoomId;

// ─── Leave button ─────────────────────────────────────────────────────────────

const leaveBtn = document.getElementById('leaveHost') || document.getElementById('leaveClient');

if (leaveBtn) {
    leaveBtn.onclick = async (e) => {
        e.preventDefault();

        if (channel) channel.close();
        if (peer) peer.close();
        if (ws) ws.close();

        if (!isDM) {
            const tauri = window.__TAURI__;
            const invoke = tauri?.core?.invoke || tauri?.invoke;
            if (invoke) {
                try {
                    await invoke("stop_signaling");
                } catch (err) {
                    console.error("Failed to stop signaling:", err);
                }
            }
        }

        // Clean up signaling doc when leaving DM
        if (isDM) {
            try {
                await deleteDoc(doc(db, "signaling", dmRoomId));
            } catch (e) {
                console.error("Failed to clean up signaling doc:", e);
            }
        }

        localStorage.removeItem("dmRoomId");
        localStorage.removeItem("friendUid");
        window.location.href = '../dashboard/dashboard.html';
    };
}


// ─── Init ─────────────────────────────────────────────────────────────────────

async function initChat() {
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');

    if (isDM) {
        // Wait for auth then start Firebase signaling
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                window.location.replace("../auth/login.html");
                return;
            }
            currentUser = user;
            setupPeer();
            initFirebaseSignaling();
        });
    } else {
        // Original LAN flow
        room = localStorage.getItem('room') || 'test';
        const isHost = sessionStorage.getItem("isHost") === "true";

        const tauri = window.__TAURI__;
        const invoke = tauri?.core?.invoke || tauri?.invoke;

        let ip;
        if (isHost) {
            ip = await invoke("get_local_ip");
        } else {
            ip = localStorage.getItem("connectIp");
        }

        ip = ip.trim();
        setupPeer();
        initWSSignaling(ip);
    }

    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const text = messageInput.value.trim();
        if (!text) return;

        if (!channel) {
            console.log("Channel not created yet");
            return;
        }

        if (channel.readyState !== "open") {
            console.log("Channel not open:", channel.readyState);
            return;
        }

        channel.send(text);
        displayMessage(text, "self");
        messageInput.value = "";
    });
}


// ─── Firebase signaling ───────────────────────────────────────────────────────

async function initFirebaseSignaling() {
    const signalingRef = doc(db, "signaling", dmRoomId);
    const signalingSnap = await getDoc(signalingRef);

    if (!signalingSnap.exists() || !signalingSnap.data().offer) {
        // No offer exists yet — we are the initiator
        isInitiator = true;
        console.log("Initiator: creating offer");
        await createFirebaseOffer(signalingRef);
    } else {
        // Offer exists — we are the receiver
        isInitiator = false;
        console.log("Receiver: answering offer");
        await answerFirebaseOffer(signalingRef, signalingSnap.data().offer);
    }
}

async function createFirebaseOffer(signalingRef) {
    channel = peer.createDataChannel("chat");
    setupChannel();

    // Collect our ICE candidates into Firestore
    const offerCandidatesRef = collection(signalingRef, "offerCandidates");
    peer.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("Sending ICE candidate (offer side)");
            addDoc(offerCandidatesRef, event.candidate.toJSON());
        }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    await setDoc(signalingRef, {
        offer: { type: offer.type, sdp: offer.sdp },
        fromUid: currentUser.uid
    });

    console.log("Offer written to Firestore, waiting for answer...");

    // Listen for answer
    const unsub = onSnapshot(signalingRef, async (snap) => {
        const data = snap.data();
        if (data?.answer && !peer.currentRemoteDescription) {
            console.log("Answer received");
            await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            unsub();
        }
    });

    // Listen for receiver's ICE candidates
    const answerCandidatesRef = collection(signalingRef, "answerCandidates");
    onSnapshot(answerCandidatesRef, (snap) => {
        snap.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                try {
                    await peer.addIceCandidate(candidate);
                } catch (e) {
                    console.error("ICE error (offer side):", e);
                }
            }
        });
    });
}

async function answerFirebaseOffer(signalingRef, offer) {
    // Collect our ICE candidates into Firestore
    const answerCandidatesRef = collection(signalingRef, "answerCandidates");
    peer.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("Sending ICE candidate (answer side)");
            addDoc(answerCandidatesRef, event.candidate.toJSON());
        }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    await setDoc(signalingRef, {
        answer: { type: answer.type, sdp: answer.sdp }
    }, { merge: true });

    console.log("Answer written to Firestore");

    // Listen for initiator's ICE candidates
    const offerCandidatesRef = collection(signalingRef, "offerCandidates");
    onSnapshot(offerCandidatesRef, (snap) => {
        snap.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                try {
                    await peer.addIceCandidate(candidate);
                } catch (e) {
                    console.error("ICE error (answer side):", e);
                }
            }
        });
    });
}


// ─── WS signaling (LAN) ───────────────────────────────────────────────────────

function initWSSignaling(ip) {
    ws = new WebSocket(`ws://${ip}:3000/ws`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", room }));
    };

    ws.onmessage = async (event) => {
        console.log("RAW MESSAGE:", event.data);
        const msg = JSON.parse(event.data);

        switch (msg.type) {
            case "role":
                isInitiator = msg.initiator;
                console.log("Initiator:", isInitiator);
                break;

            case "peer-joined":
                console.log("A peer joined, creating offer now...");
                createWSOffer();
                break;

            case "offer":
                console.log("Received offer");
                await peer.setRemoteDescription(msg.offer);
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", room, answer }));
                break;

            case "answer":
                console.log("Received answer");
                await peer.setRemoteDescription(msg.answer);
                break;

            case "ice":
                try {
                    await peer.addIceCandidate(msg.candidate);
                } catch (e) {
                    console.error("ICE error:", e);
                }
                break;
        }
    };

    ws.onclose = () => displayMessage("Disconnected from signaling server", "peer");
    ws.onerror = (err) => console.error("WebSocket error:", err);
}

async function createWSOffer() {
    console.log("createOffer called, peer state:", peer?.signalingState);
    channel = peer.createDataChannel("chat");
    setupChannel();

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    ws.send(JSON.stringify({ type: "offer", room, offer }));
}


// ─── Peer ─────────────────────────────────────────────────────────────────────

function setupPeer() {
    peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peer.onconnectionstatechange = () => {
        console.log("Connection state:", peer.connectionState);
    };

    peer.oniceconnectionstatechange = () => {
        console.log("ICE state:", peer.iceConnectionState);
    };

    // Default WS ICE handler — overridden per-flow in Firebase mode
    peer.onicecandidate = (event) => {
        if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ice", room, candidate: event.candidate }));
        }
    };

    // Non-initiator receives channel
    peer.ondatachannel = (event) => {
        channel = event.channel;
        setupChannel();
    };
}

function setupChannel() {
    channel.onopen = () => console.log("Channel open, readyState:", channel.readyState);
    channel.onmessage = (event) => {
        console.log("Message received:", event.data);
        displayMessage(event.data, "peer");
    };
    channel.onclose = () => console.log("Channel closed");
    channel.onerror = (e) => console.error("Channel error:", e);
}


// ─── Display ──────────────────────────────────────────────────────────────────

function displayMessage(text, type) {
    const messagesDiv = document.getElementById("messages");
    const div = document.createElement("div");
    div.textContent = text;
    div.className = type;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


initChat();