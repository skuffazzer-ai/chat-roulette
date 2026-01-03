const express = require("express");
const WebSocket = require("ws");
const path = require("path");

const app = express();
app.use(express.static("public"));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log("Server started on port", process.env.PORT || 3000);
});

const wss = new WebSocket.Server({ server });

let waitingUser = null;
const reports = {};
const bans = {};

wss.on("connection", (ws) => {
  ws.partner = null;

  if(bans[ws.id] && bans[ws.id] > Date.now()){
    ws.send(JSON.stringify({type:"banned"}));
    ws.close();
    return;
  }

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
    try{
      const data = JSON.parse(msg.toString());

      if(data.type==="chat" && ws.partner){
        ws.partner.send(JSON.stringify({ type:"chat", message:data.message }));
      }

      if(data.type==="report-user" && ws.partner){
        const reportedId = data.reportedUserId;
        if(!reports[reportedId]) reports[reportedId] = [];
        reports[reportedId].push({from: ws.id, reason: data.reason, time: Date.now()});

        if(data.reason==="minor") bans[reportedId] = Date.now() + 24*60*60*1000;

        if(reports[reportedId].length>=3 && ws.partner){
          ws.partner.send(JSON.stringify({type:"force-disconnect"}));
        }
      }

    } catch(e){ console.log("Ошибка обработки сообщения:", e); }
  });

  ws.on("close", () => {
    if(ws===waitingUser) waitingUser=null;
    if(ws.partner){
      ws.partner.send(JSON.stringify({ type:"leave" }));
      ws.partner.partner=null;
    }
  });
});
