import { register} from "../firebase/auth.js";

const signupBtn = document.getElementById('signup');

signupBtn.onclick = async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await register(email, password, username);
    console.log("Registered!");
  } catch (err) {
    console.error(err.message);
  }
};