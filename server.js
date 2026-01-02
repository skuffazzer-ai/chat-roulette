const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let room = [];

io.on('connection', socket => {
  console.log('Connected:', socket.id);

  if (room.length < 2) {
    room.push(socket.id);
  }

  if (room.length === 2) {
    io.to(room[0]).emit('role', 'caller');
    io.to(room[1]).emit('role', 'callee');
  }

  socket.on('offer', offer => {
    socket.to(room.find(id => id !== socket.id)).emit('offer', offer);
  });

  socket.on('answer', answer => {
    socket.to(room.find(id => id !== socket.id)).emit('answer', answer);
  });

  socket.on('ice-candidate', candidate => {
    socket.to(room.find(id => id !== socket.id)).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    room = room.filter(id => id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Railway server running on', PORT));
