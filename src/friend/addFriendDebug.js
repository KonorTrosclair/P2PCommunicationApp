import { auth, db } from "../firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

const addTestBtn = document.getElementById("addTestBtn");
const recipientInput = document.getElementById("recipientUid");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const currentUserSnap = await getDoc(doc(db, "users", user.uid));
  const currentUsername = currentUserSnap.data().username;

  addTestBtn.onclick = async () => {
    const recipientUid = recipientInput.value.trim();
    if (!recipientUid) {
      console.error("No UID entered");
      return;
    }

    try {
      console.log("Sending request from:", user.uid, "to:", recipientUid);
      await updateDoc(doc(db, "users", recipientUid), {
        friendRequests: arrayUnion({
          uid: user.uid,
          username: currentUsername
        })
      });
      console.log("Request sent!");
    } catch (err) {
      console.error("Failed:", err.message);
    }
  };
});