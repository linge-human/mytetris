const WS_URL = "ws://localhost:3000/"; // Change to your server address if needed
const ROWS = 20, COLS = 10, COLORS = ["#0ff","#f00","#ff0","#0f0","#00f","#f0f","#fa0"];
const SHAPES = [
  [[1,1,1,1]], [[2,2,2],[0,2,0]], [[3,3,0],[0,3,3]], [[0,4,4],[4,4,0]],
  [[5,5,5],[5,0,0]], [[6,6,6],[0,0,6]], [[7,7],[7,7]]
];

const el = sel => document.querySelector(sel);

function createElement(tag, props, ...children) {
  const elem = document.createElement(tag);
  if (props) for (let k in props) {
    if (k.startsWith("on") && typeof props[k] === "function") elem.addEventListener(k.slice(2).toLowerCase(), props[k]);
    else if (k === "style" && typeof props[k] === "object") Object.assign(elem.style, props[k]);
    else if (k === "className") elem.className = props[k];
    else elem.setAttribute(k, props[k]);
  }
  for (let c of children.flat()) {
    if (c instanceof Node) elem.appendChild(c);
    else if (c != null) elem.append(String(c));
  }
  return elem;
}

// --- TetrisGame class (as before, minimal changes) ---
class TetrisGame {
  constructor(canvas, onGameOver, onScore, onLineClear, onSendGarbage) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.BLOCK = Math.floor(Math.min(this.canvas.width/COLS, this.canvas.height/ROWS));
    this.onGameOver = onGameOver;
    this.onScore = onScore;
    this.onLineClear = onLineClear;
    this.onSendGarbage = onSendGarbage;
    this.init();
  }
  init() {
    this.board = Array.from({length: ROWS},()=>Array(COLS).fill(0));
    this.score = 0; this.lines = 0; this.level = 1;
    this.dropInterval = 600; this.gameOver = false;
    this.paused = false;
    this.piece = null; this.next = this.randomPiece();
    this.animId = null;
    this.garbageQueue = 0;
  }
  randomPiece() {
    let i = Math.floor(Math.random()*SHAPES.length);
    return {shape: SHAPES[i].map(r=>[...r]), x:3, y:0, type:i+1};
  }
  spawn() {
    this.piece = this.next || this.randomPiece();
    this.piece.x = 3; this.piece.y = 0;
    this.next = this.randomPiece();
    if (this.collide(0,0,this.piece.shape)) {
      this.gameOver = true;
      this.stop();
      this.onGameOver && this.onGameOver();
    }
  }
  collide(dx,dy,shape) {
    return shape.some((row,y) => row.some((v,x) =>
      v && (
        this.board[y+this.piece.y+dy]?.[x+this.piece.x+dx]
        || x+this.piece.x+dx<0
        || x+this.piece.x+dx>=COLS
        || y+this.piece.y+dy>=ROWS
      )
    ));
  }
  merge() {
    this.piece.shape.forEach((r,dy) => r.forEach((v,dx) => {
      if(v && this.piece.y+dy>=0) this.board[this.piece.y+dy][this.piece.x+dx]=v;
    }));
  }
  rotate(mat) {
    return mat[0].map((_,i) => mat.map(r=>r[i]).reverse());
  }
  drop() {
    if(this.gameOver || this.paused) return;
    if(!this.collide(0,1,this.piece.shape)) this.piece.y++;
    else {
      this.merge();
      let lines = this.clearLines();
      if(lines && this.onSendGarbage) this.onSendGarbage(lines);
      this.spawn();
    }
    this.draw();
  }
  hardDrop() {
    while(!this.collide(0,1,this.piece.shape)) this.piece.y++;
    this.drop();
  }
  move(dir) {
    if(!this.collide(dir,0,this.piece.shape)) this.piece.x+=dir;
  }
  turn() {
    let rot = this.rotate(this.piece.shape);
    if(!this.collide(0,0,rot)) this.piece.shape=rot;
  }
  clearLines() {
    let before = this.board.length;
    let newBoard = this.board.filter(r=>!r.every(v=>v));
    let count = ROWS - newBoard.length;
    while(newBoard.length<ROWS) newBoard.unshift(Array(COLS).fill(0));
    this.board = newBoard;
    if(count) {
      this.score += [0,40,100,300,1200][count]*this.level;
      this.lines += count;
      this.level = 1 + Math.floor(this.lines/10);
      this.dropInterval = Math.max(100, 600 - this.level*50);
      this.onScore && this.onScore(this.score, this.lines, this.level);
      if (this.onLineClear) this.onLineClear(count);
    }
    return count;
  }
  addGarbage(n) {
    for(let i=0;i<n;i++) {
      this.board.shift();
      let row = Array(COLS).fill(9);
      row[Math.floor(Math.random()*COLS)] = 0;
      this.board.push(row);
    }
    this.draw();
  }
  updateScore() {
    this.onScore && this.onScore(this.score, this.lines, this.level);
  }
  draw() {
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.board.forEach((row,y) => row.forEach((v,x) => v && this.drawBlock(x,y,v)));
    this.piece && this.piece.shape.forEach((r,dy) => r.forEach((v,dx) => {
      if(v) this.drawBlock(this.piece.x+dx,this.piece.y+dy,v);
    }));
  }
  drawBlock(x,y,v) {
    this.ctx.fillStyle = v===9?"#333":COLORS[v-1];
    this.ctx.fillRect(x*this.BLOCK+1,y*this.BLOCK+1,this.BLOCK-2,this.BLOCK-2);
  }
  start() {
    this.stopped = false;
    this.last = performance.now(); this.dropAcc = 0;
    this.loop();
  }
  stop() {
    this.stopped = true;
    this.animId && cancelAnimationFrame(this.animId);
  }
  loop(now=0) {
    if(this.gameOver || this.stopped) return;
    let dt = now-this.last; this.last=now;
    if(!this.paused) {
      this.dropAcc += dt;
      if(this.dropAcc > this.dropInterval) {
        this.drop(); this.dropAcc = 0;
      }
      this.draw();
    }
    this.animId = requestAnimationFrame(this.loop.bind(this));
  }
  togglePause() {
    this.paused = !this.paused;
  }
  reset() {
    this.init();
    this.spawn();
    this.draw();
    this.updateScore();
  }
}

