document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const messageElem = document.getElementById("message");

  try {
    const response = await fetch("http://localhost:3333/v1/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok && data.status) {
      messageElem.style.color = "green";
      messageElem.textContent = "Login successful!";
      localStorage.setItem("token", data.tokenval2);
      localStorage.setItem("username", data.user?.name || "Admin");
      window.location.href = '/frontend/admin/adminhome.html';
    } else {
      messageElem.style.color = "red";
      messageElem.textContent = data.message || "Login failed";
    }
  } catch (err) {
    messageElem.style.color = "red";
    messageElem.textContent = "Error connecting to server.";
  }
});