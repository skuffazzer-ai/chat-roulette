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

// ====== Текстовая модерация ======
const bannedWords = ["слово1","слово2","слово3"]; // сюда добавляем запрещённые слова

function moderateMessage(msg) {
  let moderated = msg;
  let flagged = false;
  bannedWords.forEach(word => {
    const regex = new RegExp(word, "gi");
    if (regex.test(moderated)) {
      moderated = moderated.replace(regex, "***");
      flagged = true;
    }
  });
  return { moderated, flagged };
}

// ====== Показ кнопок ======
function showAllButtons() {
  [stopBtn, nextBtn, flipBtn, micBtn, reportBtn, likeBtn, muteRemoteBtn, giftBtn].forEach(b => b.classList.remove("hidden"));
}

// ====== Получаем камеру и микрофон ======
async function getCameraStream() {
  if (!localStream) {
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
}

// ====== START кнопка ======
startBtn.onclick = async () => {
  startBtn.classList.add("hidden");
  await getCameraStream();
  showAllButtons();
  connectToServer();
};

// ====== Подключение к серверу ======
function connectToServer() {
  if (socket) socket.close();
  if (peer) closePeer();

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
    if (data.type === "leave") stopRemote();
  };

  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
}

// ====== Peer ======
function createPeer(isCaller) {
  peer = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    remoteVideo.muted = false;
    remoteVideo.volume = 1;
    remoteVideo.play().catch(err => console.log(err));

    const audioTrack = e.streams[0].getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = true;
  };

  peer.onicecandidate = e => { if (e.candidate) socket.send(JSON.stringify({ candidate: e.candidate })); };

  if (isCaller) {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: offer }));
    });
  }
}

// ====== Flip камера ======
flipBtn.onclick = async () => {
  usingFrontCamera = !usingFrontCamera;
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    const constraints = { facingMode: usingFrontCamera ? "user" : "environment" };
    const newStream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: true });
    const newVideoTrack = newStream.getVideoTracks()[0];

    localStream.removeTrack(videoTrack);
    localStream.addTrack(newVideoTrack);
    localVideo.srcObject = localStream;

    if (peer) {
      const sender = peer.getSenders().find(s => s.track.kind === "video");
      if (sender) sender.replaceTrack(newVideoTrack);
    }
  }
};

// ====== MIC Toggle ======
micBtn.onclick = () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  micBtn.textContent = audioTrack.enabled ? "🎤" : "🔇";
};

// ====== Remote Mute ======
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
  let msg = chatInput.value.trim();
  if (!msg) return;

  const { moderated, flagged } = moderateMessage(msg);

  appendMessage("Вы", moderated);

  if (flagged && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "moderation_log", message: msg }));
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "chat", message: moderated }));
  }

  chatInput.value = "";
}
sendBtn.onclick = sendMessage;
chatInput.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

// ====== STOP ======
stopBtn.onclick = stop;
function stop() {
  startBtn.classList.remove("hidden");
  [stopBtn, nextBtn, flipBtn, micBtn, reportBtn, likeBtn, muteRemoteBtn, giftBtn].forEach(b => b.classList.add("hidden"));

  if (peer) closePeer();
  if (socket) { socket.close(); socket = null; }

  if (localStream) localStream.getTracks().forEach(t => t.stop());
  localStream = null;

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
}

// ====== Следующий собеседник ======
nextBtn.onclick = () => {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "leave" }));
  closePeer();
  if (socket) { socket.close(); socket = null; }
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
  connectToServer();
};

// ====== Закрытие Peer ======
function closePeer() {
  if (peer) {
    peer.getSenders().forEach(sender => { if (sender.track) sender.track.stop(); });
    peer.close();
    peer = null;
  }
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }
}

// ====== Другие кнопки ======
reportBtn.onclick = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "report" }));
  }
  alert("Жалоба отправлена");
};
likeBtn.onclick = () => alert("Лайк поставлен");
giftBtn.onclick = () => alert("Подарок отправлен");

// ====== Pull-to-refresh ======
let touchStartY = 0;
let touchEndY = 0;
document.addEventListener('touchstart', e => { if(e.touches.length===1) touchStartY = e.touches[0].clientY; });
document.addEventListener('touchmove', e => { if(e.touches.length===1) touchEndY = e.touches[0].clientY; });
document.addEventListener('touchend', e => { if (touchEndY - touchStartY > 150) location.reload(); });

// ====== Фиксируем удалённого пользователя ======
function stopRemote() {
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }
  chatMessages.innerHTML = "";
  if (peer) { peer.close(); peer = null; }
}
