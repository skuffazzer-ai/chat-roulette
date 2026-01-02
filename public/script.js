let localStream;
let peer;
let socket;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

startBtn.onclick = async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket = new WebSocket(
    location.protocol === "https:"
      ? `wss://${location.host}`
      : `ws://${location.host}`
  );

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "match") {
  createPeer(data.role === "caller");
}


    if (data.sdp) {
      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.send(JSON.stringify({ sdp: peer.localDescription }));
      }
    }

    if (data.candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
    }

    if (data.type === "leave") {
      stop();
    }
  };
};

function createPeer(isCaller) {
  peer = new RTCPeerConnection(config);

  localStream.getTracks().forEach(track =>
    peer.addTrack(track, localStream)
  );

  peer.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.send(JSON.stringify({ candidate: e.candidate }));
    }
  };

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
