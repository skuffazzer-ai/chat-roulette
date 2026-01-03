const express = require("express");
const WebSocket = require("ws");

const app = express();
app.use(express.static("public"));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log("Server started on port", process.env.PORT || 3000);
});

const wss = new WebSocket.Server({ server });

let waitingUser = null;

wss.on("connection", (ws) => {
  ws.partner = null;

  if (waitingUser) {
    ws.partner = waitingUser;
    waitingUser.partner = ws;

    ws.send(JSON.stringify({ type: "match", role: "caller" }));
    waitingUser.send(JSON.stringify({ type: "match", role: "callee" }));

    waitingUser = null;
  } else {
    waitingUser = ws;
  }

  ws.on("message", (msg) => {
    if (!ws.partner) return;
    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "chat") {
        ws.partner.send(JSON.stringify({ type: "chat", message: data.message }));
      } else if (data.type === "moderation_log") {
        console.log("Нарушение модерации:", data.message);
      } else if (data.type === "report") {
        console.log("Пользователь получил жалобу, отключаем его от партнёра");
        if (ws.partner) {
          ws.partner.send(JSON.stringify({ type: "leave" }));
          ws.partner.partner = null;
        }
        ws.close();
      } else if (data.type === "leave") {
        ws.partner.send(JSON.stringify({ type: "leave" }));
        ws.partner.partner = null;
      } else {
        ws.partner.send(msg.toString());
      }
    } catch (e) {
      console.log("Ошибка при обработке сообщения:", e);
    }
  });

  ws.on("close", () => {
    if (ws === waitingUser) waitingUser = null;
    if (ws.partner) {
      ws.partner.send(JSON.stringify({ type: "leave" }));
      ws.partner.partner = null;
    }
  });
});
