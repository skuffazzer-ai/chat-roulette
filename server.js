const express = require("express");
const WebSocket = require("ws");
const path = require("path");

const app = express();
app.use(express.static("public"));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});

const wss = new WebSocket.Server({ server });

let waitingUser = null;

wss.on("connection", (ws) => {
  ws.partner = null;

  if (waitingUser) {
    ws.partner = waitingUser;
    waitingUser.partner = ws;

    ws.send(JSON.stringify({ type: "match" }));
    waitingUser.send(JSON.stringify({ type: "match" }));

    waitingUser = null;
  } else {
    waitingUser = ws;
  }

  ws.on("message", (msg) => {
    if (ws.partner) {
      ws.partner.send(msg.toString());
    }
  });

  ws.on("close", () => {
    if (ws === waitingUser) {
      waitingUser = null;
    }
    if (ws.partner) {
      ws.partner.send(JSON.stringify({ type: "leave" }));
      ws.partner.partner = null;
    }
  });
});
