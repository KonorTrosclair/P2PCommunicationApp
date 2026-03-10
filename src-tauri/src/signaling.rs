use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    routing::get,
    extract::Extension,
    Router,
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc;
use tokio::sync::oneshot;
use std::sync::OnceLock;

use std::sync::MutexGuard;
use std::net::SocketAddr;

static SHUTDOWN_TX: OnceLock<Arc<Mutex<Option<oneshot::Sender<()>>>>> = OnceLock::new();
pub type Rooms = Arc<Mutex<HashMap<String, Vec<mpsc::UnboundedSender<Message>>>>>;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "join")]
    Join { room: String },

    #[serde(rename = "signal")]
    Signal { room: String, data: serde_json::Value },

    #[serde(rename = "offer")]
    Offer { room: String, offer: serde_json::Value },

    #[serde(rename = "answer")]
    Answer { room: String, answer: serde_json::Value },

    #[serde(rename = "ice")]
    Ice { room: String, candidate: serde_json::Value },
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "role")]
    Role { initiator: bool },

    #[serde(rename = "joined")]
    Joined { room: String },

    #[serde(rename = "peer-joined")]
    PeerJoined { room: String }, // new

    #[serde(rename = "signal")]
    Signal { data: serde_json::Value },

    #[serde(rename = "error")]
    Error { message: String },
}

pub async fn handle_socket(socket: WebSocket, rooms: Rooms) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // Task: send messages TO this client
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let mut current_room: Option<String> = None;

    while let Some(Ok(msg)) = receiver.next().await {
        let Message::Text(text) = msg else { continue };
        let parsed: ClientMessage = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => continue,
        };

        match parsed {
            ClientMessage::Join { room } => {
                let mut rooms = rooms.lock().unwrap();
                let peers = rooms.entry(room.clone()).or_default();

                let initiator = peers.is_empty();
                println!("Join: room={}, initiator={}, peers_before={}", room, initiator, peers.len()); // add
                // Grab host tx BEFORE pushing new peer
                let host_tx = if !initiator {
                    Some(peers[0].clone())
                } else {
                    None
                };

                peers.push(tx.clone());
                current_room = Some(room.clone());

                // Send role assignment to joining peer
                let _ = tx.send(Message::Text(
                    serde_json::to_string(&ServerMessage::Role { initiator }).unwrap()
                ));

                // Acknowledge join to joining peer
                let _ = tx.send(Message::Text(
                    serde_json::to_string(&ServerMessage::Joined { room: room.clone() }).unwrap()
                ));

                // Notify host that a peer joined
                if let Some(host) = host_tx {
                    println!("Sending peer-joined to host"); // add
                    let _ = host.send(Message::Text(
                        serde_json::to_string(&ServerMessage::PeerJoined { room: room.clone() }).unwrap()
                    ));
                }
            }

            ClientMessage::Signal { room, data } => {
                let rooms_guard = rooms.lock().unwrap();
                forward_to_room(&rooms_guard, &tx, &room, data);
            }

            ClientMessage::Offer { room, offer } => {
                let rooms_guard = rooms.lock().unwrap();
                let data = serde_json::json!({ "type": "offer", "offer": offer });
                println!("Offer sent to room {}: {}", room, data);
                forward_to_room(&rooms_guard, &tx, &room, data);
            }

            ClientMessage::Answer { room, answer } => {
                let rooms_guard = rooms.lock().unwrap();
                let data = serde_json::json!({ "type": "answer", "answer": answer });
                forward_to_room(&rooms_guard, &tx, &room, data);
            }

            ClientMessage::Ice { room, candidate } => {
                let rooms_guard = rooms.lock().unwrap();
                let data = serde_json::json!({ "type": "ice", "candidate": candidate });
                forward_to_room(&rooms_guard, &tx, &room, data);
            }
        }
    }

    // Cleanup
    if let Some(room) = current_room {
        let mut rooms_guard = rooms.lock().unwrap();
        if let Some(peers) = rooms_guard.get_mut(&room) {
            peers.retain(|p| !p.same_channel(&tx));
        }
    }

    send_task.abort();
}

fn forward_to_room(
    rooms: &MutexGuard<'_, HashMap<String, Vec<mpsc::UnboundedSender<Message>>>>,
    sender_tx: &mpsc::UnboundedSender<Message>,
    room: &str,
    data: serde_json::Value,
) {
    if let Some(peers) = rooms.get(room) {
        let msg_text = Message::Text(data.to_string());
        for peer in peers {
            if !peer.same_channel(sender_tx) {
                let _ = peer.send(msg_text.clone());
            }
        }
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    Extension(rooms): Extension<Rooms>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, rooms))
}

pub async fn start_signaling_server() {
    let rooms: Rooms = Arc::new(Mutex::new(HashMap::new()));

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .layer(axum::extract::Extension(rooms));

    let addr: SocketAddr = "0.0.0.0:3000".parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    let (tx, rx) = oneshot::channel::<()>();
    let shutdown_store = SHUTDOWN_TX.get_or_init(|| Arc::new(Mutex::new(None)));
    *shutdown_store.lock().unwrap() = Some(tx);

    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = rx.await;
            println!("Shutting down signaling server...");
        })
        .await
        .unwrap();
}

pub async fn stop_signaling_server() {
    if let Some(store) = SHUTDOWN_TX.get() {
        if let Some(tx) = store.lock().unwrap().take() {
            let _ = tx.send(());
        }
    }
}