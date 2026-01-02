const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const ROOM_ID = 'room1';

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);
  socket.join(ROOM_ID);

  // Сообщаем другим пользователям, что пришёл новый
  socket.to(ROOM_ID).emit('user-joined', socket.id);

  socket.on('offer', (offer) => {
    socket.to(ROOM_ID).emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    socket.to(ROOM_ID).emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    socket.to(ROOM_ID).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
    socket.to(ROOM_ID).emit('user-left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Сервер запущен на http://localhost:${PORT}`));
