// connect.js
const connectBtn = document.getElementById('connect');
const hostBtn = document.getElementById('host');

// const ip = document.getElementById('server-ip');
// const ipForm = document.getElementById('ip-form');

// ipForm.addEventListener('submit', (e) => {
//     e.preventDefault();
//     const text = ip.value.trim(); 
//     if (!text) return;
//     localStorage.setItem('serverIp', text);
// })

hostBtn.onclick = async (e) => {
    e.preventDefault();

    // Resolve invoke ONLY when clicked
    const tauri = window.__TAURI__;
    const invoke = tauri?.core?.invoke || tauri?.invoke;

    if (!invoke) {
        console.error("Tauri API still not found. Check if you are running in a real Tauri window.");
        alert("Error: Tauri API not found.");
        return;
    }

    try {
        const ip = await invoke("get_local_ip");
        localStorage.setItem('serverIp', ip);
        window.location.href = 'chatHost.html';
    } catch (err) {
        console.error('Invoke failed:', err);
    }
};

connectBtn.onclick = async (e) => {
    e.preventDefault();

    // Resolve invoke ONLY when clicked
    const tauri = window.__TAURI__;
    const invoke = tauri?.core?.invoke || tauri?.invoke;

    if (!invoke) {
        console.error("Tauri API still not found. Check if you are running in a real Tauri window.");
        alert("Error: Tauri API not found.");
        return;
    }

    try {
        window.location.href = 'connectPage.html';
    } catch (err) {
        console.error('Invoke failed:', err);
    }
};
