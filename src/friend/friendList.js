import { auth, db } from "../firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

let currentUser = null;
const friendList = document.getElementById("friend-list");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("../auth/login.html");
  } else {
    currentUser = user;
    loadFriends();
  }
});

const loadFriends = async () => {
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  console.log("user doc:", userSnap.data());
  console.log("friends array:", userSnap.data()?.friends);
  const { friends } = userSnap.data();

  friendList.innerHTML = "";

  if (!friends || friends.length === 0) {
    friendList.innerHTML = "<p>No friends yet.</p>";
    return;
  }

  // friends is an array of UIDs, fetch each user's doc to get username
  const friendDocs = await Promise.all(
    friends.map((uid) => getDoc(doc(db, "users", uid)))
  );

  friendDocs.forEach((friendSnap) => {
    if (!friendSnap.exists()) return;

    const { uid, username } = friendSnap.data();

    const item = document.createElement("div");
    item.classList.add("friend-item");
    item.innerHTML = `
      <span>${username}</span>
      <button class="chat-btn" data-uid="${uid}">Message</button>
    `;

    item.querySelector(".chat-btn").onclick = () => {
      openDM(uid);
    };

    friendList.appendChild(item);
  });
};

function openDM(friendUid) {
  const roomId = "dm_" + [currentUser.uid, friendUid].sort().join("_");
  localStorage.setItem("dmRoomId", roomId);
  localStorage.setItem("friendUid", friendUid);
  window.location.href = "../chat/chat.html";
}