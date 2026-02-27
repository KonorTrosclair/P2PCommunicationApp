import { login } from "../firebase/auth.js";

const loginBtn = document.getElementById('login');

loginBtn.onclick = async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await login(email, password);
    console.log("Logged in!");
    window.location.href = "../dashboard/dashboard.html";
  } catch (err) {
    console.error(err.message);
  }
};