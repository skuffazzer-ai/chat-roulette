const socket = io();

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn = document.getElementById('startBtn');

let localStream;
let pc;
let role;

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

async function startMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = localStream;

  pc = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track =>
    pc.addTrack(track, localStream)
  );

  pc.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit('ice-candidate', e.candidate);
  };
}

startBtn.onclick = async () => {
  await startMedia();
};

socket.on('role', async r => {
  role = r;

  if (role === 'caller') {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', offer);
  }
});

socket.on('offer', async offer => {
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', async answer => {
  await pc.setRemoteDescription(answer);
});

socket.on('ice-candidate', async candidate => {
  await pc.addIceCandidate(candidate);
});
