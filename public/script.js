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
  if (localStream) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Ошибка доступа к камере/микрофону:', err);
    alert('Разрешите доступ к камере и микрофону');
  }
}

// Создание PeerConnection
function createPeerConnection() {
  if (peerConnection) return;

  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) socket.emit('ice-candidate', event.candidate);
  };

  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }
}

// Начало звонка (для инициатора)
async function startCall() {
  isCaller = true;
  await initLocalStream();
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
}

// Когда приходит offer (второй пользователь)
socket.on('offer', async (offer) => {
  await initLocalStream();      // включаем камеру второго пользователя
  createPeerConnection();        // создаём PeerConnection

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

// Когда приходит answer (инициатор)
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

// Кнопка для первого пользователя
startButton.addEventListener('click', startCall);
