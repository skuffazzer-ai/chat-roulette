let localStream;
let peer;
let socket;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const nextBtn = document.getElementById("nextBtn");

const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const sendBtn = document.getElementById("sendBtn");

// Новые кнопки
const flipBtn = document.getElementById("flipBtn");
const reportBtn = document.getElementById("reportBtn");
const giftBtn = document.getElementById("giftBtn");
const likeBtn = document.getElementById("likeBtn");
const muteBtn = document.getElementById("muteBtn");

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Изначально скрываем flipBtn
flipBtn.style.display = "none";

let currentFacing = "user"; // фронтальная камера по умолчанию

// ======== Старт звонка ========
async function startCall() {
  startBtn.disabled = true;
  stopBtn.disabled = false;

  startBtn.style.display = "none";
  stopBtn.style.display = "inline-block";
  nextBtn.style.display = "inline-block";

  // Показываем кнопку переворота камеры
  flipBtn.style.display = "inline-block";

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacing }, audio: true });
    localVideo.srcObject = localStream;
  } catch (e) {
    console.error("Не удалось получить камеру/микрофон:", e);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    startBtn.style.display = "inline-block";
    stopBtn.style.display = "none";
    nextBtn.style.display = "none";
    flipBtn.style.display = "none";
    return;
  }

  socket = new WebSocket(location.protocol === "https:" ? `wss://${location.host}` : `ws://${location.host}`);

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
    if (data.type === "leave") stopCall();
  };
}

startBtn.onclick = startCall;

// ======== Завершить звонок ========
function stopCall() {
  stopBtn.style.display = "none";
  nextBtn.style.display = "none";
  startBtn.style.display = "inline-block";
  startBtn.disabled = false;

  // Скрываем flipBtn при остановке
  flipBtn.style.display = "none";

  if(peer) { peer.close(); peer = null; }
  if(socket) { socket.close(); socket = null; }
  if(localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
}

stopBtn.onclick = stopCall;

// ======== Next кнопка ========
nextBtn.onclick = () => console.log("Следующий нажата");

// ======== Peer ========
function createPeer(isCaller) {
  peer = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  peer.ontrack = (e) => remoteVideo.srcObject = e.streams[0];
  peer.onicecandidate = (e) => { if (e.candidate) socket.send(JSON.stringify({ candidate: e.candidate })); };

  if (isCaller) {
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

// ======== Новые кнопки ========

flipBtn.onclick = async () => {
  if (!localStream) return;

  currentFacing = currentFacing === "user" ? "environment" : "user";

  try {
    const audioTracks = localStream.getAudioTracks();
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: currentFacing } },
      audio: audioTracks.length ? true : false
    });

    const newVideoTrack = newStream.getVideoTracks()[0];
    const oldVideoTrack = localStream.getVideoTracks()[0];

    if (oldVideoTrack) oldVideoTrack.stop();
    localStream.removeTrack(oldVideoTrack);
    localStream.addTrack(newVideoTrack);

    localVideo.srcObject = null;
    localVideo.srcObject = localStream;

    // Если уже есть Peer, заменяем трек на стороне собеседника
    if (peer) {
      const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(newVideoTrack);
    }

    console.log("Камера переключена на:", currentFacing === "user" ? "фронтальную" : "заднюю");
  } catch (e) {
    console.error("Ошибка при переключении камеры:", e);
  }
};

reportBtn.onclick = () => console.log("Жалоба нажата");
giftBtn.onclick = () => console.log("Подарок нажата");
likeBtn.onclick = () => console.log("Лайк нажата");
muteBtn.onclick = () => {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if(track) track.enabled = !track.enabled;
};

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
