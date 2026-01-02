const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let users = [];

io.on('connection', socket => {
  console.log('Подключился:', socket.id);

  users.push(socket.id);

  if (users.length === 2) {
    io.to(users[0]).emit('role', 'caller');
    io.to(users[1]).emit('role', 'callee');
  }

  socket.on('offer', offer => {
    socket.to(users.find(id => id !== socket.id)).emit('offer', offer);
  });

  socket.on('answer', answer => {
    socket.to(users.find(id => id !== socket.id)).emit('answer', answer);
  });

  socket.on('ice-candidate', candidate => {
    socket.to(users.find(id => id !== socket.id)).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    users = users.filter(id => id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server running on', PORT));
