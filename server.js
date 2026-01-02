const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let users = [];

io.on('connection', socket => {
  users.push(socket);

  if (users.length === 2) {
    users[0].emit('role', 'caller');
    users[1].emit('role', 'callee');
  }

  socket.on('offer', data => {
    socket.broadcast.emit('offer', data);
  });

  socket.on('answer', data => {
    socket.broadcast.emit('answer', data);
  });

  socket.on('ice', data => {
    socket.broadcast.emit('ice', data);
  });

  socket.on('disconnect', () => {
    users = users.filter(u => u !== socket);
  });
});

server.listen(process.env.PORT || 3000);
