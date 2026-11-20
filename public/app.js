(() => {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const state = { code: null, selfId: null, peers: new Map(), pcs: new Map(), channels: new Map(), pendingIncoming: new Map(), pendingOutgoing: new Map(), incomingFiles: new Map(), selectedFile: null, deviceName: `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Computer'}-${Math.random().toString(36).slice(2, 5).toUpperCase()}` };
  const CHUNK_SIZE = 16 * 1024;
  let toastTimer;

  function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800); }
  function setStatus(connected) { const el = $('connection-status'); el.classList.toggle('connected', connected); el.innerHTML = `<i></i> ${connected ? 'Session active' : 'Not connected'}`; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function renderSession() {
    const content = $('session-content');
    if (!state.code) { content.innerHTML = '<div class="session-empty"><span class="empty-icon">⌁</span><div><strong>No active session</strong><p>Choose Send or Receive to connect devices on your Wi-Fi.</p></div></div>'; setStatus(false); }
    else { content.innerHTML = `<div class="session-code"><div><div class="tool-kicker">SHARE THIS CODE</div><strong>${state.code.slice(0,3)} ${state.code.slice(3)}</strong></div><button class="copy-button" id="copy-code">Copy code</button></div>`; $('copy-code').onclick = () => { navigator.clipboard?.writeText(state.code); toast('Code copied'); }; setStatus(true); }
    $('peer-list').innerHTML = [...state.peers.entries()].map(([id,p]) => `<span class="peer-chip">● ${escapeHtml(p.name)} ${state.channels.get(id)?.readyState === 'open' ? '· Connected' : '· Connecting'}</span>`).join('');
  }
  function addActivity(html) { const el = document.createElement('div'); el.className = 'activity'; el.innerHTML = html; $('activity-list').prepend(el); return el; }
  function showTabs() { document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => { const card = btn.closest('.card-content'); card.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn)); card.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === btn.dataset.tab)); })); }
  showTabs();

  function createSession() {
    return new Promise((resolve, reject) => socket.emit('session:create', { name: state.deviceName }, result => result?.ok ? resolve(result) : reject(new Error('Could not create a session'))));
  }
  function joinSession(code) {
    return new Promise((resolve, reject) => socket.emit('session:join', { code, name: state.deviceName }, result => result?.ok ? resolve(result) : reject(new Error(result?.error || 'Could not join session'))));
  }
  async function ensureSession() {
    if (state.code) return;
    const result = await createSession();
    state.code = result.code; state.selfId = result.selfId; renderSession();
    toast('Your 6-digit code is ready');
  }
  async function joinWithCode(inputId) {
    const code = $(inputId).value.replace(/\D/g, '');
    if (code.length !== 6) return toast('Please enter a 6-digit code');
    try {
      const result = await joinSession(code);
      state.code = result.code; state.selfId = result.selfId;
      result.peers.forEach(peer => { state.peers.set(peer.id, peer); createPeer(peer.id, true); });
      renderSession(); toast('Joined session. Connecting devices…');
    } catch (error) { toast(error.message); }
  }

  $('file-code').addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g,'').slice(0,6));
  $('text-code').addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g,'').slice(0,6));
  document.querySelectorAll('.join-button').forEach(btn => btn.addEventListener('click', () => joinWithCode(btn.dataset.join === 'file' ? 'file-code' : 'text-code')));

  $('choose-file').onclick = () => $('file-input').click();
  $('file-input').addEventListener('change', e => selectFile(e.target.files[0]));
  function selectFile(file) { if (!file) return; state.selectedFile = file; $('selected-file').textContent = `${file.name} · ${formatBytes(file.size)}`; $('send-file').disabled = false; }
  const drop = $('drop-zone');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); selectFile(e.dataTransfer.files[0]); });
  $('text-input').addEventListener('input', e => $('send-text').disabled = !e.target.value.trim());

  $('send-file').onclick = async () => {
    if (!state.selectedFile) return;
    try { await ensureSession(); await waitForPeers(); await sendFileToPeers(state.selectedFile); }
    catch (e) { toast(e.message); }
  };
  $('send-text').onclick = async () => {
    const text = $('text-input').value;
    if (!text.trim()) return;
    try { await ensureSession(); await waitForPeers(); let count = 0; for (const [id, ch] of state.channels) if (ch.readyState === 'open') { ch.send(JSON.stringify({ type: 'text', text, from: state.deviceName, time: Date.now() })); count++; } if (!count) throw new Error('No connected devices yet'); toast(`Text sent to ${count} device(s)`); }
    catch (e) { toast(e.message); }
  };
  function waitForPeers() { return new Promise((resolve, reject) => { const start = Date.now(); const check = () => { if ([...state.channels.values()].some(ch => ch.readyState === 'open')) resolve(); else if (Date.now() - start > 25000) reject(new Error('No devices connected. Ask another device to enter your code.')); else setTimeout(check, 250); }; check(); }); }
  function formatBytes(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`; return `${(bytes/1048576).toFixed(2)} MB`; }

  function createPeer(peerId, initiator) {
    if (state.pcs.has(peerId)) return state.pcs.get(peerId);
    const pc = new RTCPeerConnection({ iceServers: [] });
    state.pcs.set(peerId, pc);
    pc.onicecandidate = e => { if (e.candidate) socket.emit('signal', { to: peerId, data: { candidate: e.candidate } }); };
    pc.onconnectionstatechange = () => { if (['failed','closed','disconnected'].includes(pc.connectionState)) { state.channels.delete(peerId); renderSession(); } };
    pc.ondatachannel = e => setupChannel(peerId, e.channel);
    if (initiator) setupChannel(peerId, pc.createDataChannel('transfer', { ordered: true }));
    if (initiator) pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => socket.emit('signal', { to: peerId, data: { description: pc.localDescription } })).catch(err => toast(`Connection error: ${err.message}`));
    return pc;
  }
  function setupChannel(peerId, channel) {
    channel.binaryType = 'arraybuffer';
    state.channels.set(peerId, channel);
    channel.onopen = () => { renderSession(); toast(`${state.peers.get(peerId)?.name || 'Device'} connected`); };
    channel.onclose = () => { renderSession(); };
    channel.onmessage = e => handleData(peerId, e.data);
    renderSession();
  }
  socket.on('peer:joined', peer => { state.peers.set(peer.id, peer); renderSession(); toast(`${peer.name} joined the session`); });
  socket.on('peer:left', ({ id }) => { const name = state.peers.get(id)?.name || 'A device'; state.peers.delete(id); state.channels.delete(id); state.pcs.get(id)?.close(); state.pcs.delete(id); renderSession(); toast(`${name} left`); });
  socket.on('signal', async ({ from, data }) => {
    try {
      let pc = state.pcs.get(from);
      if (data.description?.type === 'offer') {
        if (!pc) pc = createPeer(from, false);
        await pc.setRemoteDescription(data.description);
        const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, data: { description: pc.localDescription } });
      } else if (data.description?.type === 'answer') { if (pc) await pc.setRemoteDescription(data.description); }
      else if (data.candidate && pc) { try { await pc.addIceCandidate(data.candidate); } catch (_) {} }
    } catch (error) { console.error(error); }
  });

  function sendControl(channel, payload) { if (channel?.readyState === 'open') channel.send(JSON.stringify(payload)); }
  function handleData(peerId, data) {
    const channel = state.channels.get(peerId);
    if (typeof data !== 'string') {
      const transfer = [...state.incomingFiles.values()].find(item => item.peerId === peerId && item.accepted && item.received < item.total);
      if (!transfer) return;
      transfer.parts.push(data); transfer.received += data.byteLength;
      transfer.progress.style.width = `${Math.min(100, transfer.received / transfer.size * 100)}%`;
      if (transfer.received >= transfer.size) {
        const blob = new Blob(transfer.parts, { type: transfer.mime || 'application/octet-stream' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = transfer.name; a.click(); URL.revokeObjectURL(url);
        transfer.row.querySelector('.activity-state').textContent = 'Received · Download started';
        state.incomingFiles.delete(transfer.id); toast(`Received ${transfer.name}`);
      }
      return;
    }
    let msg; try { msg = JSON.parse(data); } catch (_) { return; }
    if (msg.type === 'text') {
      const row = addActivity(`<strong>Text received from ${escapeHtml(state.peers.get(peerId)?.name || msg.from || 'Device')}</strong><small>${new Date(msg.time).toLocaleTimeString()}</small><div style="white-space:pre-wrap;overflow-wrap:anywhere;margin-top:8px">${escapeHtml(msg.text)}</div><button class="copy-button" style="margin-top:8px">Copy text</button>`);
      row.querySelector('button').onclick = () => { navigator.clipboard?.writeText(msg.text); toast('Text copied'); };
    } else if (msg.type === 'file-offer') showIncomingFile(peerId, msg);
    else if (msg.type === 'file-response') { const pending = state.pendingOutgoing.get(msg.id); if (pending) { pending.resolve(msg.accepted); state.pendingOutgoing.delete(msg.id); } }
    else if (msg.type === 'file-done') toast(`${msg.name} transfer completed`);
    else if (msg.type === 'file-cancel') { const item = state.incomingFiles.get(msg.id); if (item) { item.row.querySelector('.activity-state').textContent = 'Transfer cancelled'; state.incomingFiles.delete(msg.id); } }
  }
  function showIncomingFile(peerId, msg) {
    const row = addActivity(`<strong>Incoming file: ${escapeHtml(msg.name)}</strong><small>${formatBytes(msg.size)} · From ${escapeHtml(state.peers.get(peerId)?.name || 'Device')}</small><div class="activity-state" style="margin-top:7px;color:#8b91a8">Waiting for your response</div><div class="activity-actions"><button class="mini-button accept">Accept</button><button class="mini-button reject">Reject</button></div>`);
    row.querySelector('.accept').onclick = () => { const item = { id: msg.id, peerId, name: msg.name, size: msg.size, mime: msg.mime, parts: [], received: 0, total: msg.size, accepted: true, row, progress: null }; const track = document.createElement('div'); track.className = 'progress-track'; track.innerHTML = '<div class="progress-fill"></div>'; row.append(track); item.progress = track.firstElementChild; row.querySelector('.activity-state').textContent = 'Receiving…'; row.querySelector('.activity-actions').remove(); state.incomingFiles.set(msg.id, item); sendControl(state.channels.get(peerId), { type: 'file-response', id: msg.id, accepted: true }); };
    row.querySelector('.reject').onclick = () => { row.querySelector('.activity-state').textContent = 'Rejected'; row.querySelector('.activity-actions').remove(); sendControl(state.channels.get(peerId), { type: 'file-response', id: msg.id, accepted: false }); };
  }
  async function sendFileToPeers(file) {
    const recipients = [...state.channels.entries()].filter(([, ch]) => ch.readyState === 'open');
    if (!recipients.length) throw new Error('No connected devices');
    for (const [peerId, channel] of recipients) {
      const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const row = addActivity(`<strong>Sending ${escapeHtml(file.name)} to ${escapeHtml(state.peers.get(peerId)?.name || 'Device')}</strong><small>${formatBytes(file.size)}</small><div class="activity-state" style="margin-top:7px;color:#8b91a8">Waiting for acceptance…</div><div class="progress-track"><div class="progress-fill"></div></div>`);
      const progress = row.querySelector('.progress-fill');
      sendControl(channel, { type: 'file-offer', id, name: file.name, size: file.size, mime: file.type });
      const accepted = await new Promise(resolve => { const timer = setTimeout(() => { state.pendingOutgoing.delete(id); resolve(false); }, 60000); state.pendingOutgoing.set(id, { resolve: value => { clearTimeout(timer); resolve(value); } }); });
      if (!accepted) { row.querySelector('.activity-state').textContent = 'Not accepted or timed out'; continue; }
      row.querySelector('.activity-state').textContent = 'Sending…';
      try {
        for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
          const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
          await waitForBuffer(channel); channel.send(chunk); progress.style.width = `${Math.min(100, (offset + chunk.byteLength) / file.size * 100)}%`;
        }
        row.querySelector('.activity-state').textContent = 'Sent successfully';
        sendControl(channel, { type: 'file-done', id, name: file.name });
      } catch (e) { row.querySelector('.activity-state').textContent = `Transfer failed: ${e.message}`; }
    }
    toast('File transfer requests sent');
  }
  function waitForBuffer(channel) {
    if (channel.bufferedAmount < 512 * 1024) return Promise.resolve();
    return new Promise(resolve => { channel.bufferedAmountLowThreshold = 256 * 1024; channel.addEventListener('bufferedamountlow', resolve, { once: true }); });
  }
})();
