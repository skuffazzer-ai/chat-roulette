const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const endButton = document.getElementById('endButton');

let localStream;
let peerConnection;
let isCaller = false;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },

    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};


// Получаем локальный поток
async function initLocalStream() {
  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    } catch (err) {
      console.error('Ошибка доступа к камере/микрофону:', err);
      alert('Разрешите доступ к камере и микрофону');
    }
  }
}

// Создаем PeerConnection
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

// Завершение звонка
function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  isCaller = false;
}

// Приход offer (второй пользователь подключается автоматически)
socket.on('offer', async (offer) => {
  await initLocalStream();
  createPeerConnection();

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer);
});

// Приход answer (инициатор)
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

// События кнопок
startButton.addEventListener('click', startCall);
endButton.addEventListener('click', endCall);
