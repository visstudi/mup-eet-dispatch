const REDIRECT_URL = "../pages/routes.html";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const loginValue = document.getElementById("login").value.trim();
      const passwordValue = document.getElementById("password").value.trim();
      const submitBtn = document.getElementById("submit-btn");
      const errorMsg = document.getElementById("error-message");

      errorMsg.style.display = "none";
      submitBtn.disabled = true;
      submitBtn.textContent = "Загрузка...";

      try {
        const response = await fetch(`${API_URL}/Authorization/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "*/*" },
          body: JSON.stringify({ login: loginValue, password: passwordValue }),
        });

        if (
          response.status === 400 ||
          response.status === 401 ||
          response.status === 404
        ) {
          throw new Error("Неверный логин или пароль");
        }

        if (!response.ok) {
          throw new Error(`Ошибка сервера: код ${response.status}`);
        }

        const token = await response.text();

        localStorage.setItem("auth_token", token);

        window.location.href = REDIRECT_URL;
      } catch (error) {
        console.error("Ошибка авторизации:", error);

        if (error.message === "Failed to fetch") {
          alert("Ошибка сети! Сервер недоступен.");
          errorMsg.textContent = "Ошибка сети.";
        } else {
          alert(`Внимание: ${error.message}`);
          errorMsg.textContent = error.message;
        }

        errorMsg.style.display = "block";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Войти";
      }
    });
  }
});
