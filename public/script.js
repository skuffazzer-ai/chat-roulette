const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');

let localStream;
let peerConnection;
let isCaller = false;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Получаем локальный поток
async function initLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

// Создаём PeerConnection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

// Начало звонка
async function startCall() {
  await initLocalStream();
  createPeerConnection();
  isCaller = true;

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
}

// Сигнальный сервер
socket.on('user-joined', () => {
  // Если пришёл кто-то ещё и мы ещё не создали соединение
  if (!peerConnection && !isCaller) {
    startCall(); // автоматически создаём offer, если второй подключается
  }
});

socket.on('offer', async (offer) => {
  if (!peerConnection) await initLocalStream(), createPeerConnection();

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on('ice-candidate', async (candidate) => {
  try {
    if (peerConnection) await peerConnection.addIceCandidate(candidate);
  } catch (err) {
    console.error('Ошибка добавления ICE-кандидата', err);
  }
});

// Кнопка "Начать"
startButton.addEventListener('click', startCall);
