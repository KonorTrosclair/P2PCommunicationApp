import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyBF3ko59jvnUloJQdgE5yNBjrB_i6L3nDM",
  authDomain: "hybridcommunicationapp.firebaseapp.com",
  projectId: "hybridcommunicationapp",
  storageBucket: "hybridcommunicationapp.firebasestorage.app",
  messagingSenderId: "407637148721",
  appId: "1:407637148721:web:fe5d22f3bdcd4cfd8d8110"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

