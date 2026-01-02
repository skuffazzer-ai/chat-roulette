let localStream;
let peer;
let socket;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const sendBtn = document.getElementById("sendBtn");

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ======== Старт видео и подключение к WS ========
startBtn.onclick = async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket = new WebSocket(
    location.protocol === "https:"
      ? `wss://${location.host}`
      : `ws://${location.host}`
  );

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "match") setTimeout(() => createPeer(data.role === "caller"), 100);

    if (data.sdp && peer) {
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({ sdp: peer.localDescription }));
      }
    }

    if (data.candidate && peer) {
      try { await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); }
      catch(e){ console.log("Ошибка ICE:", e); }
    }

    if (data.type === "chat") appendMessage("Собеседник", data.message);

    if (data.type === "leave") stop();
  };
};

// ======== Peer ========
function createPeer(isCaller) {
  peer = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.ontrack = (e) => remoteVideo.srcObject = e.streams[0];

  peer.onicecandidate = (e) => {
    if (e.candidate) socket.send(JSON.stringify({ candidate: e.candidate }));
  };

  if (isCaller) {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: offer }));
    });
  }
}

// ======== Текстовый чат ========
function appendMessage(sender, text){
  const div = document.createElement("div");
  div.className = "chat-message";
  div.textContent = `${sender}: ${text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage(){
  const msg = chatInput.value.trim();
  if(!msg) return;
  appendMessage("Вы", msg);
  socket.send(JSON.stringify({ type: "chat", message: msg }));
  chatInput.value = "";
}

sendBtn.onclick = sendMessage;
chatInput.addEventListener("keypress", e => { if(e.key === "Enter") sendMessage(); });

// ======== Стоп ========
stopBtn.onclick = stop;
function stop(){
  startBtn.disabled = false;
  stopBtn.disabled = true;

  if(peer) peer.close();
  if(socket) socket.close();
  if(localStream) localStream.getTracks().forEach(t=>t.stop());

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
}
