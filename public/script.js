// Начать / Завершить / Следующий
startBtn.onclick = () => {
  startBtn.style.display = "none";
  stopBtn.style.display = "inline-block";
  nextBtn.style.display = "inline-block";
  console.log("Начать нажато");
};

stopBtn.onclick = () => {
  stopBtn.style.display = "none";
  nextBtn.style.display = "none";
  startBtn.style.display = "inline-block";
  console.log("Завершить нажато");
};

nextBtn.onclick = () => { console.log("Следующий нажато"); };

// Переворот камеры
flipBtn.onclick = async () => {
  const videoTrack = localStream.getVideoTracks()[0];
  if(videoTrack) {
    const constraints = videoTrack.getConstraints();
    const facingMode = constraints.facingMode === "user" ? "environment" : "user";
    videoTrack.applyConstraints({ facingMode });
    console.log("Камера перевернута");
  }
};

// Остальные кнопки
reportBtn.onclick = () => console.log("Жалоба нажата");
giftBtn.onclick = () => console.log("Подарок нажата");
likeBtn.onclick = () => console.log("Лайк нажата");
muteBtn.onclick = () => {
  const track = localStream.getAudioTracks()[0];
  if(track) track.enabled = !track.enabled;
  console.log("Мут переключён");
};
