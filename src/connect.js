const ip = document.getElementById('server-ip');
const ipForm = document.getElementById('ip-form');

//export let serverIp = '';

ipForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // if (!invoke) {
    //     console.error("Tauri API still not found. Check if you are running in a real Tauri window.");
    //     alert("Error: Tauri API not found.");
    //     return;
    // }

    const text = ip.value.trim(); 
    if (!text) return; 

    try {
        localStorage.setItem('connectIp', text);
        window.location.href = 'chatClient.html';
    } catch (err) {
        console.error('Invoke failed:', err);
    }
})




    