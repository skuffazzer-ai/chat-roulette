let localStream, peer, socket;
let usingFrontCamera = true;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const nextBtn = document.getElementById("nextBtn");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const sendBtn = document.getElementById("sendBtn");

const flipBtn = document.getElementById("flipBtn");
const reportBtn = document.getElementById("reportBtn");
const giftBtn = document.getElementById("giftBtn");
const likeBtn = document.getElementById("likeBtn");
const muteBtn = document.getElementById("muteBtn");
const muteMicBtn = document.getElementById("muteMicBtn");

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Скрываем кнопки до старта
[flipBtn, reportBtn, giftBtn, likeBtn, muteBtn, muteMicBtn].forEach(b => b.style.display = "none");

// ======== Start ========
startBtn.onclick = async () => {
  startBtn.style.display = "none";
  stopBtn.style.display = "inline-block";
  nextBtn.style.display = "inline-block";
  [flipBtn, reportBtn, giftBtn, likeBtn, muteBtn, muteMicBtn].forEach(b => b.style.display = "inline-block");

  localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
  localVideo.srcObject = localStream;

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
    if (data.candidate && peer) try { await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e){console.log(e);}
    if (data.type === "chat") appendMessage("Собеседник", data.message);
    if (data.type === "leave") stopCall();
  };
};

// ======== Stop ========
stopBtn.onclick = stopCall;
function stopCall() {
  stopBtn.style.display = "none";
  nextBtn.style.display = "none";
  startBtn.style.display = "inline-block";
  [flipBtn, reportBtn, giftBtn, likeBtn, muteBtn, muteMicBtn].forEach(b => b.style.display = "none");

  if(peer){ peer.close(); peer = null; }
  if(socket){ socket.close(); socket = null; }
  if(localStream){ localStream.getTracks().forEach(t=>t.stop()); localStream=null; }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
}

// ======== Next ========
nextBtn.onclick = () => console.log("Следующий нажата");

// ======== Peer ========
function createPeer(isCaller) {
  peer = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  peer.ontrack = (e) => remoteVideo.srcObject = e.streams[0];
  peer.onicecandidate = (e) => { if(e.candidate) socket.send(JSON.stringify({ candidate: e.candidate })); };
  if(isCaller) peer.createOffer().then(o => { peer.setLocalDescription(o); socket.send(JSON.stringify({ sdp:o })); });
}

// ======== Чат ========
function appendMessage(sender, text){
  const div = document.createElement("div");
  div.className = "chat-message";
  div.textContent = `${sender}: ${text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
sendBtn.onclick = sendMessage;
chatInput.addEventListener("keypress", e => { if(e.key==="Enter") sendMessage(); });
function sendMessage(){
  const msg = chatInput.value.trim();
  if(!msg) return;
  appendMessage("Вы", msg);
  socket.send(JSON.stringify({ type:"chat", message:msg }));
  chatInput.value = "";
}

// ======== Flip ========
flipBtn.onclick = async () => {
  if(!localStream) return;
  try {
    const facingMode = usingFrontCamera ? "environment" : "user";
    localStream.getTracks().forEach(t=>t.stop());
    localStream = await navigator.mediaDevices.getUserMedia({ video:{facingMode}, audio:true });
    localVideo.srcObject = localStream;
    if(peer){
      const sender = peer.getSenders().find(s=>s.track&&s.track.kind==='video');
      if(sender) sender.replaceTrack(localStream.getVideoTracks()[0]);
    }
    usingFrontCamera = !usingFrontCamera;
  } catch(err){ console.error("Ошибка переключения камеры:", err); }
};

// ======== Остальные кнопки ========
reportBtn.onclick = () => console.log("Жалоба нажата");
giftBtn.onclick = () => console.log("Подарок нажата");
likeBtn.onclick = () => console.log("Лайк нажата");
muteBtn.onclick = () => console.log("Мут собеседника");

// ======== Микрофон ========
muteMicBtn.onclick = () => {
  if(!localStream) return;
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
  muteMicBtn.textContent = track.enabled ? "🎤" : "🔇";
};
