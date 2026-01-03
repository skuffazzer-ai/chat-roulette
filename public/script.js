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

const reportBtn = document.getElementById("reportBtn");
const likeBtn = document.getElementById("likeBtn");
const muteRemoteBtn = document.getElementById("muteRemoteBtn");
const giftBtn = document.getElementById("giftBtn");

const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const sendBtn = document.getElementById("sendBtn");

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ====== Показ всех кнопок ======
function showAllButtons() {
  [stopBtn, nextBtn, flipBtn, micBtn, reportBtn, likeBtn, muteRemoteBtn, giftBtn].forEach(b => b.classList.remove("hidden"));
}

// ====== Получаем камеру и микрофон ======
async function getCameraStream() {
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: usingFrontCamera ? "user" : "environment" },
      audio: true
    });
    localVideo.srcObject = localStream;
    localVideo.muted = true;
    await localVideo.play();
  } catch (e) {
    alert("Ошибка доступа к камере/микрофону. Разрешите доступ.");
    throw e;
  }
}

// ====== START кнопка ======
startBtn.onclick = async () => {
  startBtn.classList.add("hidden");
  await getCameraStream();
  showAllButtons();

  // WebSocket
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
      try { await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { console.log(e); }
    }

    if (data.type === "chat") appendMessage("Собеседник", data.message);
    if (data.type === "leave") stop();
  };
};

// ====== Peer ======
function createPeer(isCaller) {
  peer = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.volume = 1;
    remoteVideo.play();
  };

  peer.onicecandidate = e => { if (e.candidate) socket.send(JSON.stringify({ candidate: e.candidate })); };

  if (isCaller) {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: offer }));
    });
  }
}

// ====== FLIP CAMERA ======
flipBtn.onclick = async () => {
  usingFrontCamera = !usingFrontCamera;
  await getCameraStream();
  if (peer) {
    const videoTrack = localStream.getVideoTracks()[0];
    const sender = peer.getSenders().find(s => s.track.kind === "video");
    if (sender) sender.replaceTrack(videoTrack);
  }
};

// ====== MIC TOGGLE ======
micBtn.onclick = () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  micBtn.textContent = audioTrack.enabled ? "🎤" : "🔇";
};

// ====== REMOTE MUTE ======
muteRemoteBtn.onclick = () => {
  if (!remoteVideo.srcObject) return;
  const audioTrack = remoteVideo.srcObject.getAudioTracks()[0];
  if (audioTrack) audioTrack.enabled = !audioTrack.enabled;
  muteRemoteBtn.textContent = audioTrack.enabled ? "🔈" : "🔇";
};

// ====== Чат ======
function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.className = "chat-message";
  div.textContent = `${sender}: ${text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  appendMessage("Вы", msg);
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "chat", message: msg }));
  chatInput.value = "";
}
sendBtn.onclick = sendMessage;
chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

// ====== STOP ======
stopBtn.onclick = stop;
function stop() {
  startBtn.classList.remove("hidden");
  [stopBtn, nextBtn, flipBtn, micBtn, reportBtn, likeBtn, muteRemoteBtn, giftBtn].forEach(b => b.classList.add("hidden"));

  if (peer) { peer.close(); peer = null; }
  if (socket) { socket.close(); socket = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
}

// ====== Другие кнопки ======
reportBtn.onclick = () => alert("Жалоба отправлена");
likeBtn.onclick = () => alert("Лайк поставлен");
giftBtn.onclick = () => alert("Подарок отправлен");

// ====== Pull-to-refresh для iPhone ======
let touchStartY = 0;
document.addEventListener('touchstart', e => { if (e.touches.length === 1) touchStartY = e.touches[0].clientY; });
document.addEventListener('touchend', e => {
  if (e.changedTouches.length === 1) {
    const touchEndY = e.changedTouches[0].clientY;
    if (touchEndY - touchStartY > 150) location.reload();
  }
});
