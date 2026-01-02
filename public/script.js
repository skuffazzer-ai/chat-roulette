const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');

let localStream;
let peerConnection;
let isCaller = false;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Инициализация локального потока
async function initLocalStream() {
  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    }
  } catch (err) {
    console.error('Ошибка доступа к камере/микрофону:', err);
    alert('Разрешите доступ к камере и микрофону');
  }
}

// Создание PeerConnection
function createPeerConnection() {
  if (peerConnection) return; // не создаём заново

  peerConnection = new RTCPeerConnection(configuration);

  // Получение потока собеседника
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // ICE-кандидаты
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  // Добавляем локальные треки
  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }
}

// Начало звонка (инициатор)
async function startCall() {
  await initLocalStream();
  createPeerConnection();
  isCaller = true;

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
}

// Когда другой пользователь присоединился
socket.on('user-joined', async () => {
  if (!peerConnection && !isCaller) {
    await initLocalStream();
    createPeerConnection();
  }
});

// Приход offer
socket.on('offer', async (offer) => {
  await initLocalStream();
  createPeerConnection();

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

// Приход answer
socket.on('answer', async (answer) => {
  if (peerConnection) await peerConnection.setRemoteDescription(answer);
});

// ICE-кандидаты
socket.on('ice-candidate', async (candidate) => {
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (err) {
      console.error('Ошибка добавления ICE-кандидата:', err);
    }
  }
});

// Кнопка "Начать"
startButton.addEventListener('click', startCall);
