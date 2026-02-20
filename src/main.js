

// const ip = await window.__TAURI__.invoke("get_local_ip");
// const ws = new WebSocket(`ws://${ip}:3000/ws`);

// ws.onopen = () => {
//   ws.send(JSON.stringify({
//     type: "join",
//     room: "test"
//   }));
// };

// ws.onmessage = (e) => {
//   console.log("signal:", JSON.parse(e.data));
// };
