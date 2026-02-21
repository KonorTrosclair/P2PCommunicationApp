mod signaling;

use local_ip_address::local_ip;

#[tauri::command]
fn get_local_ip() -> String {
    local_ip().unwrap().to_string()
}

// #[tauri::command]
// fn current_page() -> String {

// }

#[tauri::command]
async fn start_signaling() {
    tauri::async_runtime::spawn(async {
        signaling::start_signaling_server().await;
    });
}

#[tauri::command]
async fn stop_signaling() {
    tauri::async_runtime::spawn(async {
        signaling::stop_signaling_server().await;
    });
}


fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_local_ip,
            start_signaling,
            stop_signaling
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
