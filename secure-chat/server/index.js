const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());
app.use(express.json());

const users = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('register', ({ username, publicKey }) => {
    users.set(socket.id, { username, publicKey });
    console.log(`${username} registered with socket ${socket.id}`);

    // 🚨 Send updated users list to everyone
    io.emit('users-list', Array.from(users, ([socketId, value]) => ({
      socketId,
      username: value.username,
      publicKey: value.publicKey,
    })));
  });

  socket.on('get-users', () => {
    const publicKeys = [];
    users.forEach((value, id) => {
      if (id !== socket.id) {
        publicKeys.push({
          socketId: id,
          username: value.username,
          publicKey: value.publicKey,
        });
      }
    });
    socket.emit('users-list', publicKeys);
  });

  socket.on('typing', (to) => {
    if (to) {
      io.to(to).emit('user-typing', socket.id);
    }
  });

  socket.on('send-message', ({ to, encryptedMessage, timestamp }) => {
    io.to(to).emit('receive-message', {
      from: socket.id,
      encryptedMessage,
      timestamp,
    });
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    console.log(`User disconnected: ${socket.id}`);

    // 🚨 After disconnection, update user list again
    io.emit('users-list', Array.from(users, ([socketId, value]) => ({
      socketId,
      username: value.username,
      publicKey: value.publicKey,
    })));
  });
});

server.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
