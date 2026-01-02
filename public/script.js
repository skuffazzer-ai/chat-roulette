let localStream;
let peer;
let socket;
let usingFrontCamera = true;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const nextBtn = document.getElementById("nextBtn");
const flipBtn = document.getElementById("flipBtn");
const micBtn = document.getElementById("micBtn");

const likeBtn = document.getElementById("likeBtn");
const reportBtn = document.getElementById("reportBtn");
const muteBtn = document.getElementById("muteBtn");
const giftBtn = document.getElementById("giftBtn");

const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatOverlay = document.getElementById("chatMessagesOverlay");
const sendBtn = document.getElementById("sendBtn");

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ======== Видео ========
async function getCameraStream() {
  if(localStream) localStream.getTracks().forEach(t => t.stop());

  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: usingFrontCamera ? "user" : "environment" },
    audio: true
  });
  localVideo.srcObject = localStream;

  if(peer){
    const senders = peer.getSenders().filter(s => s.track.kind === 'video');
    senders.forEach((s, i) => s.replaceTrack(localStream.getVideoTracks()[i]));
  }
}

// Показываем/скрываем кнопки после Start
function showCallButtons(show){
  [flipBtn, micBtn, stopBtn, nextBtn, likeBtn, reportBtn, muteBtn, giftBtn].forEach(b => b.style.display = show ? "block" : "none");
  startBtn.style.display = show ? "none" : "block";
}

// ======== Start/Stop/Next ========
startBtn.onclick = async () => {
  showCallButtons(true);
  await getCameraStream();

  socket = new WebSocket(location.protocol === "https:" ? `wss://${location.host}` : `ws://${location.host}`);

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if(data.type === "match") setTimeout(() => createPeer(data.role === "caller"), 100);

    if(data.sdp && peer){
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if(data.sdp.type === "offer"){
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({ sdp: peer.localDescription }));
      }
    }

    if(data.candidate && peer){
      try { await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); }
      catch(e){ console.log("Ошибка ICE:", e); }
    }

    if(data.type === "chat") appendMessage("Собеседник", data.message);
    if(data.type === "leave") stopCall();
  };
};

stopBtn.onclick = stopCall;
nextBtn.onclick = () => {};

flipBtn.onclick = () => { usingFrontCamera = !usingFrontCamera; getCameraStream(); };

let micOn = true;
micBtn.onclick = () => { micOn = !micOn; localStream.getAudioTracks()[0].enabled = micOn; micBtn.textContent = micOn ? "🎤" : "🔇"; };

muteBtn.onclick = () => {
  if(remoteVideo.srcObject){
    remoteVideo.srcObject.getAudioTracks().forEach(t => t.enabled = !t.enabled);
  }
};

[likeBtn, reportBtn, giftBtn].forEach(b => b.onclick = () => {});

// ======== Peer ========
function createPeer(isCaller){
  peer = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  peer.ontrack = e => remoteVideo.srcObject = e.streams[0];
  peer.onicecandidate = e => { if(e.candidate) socket.send(JSON.stringify({ candidate: e.candidate })); };

  if(isCaller){
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: offer }));
    });
  }
}

// ======== Чат ========
function appendMessage(sender, text){
  const div1 = document.createElement("div");
  div1.className = "chat-message";
  div1.textContent = `${sender}: ${text}`;
  chatMessages.appendChild(div1);

  const div2 = div1.cloneNode(true);
  chatOverlay.appendChild(div2);

  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatOverlay.scrollTop = chatOverlay.scrollHeight;
}

function sendMessage(){
  const msg = chatInput.value.trim();
  if(!msg) return;

  if(socket) socket.send(JSON.stringify({ type: "chat", message: msg }));

  appendMessage("Вы", msg);
  chatInput.value = "";
  chatInput.focus(); // клавиатура остаётся открытой
}

// Открытие прозрачного чата при фокусе
chatInput.addEventListener("focus", () => {
  chatOverlay.style.display = "block";
  chatOverlay.scrollTop = chatOverlay.scrollHeight;
});

// Закрытие прозрачного чата при blur
chatInput.addEventListener("blur", () => {
  chatOverlay.style.display = "none";
});

sendBtn.onclick = sendMessage;
chatInput.addEventListener("keypress", e => { if(e.key === "Enter") sendMessage(); });

// ======== Стоп ========
function stopCall(){
  showCallButtons(false);

  if(peer) peer.close();
  if(socket) socket.close();
  if(localStream) localStream.getTracks().forEach(t => t.stop());

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
  chatOverlay.innerHTML = "";
}
