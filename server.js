// Simple WebSocket Tetris battle server
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });
const rooms = {}; // roomId -> [ { ws, name, id } ]

function broadcast(roomId, msg, exceptId) {
  (rooms[roomId]||[]).forEach(p => {
    if (p.id !== exceptId && p.ws.readyState === WebSocket.OPEN)
      p.ws.send(JSON.stringify(msg));
  });
}

function getPlayers(roomId) {
  return (rooms[roomId]||[]).map(p => ({id: p.id, name: p.name}));
}

wss.on('connection', ws => {
  let player = { ws, roomId: null, id: null, name: null };
  ws.on('message', msgRaw => {
    let msg = {};
    try { msg = JSON.parse(msgRaw); } catch {}
    // Join room
    if (msg.type === 'join') {
      player.name = msg.name || "Player";
      player.roomId = msg.room;
      player.id = Math.random().toString(36).substr(2,8);
      if (!rooms[player.roomId]) rooms[player.roomId] = [];
      rooms[player.roomId].push(player);
      // Send your id and list of players
      ws.send(JSON.stringify({type:'joined', id: player.id, players: getPlayers(player.roomId)}));
      // Notify other players
      broadcast(player.roomId, {type: 'players', players: getPlayers(player.roomId)}, player.id);
    }
    // Relay game state
    if (msg.type === 'state' && player.roomId && player.id) {
      // Attach sender id
      msg.from = player.id;
      broadcast(player.roomId, msg, player.id);
    }
    // Chat (optional)
    if (msg.type === 'chat' && player.roomId) {
      broadcast(player.roomId, {type:'chat', name:player.name, text:msg.text}, null);
    }
  });
  ws.on('close', () => {
    if (player.roomId && rooms[player.roomId]) {
      rooms[player.roomId] = rooms[player.roomId].filter(p => p !== player);
      broadcast(player.roomId, {type:'players', players: getPlayers(player.roomId)}, player.id);
      if (rooms[player.roomId].length === 0) delete rooms[player.roomId];
    }
  });
});

console.log("Tetris Server started on ws://localhost:3000/");
