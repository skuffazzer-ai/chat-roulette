let localStream;
let peer;
let socket;
let usingFrontCamera = true;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Кнопки
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
const sendBtn = document.getElementById("sendBtn");

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ======== Видео и WebSocket ========
async function getCameraStream() {
  if(localStream){
    localStream.getTracks().forEach(t => t.stop());
  }
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

startBtn.onclick = async () => {
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  nextBtn.style.display = "block";

  flipBtn.style.display = "block";
  micBtn.style.display = "block";

  likeBtn.style.display = "block";
  reportBtn.style.display = "block";
  muteBtn.style.display = "block";
  giftBtn.style.display = "block";

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
nextBtn.onclick = () => {}; // пока просто нажимается

flipBtn.onclick = () => {
  usingFrontCamera = !usingFrontCamera;
  getCameraStream();
};

let micOn = true;
micBtn.onclick = () => {
  micOn = !micOn;
  localStream.getAudioTracks()[0].enabled = micOn;
  micBtn.textContent = micOn ? "🎤" : "🔇";
};

muteBtn.onclick = () => {
  if(remoteVideo.srcObject){
    const remoteAudio = remoteVideo.srcObject.getAudioTracks();
    remoteAudio.forEach(t => t.enabled = !t.enabled);
  }
};

[likeBtn, reportBtn, giftBtn].forEach(b => b.onclick = () => {}); // просто нажимается

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
function stopCall(){
  startBtn.style.display = "block";
  stopBtn.style.display = "none";
  nextBtn.style.display = "none";

  flipBtn.style.display = "none";
  micBtn.style.display = "none";

  likeBtn.style.display = "none";
  reportBtn.style.display = "none";
  muteBtn.style.display = "none";
  giftBtn.style.display = "none";

  if(peer) peer.close();
  if(socket) socket.close();
  if(localStream) localStream.getTracks().forEach(t=>t.stop());

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
}

// ======== Pull-to-refresh ========
let touchStartY = 0;
document.addEventListener('touchstart', e => { if(e.touches.length === 1) touchStartY = e.touches[0].clientY; });
document.addEventListener('touchmove', e => {
  if(e.touches.length === 1){
    const touchEndY = e.touches[0].clientY;
    if(touchEndY - touchStartY > 100) location.reload();
  }
});

// ======== Автоскролл чата ========
chatInput.addEventListener("focus", () => { setTimeout(() => chatMessages.scrollTop = chatMessages.scrollHeight, 300); });
