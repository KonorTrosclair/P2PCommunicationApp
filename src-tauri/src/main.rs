mod signaling;

use local_ip_address::local_ip;

#[tauri::command]
fn get_local_ip() -> String {
    local_ip().unwrap().to_string()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_local_ip])
        .setup(|_| {
            tauri::async_runtime::spawn(async {
                signaling::start_signaling_server().await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri app");
}
