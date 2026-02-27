import { auth, db } from "../firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const connectBtn = document.getElementById('connect');
const hostBtn = document.getElementById('host');

const addFriendBtn = document.getElementById('add-friend');
const friendRequestsBtn = document.getElementById('friend-requests');


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
        await invoke("start_signaling");
        const ip = await invoke("get_local_ip");
        localStorage.setItem('serverIp', ip);
        window.location.href = '../chatHost.html';
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
        window.location.href = '../connectPage.html';
    } catch (err) {
        console.error('Invoke failed:', err);
    }
};

onAuthStateChanged(auth, async (user) => {
  console.log("Auth state changed, user:", user);
  if (!user) {
    window.location.href = "../auth/login.html";
  } else {
    console.log("Fetching Firestore doc for uid:", user.uid);
    const userSnap = await getDoc(doc(db, "users", user.uid));
    console.log("Doc exists:", userSnap.exists());
    console.log("Doc data:", userSnap.data());
    if (userSnap.exists()) {
      const { username } = userSnap.data();
      console.log("Username:", username);
      document.getElementById("current-user").textContent = username;
    }
  }
});

addFriendBtn.onclick = (e) => {
    e.preventDefault();
    window.location.href = '../friend/addFriend.html';
}

friendRequestsBtn.onclick = (e) => {
    e.preventDefault();
    window.location.href = '../friend/friendRequest.html';
}


