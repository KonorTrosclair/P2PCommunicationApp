import { auth, db } from "../firebase/config.js";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

const searchInput = document.getElementById("user");
const resultsList = document.getElementById("search-results");

let debounceTimer;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("../auth/login.html");
    return;
  }

  const currentUserSnap = await getDoc(doc(db, "users", user.uid));
  const currentUsername = currentUserSnap.data().username;

  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {

      const value = searchInput.value.trim();
      resultsList.innerHTML = "";

      if (value.length < 2) return;

      const q = query(
        collection(db, "users"),
        where("username", ">=", value),
        where("username", "<=", value + "\uf8ff")
      );

      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err) {
        console.error("Search failed:", err.message);
        return;
      }

      if (snapshot.empty) {
        resultsList.innerHTML = "<div>No users found</div>";
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.uid === user.uid) return;

        const item = document.createElement("div");
        item.classList.add("search-result-item");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = data.username;

        const addBtn = document.createElement("button");
        addBtn.textContent = "Add";

        addBtn.onclick = async () => {
          console.log("Button clicked, sending from:", user.uid, "to:", data.uid);
          addBtn.disabled = true;
          addBtn.textContent = "Sending...";
          try {
            await updateDoc(doc(db, "users", data.uid), {
              friendRequests: arrayUnion({
                uid: user.uid,
                username: currentUsername
              })
            });
            console.log("Request sent!");
            addBtn.textContent = "Request Sent!";
          } catch (err) {
            console.error("Failed:", err.message);
            addBtn.textContent = "Failed";
            addBtn.disabled = false;
          }
        };

        item.appendChild(nameSpan);
        item.appendChild(addBtn);
        resultsList.appendChild(item);
      });

    }, 300);
  });
});