const root = document.getElementById("root");
let ws = null, myId = null, roomId = null, myName = "", players = [], games = {}, ready = false;

function renderMenu() {
  root.innerHTML = "";
  root.appendChild(
    createElement("div", {className:"menu"}, [
      createElement("h1", null, "Tetris Online Battle"),
      createElement("input", {type:"text", id:"nameInput", placeholder:"Your name", style:{fontSize:"1.1em",padding:"0.3em"}}),
      createElement("input", {type:"text", id:"roomInput", placeholder:"Room code (or leave blank for random)", style:{fontSize:"1.1em",padding:"0.3em"}}),
      createElement("button", {className:"btn", onClick: joinRoom}, "Join Room"),
      createElement("div", {className:"instructions"}, [
        "← → : Move | ↑ : Rotate | ↓ : Drop | Space: Hard Drop | P: Pause"
      ])
    ])
  );
}

function joinRoom() {
  myName = el("#nameInput").value.trim() || "Player";
  roomId = el("#roomInput").value.trim() || ("room" + Math.random().toString(36).substr(2,6));
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    ws.send(JSON.stringify({type:"join", room: roomId, name: myName}));
  };
  ws.onmessage = handleMessage;
  ws.onclose = () => {
    root.innerHTML = "<h2>Disconnected from server.</h2>";
  };
}

function handleMessage(ev) {
  let msg = {};
  try { msg = JSON.parse(ev.data); } catch {}
  if (msg.type === "joined") {
    myId = msg.id;
    players = msg.players;
    renderLobby();
  }
  if (msg.type === "players") {
    players = msg.players;
    renderLobby();
  }
  if (msg.type === "state" && ready) {
    let {from, board, score, lines, level, gameOver} = msg;
    if (games[from]) {
      games[from].setRemoteState(board, score, lines, level, gameOver);
    }
  }
  if (msg.type === "chat") {
    // Optional: add chat support
  }
}

function renderLobby() {
  let isHost = players[0]?.id === myId;
  root.innerHTML = "";
  root.appendChild(
    createElement("div", {className:"lobby"}, [
      createElement("h1", null, "Room: " + roomId),
      createElement("div", null, "Players:"),
      ...players.map(p =>
        createElement("div", {className:"player-label "+(p.id===myId?"you":"opponent")},
          p.name, (p.id===myId?" (You)":"")
        )
      ),
      createElement("button", {
        className:"btn",
        disabled: players.length<2 || !isHost,
        onClick: startBattle
      }, "Start Battle ("+players.length+" players)"),
      createElement("button", {className:"btn", onClick: renderMenu}, "Leave Room")
    ])
  );
}

