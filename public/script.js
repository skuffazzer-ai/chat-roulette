const socket = io();

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

let pc;
let localStream;
let role;

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

socket.on('role', async r => {
  role = r;
  console.log('ROLE:', role);
});

startBtn.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;

  pc = new RTCPeerConnection(config);

  /* 🔥 КРИТИЧЕСКИ ВАЖНО: addTrack ДО offer/answer */
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = e => {
    console.log('ONTRACK');
    remoteVideo.srcObject = e.streams[0];
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('ice', e.candidate);
    }
  };

  if (role === 'caller') {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', offer);
  }
};

socket.on('offer', async offer => {
  if (!pc) startBtn.onclick();

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async answer => {
  await pc.setRemoteDescription(answer);
});

socket.on('ice', async candidate => {
  if (pc) {
    await pc.addIceCandidate(candidate);
  }
});

stopBtn.onclick = () => {
  if (pc) pc.close();
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
  }
};
