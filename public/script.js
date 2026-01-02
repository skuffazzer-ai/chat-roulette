const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');

let localStream;
let peerConnection;

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Получаем локальный поток (видео + аудио)
async function initLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

// Создаём PeerConnection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  // Когда приходит поток от собеседника
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
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
}

// Начало звонка
async function startCall(isCaller) {
  await initLocalStream();
  createPeerConnection();

  if (isCaller) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
  }
}

// Сигнальный сервер
socket.on('offer', async (offer) => {
  await createPeerConnection();
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
    await peerConnection.addIceCandidate(candidate);
  } catch (err) {
    console.error('Ошибка добавления ICE-кандидата', err);
  }
});

// Кнопка "Начать" (инициатор звонка)
startButton.addEventListener('click', () => startCall(true));
