const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = Number(process.env.PORT || 3000);
const sessions = new Map();

app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'Transfer Anywhere LAN signaling' }));

function makeCode() {
  let code;
  do { code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
  while (sessions.has(code));
  return code;
}

io.on('connection', (socket) => {
  socket.on('session:create', ({ name } = {}, ack = () => {}) => {
    const code = makeCode();
    const session = { code, createdAt: Date.now(), expiresAt: Date.now() + 10 * 60 * 1000, peers: new Map() };
    session.peers.set(socket.id, { name: cleanName(name), joinedAt: Date.now() });
    sessions.set(code, session);
    socket.data.code = code;
    socket.join(code);
    ack({ ok: true, code, expiresAt: session.expiresAt, selfId: socket.id, peers: [] });
  });

  socket.on('session:join', ({ code, name } = {}, ack = () => {}) => {
    code = String(code || '').replace(/\D/g, '').slice(0, 6);
    const session = sessions.get(code);
    if (!session || Date.now() > session.expiresAt) {
      ack({ ok: false, error: 'Code invalid or expired. Ask the sender for a new code.' });
      return;
    }
    if (session.peers.has(socket.id)) {
      ack({ ok: true, code, selfId: socket.id, peers: [] });
      return;
    }
    const existing = [...session.peers.entries()].map(([id, peer]) => ({ id, name: peer.name }));
    session.peers.set(socket.id, { name: cleanName(name), joinedAt: Date.now() });
    socket.data.code = code;
    socket.join(code);
    ack({ ok: true, code, selfId: socket.id, peers: existing });
    socket.to(code).emit('peer:joined', { id: socket.id, name: cleanName(name) });
  });

  socket.on('signal', ({ to, data } = {}) => {
    const code = socket.data.code;
    if (!code || !to || !sessions.get(code)?.peers.has(to)) return;
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('disconnect', () => {
    const code = socket.data.code;
    if (!code) return;
    const session = sessions.get(code);
    if (!session) return;
    session.peers.delete(socket.id);
    socket.to(code).emit('peer:left', { id: socket.id });
    if (session.peers.size === 0) sessions.delete(code);
  });
});

function cleanName(value) {
  const name = String(value || 'Device').trim().replace(/[<>]/g, '').slice(0, 24);
  return name || 'Device';
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Transfer Anywhere is running on http://localhost:${PORT}`);
  console.log('For other devices, open http://<this-computer-LAN-IP>:' + PORT);
});