function startBattle() {
  root.innerHTML = "";
  ready = true;
  let boardW = 260, boardH = 520;
  let flex = createElement("div", {className:"battle-flex"}, []);
  // Render a Tetris board for each player
  players.forEach((p,i) => {
    let isMe = p.id === myId;
    let colorClass = isMe ? "you" : "opponent";
    let tcont = createElement("div", {className:"tetris-container", id:"cont-"+p.id}, [
      createElement("h2", {className:colorClass}, p.name + (isMe?" (You)":"")),
      createScoreboard(p.id),
      createElement("div", {className:"canvas-wrap"}, [
        createElement("canvas", {id:"canvas-"+p.id, width:boardW, height:boardH})
      ]),
      createElement("div", {id:"overlay-"+p.id, className:"overlay", style:"display:none;"})
    ]);
    flex.appendChild(tcont);
  });
  root.appendChild(flex);

  // Set up each game object
  players.forEach(p => {
    let canvas = el("#canvas-"+p.id);
    let overlayId = "overlay-"+p.id;
    if (p.id === myId) {
      let game = new TetrisGame(canvas,
        ()=>showOverlay(overlayId,"Game Over"),
        (s,l,v)=>updateScoreboard(myId,s,l,v),
        (count)=>{ if(count>1) sendState(); },
        (count)=>{ if(count>1) sendState(); }
      );
      // Extend: send board state to server
      game.setRemoteState = ()=>{};
      games[myId] = game;
      game.reset();
      game.spawn();
      game.draw();
      game.start();
      el("#overlay-"+myId).style.display = "none";
      document.addEventListener('keydown', handleKey);
      setInterval(sendState, 100);
    } else {
      // Opponent view: update on state messages
      let game = new TetrisGame(canvas,
        ()=>showOverlay(overlayId,"Game Over"),
        (s,l,v)=>updateScoreboard(p.id,s,l,v)
      );
      game.setRemoteState = (board, score, lines, level, gameOver) => {
        if (board) game.board = board;
        if (score !== undefined) game.score = score;
        if (lines !== undefined) game.lines = lines;
        if (level !== undefined) game.level = level;
        if (gameOver) showOverlay(overlayId,"Game Over");
        game.draw();
        updateScoreboard(p.id, game.score, game.lines, game.level);
      };
      games[p.id] = game;
      game.reset();
      game.spawn();
      game.draw();
      el("#overlay-"+p.id).style.display = "none";
    }
  });
}

function sendState() {
  if (!ws || !games[myId]) return;
  ws.send(JSON.stringify({
    type:"state",
    board: games[myId].board,
    score: games[myId].score,
    lines: games[myId].lines,
    level: games[myId].level,
    gameOver: games[myId].gameOver
  }));
}
function handleKey(e) {
  if (!games[myId] || games[myId].gameOver || games[myId].paused) return;
  let game = games[myId];
  if (e.key==="ArrowLeft") game.move(-1);
  else if (e.key==="ArrowRight") game.move(1);
  else if (e.key==="ArrowDown") game.drop();
  else if (e.key==="ArrowUp") game.turn();
  else if (e.key===" ") game.hardDrop();
  else if (e.key==="p"||e.key==="P") {
    game.togglePause();
    if (game.paused) showOverlay("overlay-"+myId, "Paused");
    else hideOverlay("overlay-"+myId);
  }
  game.draw();
  sendState();
}

function createScoreboard(who) {
  return createElement("div", {className:"scoreboard", id:`scoreboard-${who}`}, [
    createElement("div", null, "Score: ", createElement("span", {id:`score-${who}`}, "0")),
    createElement("div", null, "Lines: ", createElement("span", {id:`lines-${who}`}, "0")),
    createElement("div", null, "Level: ", createElement("span", {id:`level-${who}`}, "1"))
  ]);
}
function updateScoreboard(who, s, l, v) {
  el(`#score-${who}`).textContent = s;
  el(`#lines-${who}`).textContent = l;
  el(`#level-${who}`).textContent = v;
}
function showOverlay(id, msg) {
  let o = el(`#${id}`);
  if (o) { o.innerHTML = msg; o.style.display = "flex"; }
}
function hideOverlay(id) {
  let o = el(`#${id}`);
  if (o) o.style.display = "none";
}

// Start
renderMenu();
