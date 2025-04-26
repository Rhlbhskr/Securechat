import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://securechat-production.up.railway.app'); // Make sure it's HTTPS

let keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null;

const generateKeyPair = async () => {
  const keys = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return keys;
};

const exportPublicKey = async (key: CryptoKey) => {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

const encryptMessage = async (publicKey: CryptoKey, message: string) => {
  const encoded = new TextEncoder().encode(message);
  const ciphertext = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
};

const decryptMessage = async (privateKey: CryptoKey, ciphertext: string) => {
  const decoded = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const plaintext = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, decoded);
  return new TextDecoder().decode(plaintext);
};

const App = () => {
  const [users, setUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    const setup = async () => {
      keyPair = await generateKeyPair();
      const exportedPublicKey = await exportPublicKey(keyPair.publicKey);
      socket.emit('join', exportedPublicKey);
    };
    setup();

    socket.on('user-list', (userList: string[]) => {
      setUsers(userList);
    });

    socket.on('receive-message', async ({ ciphertext }: { ciphertext: string }) => {
      if (keyPair?.privateKey) {
        const decrypted = await decryptMessage(keyPair.privateKey, ciphertext);
        setMessages(prev => [...prev, decrypted]);
      }
    });
  }, []);

  const handleSend = async () => {
    if (messageInput.trim() === '') return;
    // Assume server already knows the other user's public key somehow
    // You might need to fetch recipient's public key first here
    socket.emit('send-message', { message: messageInput });
    setMessageInput('');
  };

  return (
    <div>
      <h1>Secure Chat</h1>
      <div>
        <h2>Online Users:</h2>
        <ul>{users.map((user, idx) => <li key={idx}>{user}</li>)}</ul>
      </div>
      <div>
        <h2>Messages:</h2>
        <ul>{messages.map((msg, idx) => <li key={idx}>{msg}</li>)}</ul>
      </div>
      <input
        value={messageInput}
        onChange={e => setMessageInput(e.target.value)}
        placeholder="Type your message"
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};

export default App;
