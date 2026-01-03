let localStream;
let peer;
let socket;
let usingFrontCamera = true;
let currentPeerId = null;

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

const ageGate = document.getElementById("ageGate");
const confirmAgeBtn = document.getElementById("confirmAgeBtn");
const mainContent = document.getElementById("mainContent");

const reportModal = document.getElementById("reportModal");

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ===== AGE CONFIRM =====
confirmAgeBtn.onclick = () => {
  ageGate.classList.add("hidden");
  mainContent.classList.remove("hidden");
};

// ===== CAMERA =====
async function getCameraStream() {
  if(localStream) localStream.getTracks().forEach(t => t.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(d => d.kind === "videoinput");
  let targetDevice = videoDevices[0];

  if(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)){
    targetDevice = videoDevices.find(d =>
      usingFrontCamera ? d.label.toLowerCase().includes("front") : d.label.toLowerCase().includes("back")
    ) || videoDevices[0];
  }

  localStream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: targetDevice.deviceId } },
    audio: true
  });

  localVideo.srcObject = localStream;

  if(peer){
    const sender = peer.getSenders().find(s => s.track.kind==='video');
    if(sender) sender.replaceTrack(localStream.getVideoTracks()[0]);
  }
}

// ===== CHAT =====
function appendMessage(sender, text){
  const div = document.createElement("div");
  div.className = "chat-message";
  div.textContent = `${sender}: ${text}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== START / STOP =====
startBtn.onclick = async () => {
  startBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
  nextBtn.classList.remove("hidden");
  flipBtn.classList.remove("hidden");
  micBtn.classList.remove("hidden");
  reportBtn.classList.remove("hidden");
  likeBtn.classList.remove("hidden");
  muteRemoteBtn.classList.remove("hidden");
  giftBtn.classList.remove("hidden");

  await getCameraStream();

  socket = new WebSocket(location.protocol==="https:" ? `wss://${location.host}` : `ws://${location.host}`);
  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if(data.type==="match") {
      setTimeout(()=>{
        createPeer(data.role==="caller");
        currentPeerId = socket.id;
      },100);
    }

    if(data.sdp && peer){
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if(data.sdp.type==="offer"){
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({sdp: peer.localDescription}));
      }
    }

    if(data.candidate && peer){
      try{ await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e){console.log(e);}
    }

    if(data.type==="chat") appendMessage("Собеседник", data.message);
    if(data.type==="leave") stop();
  };
};

stopBtn.onclick = stop;
nextBtn.onclick = () => alert("Следующий пока что не реализован");

// ===== PEER =====
function createPeer(isCaller){
  peer = new RTCPeerConnection(config);
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  peer.ontrack = e => remoteVideo.srcObject = e.streams[0];
  peer.onicecandidate = e => { if(e.candidate) socket.send(JSON.stringify({candidate:e.candidate})); };

  if(isCaller){
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.send(JSON.stringify({sdp: offer}));
    });
  }
}

// ===== FLIP CAMERA =====
flipBtn.onclick = async () => {
  usingFrontCamera = !usingFrontCamera;
  await getCameraStream();
};

// ===== MIC =====
micBtn.onclick = () => {
  if(!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  micBtn.textContent = audioTrack.enabled ? "🎤" : "🔇";
};

// ===== REMOTE MUTE =====
muteRemoteBtn.onclick = () => {
  if(!remoteVideo.srcObject) return;
  const audioTrack = remoteVideo.srcObject.getAudioTracks()[0];
  if(audioTrack) audioTrack.enabled = !audioTrack.enabled;
  muteRemoteBtn.textContent = audioTrack.enabled ? "🔈" : "🔇";
};

// ===== CHAT SEND =====
function sendMessage(){
  const msg = chatInput.value.trim();
  if(!msg) return;
  appendMessage("Вы", msg);
  socket.send(JSON.stringify({type:"chat", message: msg}));
  chatInput.value="";
}
sendBtn.onclick = sendMessage;
chatInput.addEventListener("keypress", e => { if(e.key==="Enter") sendMessage(); });

// ===== STOP =====
function stop(){
  startBtn.classList.remove("hidden");
  stopBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");
  flipBtn.classList.add("hidden");
  micBtn.classList.add("hidden");
  reportBtn.classList.add("hidden");
  likeBtn.classList.add("hidden");
  muteRemoteBtn.classList.add("hidden");
  giftBtn.classList.add("hidden");

  if(peer) peer.close();
  if(socket) socket.close();
  if(localStream) localStream.getTracks().forEach(t=>t.stop());

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  chatMessages.innerHTML = "";
}

// ===== LIKE / GIFT =====
likeBtn.onclick = () => alert("Лайк поставлен");
giftBtn.onclick = () => alert("Подарок отправлен");

// ===== REPORT MODAL =====
reportBtn.onclick = () => reportModal.classList.remove("hidden");
function closeReport() { reportModal.classList.add("hidden"); }
function sendReport(reason){
  if(!currentPeerId) return;

  if(socket){
    socket.send(JSON.stringify({
      type: "report-user",
      reason,
      reportedUserId: currentPeerId
    }));
  }

  alert("Жалоба отправлена: " + reason);
  closeReport();
}

// ===== PULL-TO-REFRESH =====
let touchStartY = 0;
document.addEventListener('touchstart', e => { if(e.touches.length===1) touchStartY = e.touches[0].clientY; });
document.addEventListener('touchmove', e => {
  if(e.touches.length===1){
    const touchEndY = e.touches[0].clientY;
    if(touchEndY - touchStartY > 100) location.reload();
  }
});
