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
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Ошибка доступа к камере/микрофону:', err);
    alert('Невозможно получить доступ к камере и микрофону. Разрешите доступ.');
  }
}

// Создание PeerConnection и добавление треков
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  // Поток от собеседника
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // ICE-кандидаты
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate);
    }
  };

  // Добавляем локальные треки в PeerConnection
  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  } else {
    console.warn('Локальный поток ещё не инициализирован');
  }
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

// Пользователь присоединился
socket.on('user-joined', async () => {
  if (!peerConnection && !isCaller) {
    await initLocalStream();
    createPeerConnection();
  }
});

// Получение offer
socket.on('offer', async (offer) => {
  if (!peerConnection) {
    await initLocalStream();
    createPeerConnection();
  }
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

// Получение answer
socket.on('answer', async (answer) => {
  await peerConnection.setRemoteDescription(answer);
});

// Получение ICE-кандидата
socket.on('ice-candidate', async (candidate) => {
  try {
    if (peerConnection) await peerConnection.addIceCandidate(candidate);
  } catch (err) {
    console.error('Ошибка добавления ICE-кандидата', err);
  }
});

// Кнопка "Начать"
startButton.addEventListener('click', startCall);
