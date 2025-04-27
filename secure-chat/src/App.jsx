import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import forge from 'node-forge';

const socket = io('https://securechat-production.up.railway.app', { transports: ['websocket'] });

const generateKeyPair = () =>
  new Promise((resolve) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, keypair) => {
      resolve({
        publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
        privateKey: forge.pki.privateKeyToPem(keypair.privateKey),
      });
    });
  });

function App() {
  const [username, setUsername] = useState('');
  const [registered, setRegistered] = useState(false);
  const [keypair, setKeypair] = useState({ publicKey: '', privateKey: '' });
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [typingStatus, setTypingStatus] = useState('');

  const userMap = Object.fromEntries(users.map((u) => [u.socketId, u.username]));

  useEffect(() => {
    socket.on('users-list', (users) => setUsers(users));

    socket.on('receive-message', async ({ from, encryptedMessage, timestamp }) => {
      const privateKey = forge.pki.privateKeyFromPem(keypair.privateKey);
      const decrypted = privateKey.decrypt(forge.util.decode64(encryptedMessage), 'RSA-OAEP');
      setChat((prev) => [...prev, { from, text: decrypted, timestamp }]);
    });

    socket.on('user-typing', ({ from }) => {
      if (userMap[from]) {
        setTypingStatus(`${userMap[from]} is typing...`);
        setTimeout(() => setTypingStatus(''), 2000);
      }
    });

    return () => {
      socket.off('users-list');
      socket.off('receive-message');
      socket.off('user-typing');
    };
  }, [keypair, userMap]);

  const register = async () => {
    if (!username.trim()) return;
    const keys = await generateKeyPair();
    setKeypair(keys);
    socket.emit('register', { username, publicKey: keys.publicKey });
    setRegistered(true);
  };

  const fetchUsers = () => {
    socket.emit('get-users');
  };

  const sendMessage = () => {
    if (!message.trim() || !selectedUser) return;

    const recipient = users.find((u) => u.socketId === selectedUser);
    const publicKey = forge.pki.publicKeyFromPem(recipient.publicKey);
    const encrypted = forge.util.encode64(publicKey.encrypt(message, 'RSA-OAEP'));

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    socket.emit('send-message', {
      to: selectedUser,
      encryptedMessage: encrypted,
      timestamp,
    });

    setChat((prev) => [...prev, { from: 'You', text: message, timestamp }]);
    setMessage('');
  };

  const handleTyping = () => {
    if (selectedUser) {
      socket.emit('typing', selectedUser);
    }
  };

  const handleKeyPressMessage = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    } else {
      handleTyping();
    }
  };

  const handleKeyPressRegister = (e) => {
    if (e.key === 'Enter') {
      register();
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      {!registered ? (
        <div style={{ maxWidth: 400, margin: 'auto', marginTop: 100 }}>
          <h2>Enter Username</h2>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPressRegister}
            style={{ padding: 8, width: '100%', marginBottom: 10 }}
          />
          <button onClick={register} style={{ padding: 8, width: '100%' }}>
            Register
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Sidebar */}
          <div style={{ width: 250, borderRight: '1px solid #ccc', paddingRight: 10 }}>
            <h3>Welcome, {username}</h3>
            <button onClick={fetchUsers} style={{ marginBottom: 10, padding: 5 }}>
              Refresh User List
            </button>
            <div>
              <h4>Users Online:</h4>
              {users.map((u) => (
                <div key={u.socketId} style={{ marginBottom: 8 }}>
                  <button
                    onClick={() => setSelectedUser(u.socketId)}
                    style={{
                      padding: 8,
                      width: '100%',
                      backgroundColor: selectedUser === u.socketId ? '#e0e0e0' : '#fff',
                      border: '1px solid #ccc',
                      textAlign: 'left',
                      borderRadius: 4,
                    }}
                  >
                    🟢 {u.username}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          {selectedUser && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '80vh' }}>
              <div
                style={{
                  flex: 1,
                  border: '1px solid #ccc',
                  borderRadius: 5,
                  padding: 10,
                  overflowY: 'auto',
                  marginBottom: 10,
                  backgroundColor: '#fafafa',
                }}
              >
                {chat.map((c, idx) => (
                  <div key={idx} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: c.from === 'You' ? 'bold' : 'normal' }}>
                      {c.from === 'You' ? 'You' : userMap[c.from] || 'Unknown'}
                    </div>
                    <div>{c.text}</div>
                    <div style={{ fontSize: '0.75rem', color: '#777', textAlign: 'right' }}>
                      {c.timestamp}
                    </div>
                  </div>
                ))}
              </div>
              {typingStatus && (
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 5 }}>
                  {typingStatus}
                </div>
              )}
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPressMessage}
                placeholder="Type a message..."
                style={{
                  padding: 10,
                  width: '100%',
                  borderRadius: 5,
                  border: '1px solid #ccc',
                  marginBottom: 10,
                }}
              />
              <button
                onClick={sendMessage}
                style={{
                  padding: 10,
                  borderRadius: 5,
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
