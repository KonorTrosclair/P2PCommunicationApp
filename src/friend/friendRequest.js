import { auth, db } from "../firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, writeBatch } from "firebase/firestore";

let currentUser = null;
const requestsList = document.getElementById("requests-list");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("../auth/login.html");
  } else {
    currentUser = user;
    loadRequests();
  }
});

const loadRequests = async () => {
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  const { friendRequests } = userSnap.data();

  requestsList.innerHTML = "";

  if (!friendRequests || friendRequests.length === 0) {
    requestsList.innerHTML = "<p>No pending friend requests.</p>";
    return;
  }

  friendRequests.forEach((request) => {
    const item = document.createElement("div");
    item.classList.add("request-item");
    item.innerHTML = `
      <span>${request.username}</span>
      <button class="accept-btn" data-uid="${request.uid}">Accept</button>
      <button class="decline-btn" data-uid="${request.uid}">Decline</button>
    `;

    item.querySelector(".accept-btn").onclick = async () => {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", currentUser.uid), {
        friends: arrayUnion(request.uid),
        friendRequests: arrayRemove(request)
      });
      batch.update(doc(db, "users", request.uid), {
        friends: arrayUnion(currentUser.uid)
      });
      await batch.commit();
      item.innerHTML = `<span>${request.username} — Added!</span>`;
    };

    item.querySelector(".decline-btn").onclick = async () => {
      await updateDoc(doc(db, "users", currentUser.uid), {
        friendRequests: arrayRemove(request)
      });
      item.remove();
    };

    requestsList.appendChild(item);
  });
};