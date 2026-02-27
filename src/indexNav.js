// connect.js




// const connectBtn = document.getElementById('connect');
// const hostBtn = document.getElementById('host');

const createAccBtn = document.getElementById('createAcc');
const loginAccBtn = document.getElementById('loginAcc');

createAccBtn.onclick = (e) => {
    e.preventDefault();
    window.location.href = './auth/signup.html';
}

loginAccBtn.onclick = (e) => {
    e.preventDefault();
    window.location.href = './auth/login.html';
}


// hostBtn.onclick = async (e) => {
//     e.preventDefault();

//     // Resolve invoke ONLY when clicked
//     const tauri = window.__TAURI__;
//     const invoke = tauri?.core?.invoke || tauri?.invoke;

//     if (!invoke) {
//         console.error("Tauri API still not found. Check if you are running in a real Tauri window.");
//         alert("Error: Tauri API not found.");
//         return;
//     }

//     try {
//         await invoke("start_signaling");
//         const ip = await invoke("get_local_ip");
//         localStorage.setItem('serverIp', ip);
//         window.location.href = 'chatHost.html';
//     } catch (err) {
//         console.error('Invoke failed:', err);
//     }
// };

// connectBtn.onclick = async (e) => {
//     e.preventDefault();

//     // Resolve invoke ONLY when clicked
//     const tauri = window.__TAURI__;
//     const invoke = tauri?.core?.invoke || tauri?.invoke;

//     if (!invoke) {
//         console.error("Tauri API still not found. Check if you are running in a real Tauri window.");
//         alert("Error: Tauri API not found.");
//         return;
//     }

//     try {
//         window.location.href = 'connectPage.html';
//     } catch (err) {
//         console.error('Invoke failed:', err);
//     }
// };
