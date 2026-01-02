const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let readyUsers = [];

io.on('connection', socket => {
  console.log('Подключился:', socket.id);

  socket.on('ready', () => {
    if (!readyUsers.includes(socket.id)) {
      readyUsers.push(socket.id);
    }

    if (readyUsers.length === 2) {
      io.to(readyUsers[0]).emit('initiate-call', true);
      io.to(readyUsers[1]).emit('initiate-call', false);
    }
  });

  socket.on('offer', data => {
    socket.broadcast.emit('offer', data);
  });

  socket.on('answer', data => {
    socket.broadcast.emit('answer', data);
  });

  socket.on('ice-candidate', data => {
    socket.broadcast.emit('ice-candidate', data);
  });

  socket.on('disconnect', () => {
    readyUsers = readyUsers.filter(id => id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server running on port', PORT));
