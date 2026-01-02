let localStream;
let peer;
let socket;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

startBtn.onclick = async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;

  // Получаем локальное видео и аудио
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  // Подключение к серверу
  socket = new WebSocket(
    location.protocol === "https:"
      ? `wss://${location.host}`
      : `ws://${location.host}`
  );

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    // Когда найден партнер
    if (data.type === "match") {
      setTimeout(() => createPeer(data.role === "caller"), 100); // задержка для Safari
    }

    // SDP сигнал
    if (data.sdp) {
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({ sdp: peer.localDescription }));
      }
    }

    // ICE кандидаты
    if (data.candidate) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.log("Ошибка добавления кандидата:", e);
      }
    }

    // Партнер ушел
    if (data.type === "leave") {
      stop();
    }
  };
};

function createPeer(isCaller) {
  peer = new RTCPeerConnection(config);

  // Добавляем локальные треки
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  // Получаем удаленный поток
  peer.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  // ICE кандидаты
  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.send(JSON.stringify({ candidate: e.candidate }));
    }
  };

  // Если мы вызываем, создаем offer
  if (isCaller) {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.send(JSON.stringify({ sdp: offer }));
    });
  }
}

stopBtn.onclick = stop;

function stop() {
  startBtn.disabled = false;
  stopBtn.disabled = true;

  if (peer) peer.close();
  if (socket) socket.close();
  if (localStream) localStream.getTracks().forEach(t => t.stop());

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
}
