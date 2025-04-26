const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all for now, you can lock it down later
  },
});

const users = {}; // userId -> publicKey

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('join', (publicKey) => {
    users[socket.id] = publicKey;
    console.log(`User ${socket.id} joined with public key`);
    io.emit('user-list', Object.keys(users));
  });

  socket.on('send-message', async ({ message, toSocketId }) => {
    const recipientPublicKey = users[toSocketId];
    if (!recipientPublicKey) {
      console.error('Recipient not found');
      return;
    }

    try {
      // Encrypt the message with recipient's public key
      const encryptedMessage = await encryptMessageWithPublicKey(recipientPublicKey, message);

      io.to(toSocketId).emit('receive-message', { ciphertext: encryptedMessage });
    } catch (error) {
      console.error('Encryption failed:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.id} disconnected`);
    delete users[socket.id];
    io.emit('user-list', Object.keys(users));
  });
});

// Helper function to encrypt with recipient's public key
async function encryptMessageWithPublicKey(publicKeyPem, message) {
  const crypto = require('crypto');

  // Convert PEM publicKey back to usable key
  const publicKeyBuffer = Buffer.from(publicKeyPem, 'base64');

  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyBuffer,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(message)
  );

  return encrypted.toString('base64');
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
