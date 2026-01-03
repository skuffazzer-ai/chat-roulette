const express = require("express");
const WebSocket = require("ws");

const app = express();
app.use(express.static("public"));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log("Server started on port", process.env.PORT || 3000);
});

const wss = new WebSocket.Server({ server });

// ===== Модерация =====
const activeUsers = new Map(); // ws → { id, complaints }
const complaintsLog = [];       // { fromId, toId, reason, timestamp }
let userCounter = 1;

let waitingUser = null;

wss.on("connection", (ws) => {
  ws.partner = null;
  ws.id = userCounter++;
  activeUsers.set(ws, { id: ws.id, complaints: 0 });

  // ===== Matchmaking =====
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
    const data = JSON.parse(msg.toString());

    // ===== Жалобы =====
    if(data.type === "report" && ws.partner){
      complaintsLog.push({
        fromId: ws.id,
        toId: ws.partner.id,
        reason: data.reason || "Нарушение правил",
        timestamp: Date.now()
      });

      // Увеличиваем счётчик жалоб партнёра
      const partnerData = activeUsers.get(ws.partner);
      if(partnerData) partnerData.complaints++;

      // Уведомления
      ws.send(JSON.stringify({ type:"alert", message:"Жалоба отправлена" }));
      ws.partner.send(JSON.stringify({ type:"alert", message:"На вас поступила жалоба" }));
      return;
    }

    // ===== Авто-фильтр =====
    if(data.type === "chat" && ws.partner){
      const bannedWords = ["плохое1","плохое2","плохое3"];
      const lower = data.message.toLowerCase();
      const containsBanned = bannedWords.some(w => lower.includes(w));
      if(containsBanned){
        ws.send(JSON.stringify({ type:"alert", message:"Сообщение содержит запрещённые слова" }));
        return;
      }
      ws.partner.send(JSON.stringify(data));
      return;
    }

    // ===== Остальная логика WebRTC =====
    if(ws.partner){
      try{ ws.partner.send(msg.toString()); } catch(e){ console.log(e); }
    }
  });

  ws.on("close", () => {
    activeUsers.delete(ws);
    if(ws === waitingUser) waitingUser = null;
    if(ws.partner){
      ws.partner.send(JSON.stringify({ type:"leave" }));
      ws.partner.partner = null;
    }
  });
});
