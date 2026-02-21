//use hyper::Server;

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

static SHUTDOWN_TX: OnceLock<Arc<Mutex<Option<oneshot::Sender<()>>>>> = OnceLock::new();
pub type Rooms = Arc<Mutex<HashMap<String, Vec<tokio::sync::mpsc::UnboundedSender<axum::extract::ws::Message>>>>>;


#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "join")]
    Join {
        room: String,
    },

    #[serde(rename = "signal")]
    Signal {
        room: String,
        data: serde_json::Value,
    },
}


#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "joined")]
    Joined {
        room: String,
    },

    #[serde(rename = "signal")]
    Signal {
        data: serde_json::Value,
    },

    #[serde(rename = "error")]
    Error {
        message: String,
    },
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

    // Receive messages FROM this client
    while let Some(Ok(msg)) = receiver.next().await {
        let Message::Text(text) = msg else { continue };

        let parsed: ClientMessage = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => continue,
        };

        match parsed {
            ClientMessage::Join { room } => {
                let mut rooms = rooms.lock().unwrap();

                rooms
                    .entry(room.clone())
                    .or_default()
                    .push(tx.clone());

                current_room = Some(room.clone());

                // Acknowledge join
                let _ = tx.send(Message::Text(
                    serde_json::to_string(
                        &ServerMessage::Joined { room }
                    ).unwrap()
                ));
            }

            ClientMessage::Signal { room, data } => {
                let rooms = rooms.lock().unwrap();

                if let Some(peers) = rooms.get(&room) {
                    let msg = Message::Text(
                        serde_json::to_string(
                            &ServerMessage::Signal { data }
                        ).unwrap()
                    );

                    for peer in peers {
                        if !peer.same_channel(&tx) {
                            let _ = peer.send(msg.clone());
                        }
                    }
                }
            }
        }
    }

    // Cleanup on disconnect
    if let Some(room) = current_room {
        let mut rooms = rooms.lock().unwrap();
        if let Some(peers) = rooms.get_mut(&room) {
            peers.retain(|p| !p.same_channel(&tx));
        }
    }

    send_task.abort();
}


async fn ws_handler(
    ws: WebSocketUpgrade,
    Extension(rooms): Extension<Rooms>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        handle_socket(socket, rooms).await;
    })
}
//use axum::{Router, routing::get, extract::Extension};
//use std::{collections::HashMap, sync::{Arc, Mutex}};


use std::net::SocketAddr;

pub async fn start_signaling_server() {
    let rooms: Rooms = Arc::new(Mutex::new(HashMap::new()));

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .layer(axum::extract::Extension(rooms));

    let addr: SocketAddr = "0.0.0.0:3000".parse().unwrap();

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    let (tx, rx) = oneshot::channel::<()>();

    let shutdown_store = SHUTDOWN_TX.get_or_init(|| {
        Arc::new(Mutex::new(None))
    });

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


