/* ================== PUSH ОБНОВЛЕНИЕ ================== */
// Сервер должен прислать: { type: "reload" }
const ws = new WebSocket(
  (location.protocol === "https:" ? "wss://" : "ws://") + location.host
);

ws.onmessage = (e) => {
  try {
    const data = JSON.parse(e.data);
    if (data.type === "reload") {
      location.reload();
    }
  } catch {}
};

/* ================== ЧАТ + КЛАВИАТУРА ================== */
const input = document.getElementById("chatInput");
const messages = document.getElementById("messages");
const videos = document.getElementById("videos");

let overlay = null;
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* Открыли клавиатуру */
input.addEventListener("focus", () => {
  if (!isMobile) return;

  document.body.style.overflow = "hidden";
  videos.style.height = "50vh";
  messages.style.display = "none";

  overlay = document.createElement("div");
  overlay.id = "overlayMessages";
  videos.appendChild(overlay);
});

/* Печать */
input.addEventListener("input", () => {
  if (!overlay) return;
  overlay.innerHTML = "";

  if (input.value.trim()) {
    const msg = document.createElement("div");
    msg.className = "overlay-msg";
    msg.textContent = input.value;
    overlay.appendChild(msg);
  }
});

/* Отправка */
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && input.value.trim()) {
    const div = document.createElement("div");
    div.textContent = input.value;
    messages.appendChild(div);

    input.value = "";
    if (overlay) overlay.innerHTML = "";
  }
});

/* Закрыли клавиатуру */
input.addEventListener("blur", () => {
  if (!isMobile) return;

  document.body.style.overflow = "";
  videos.style.height = "60vh";
  messages.style.display = "block";

  if (overlay) {
    overlay.remove();
    overlay = null;
  }
});
