// --- Tetris game logic ---
const ROWS = 20, COLS = 10, COLORS = ["#0ff","#f00","#ff0","#0f0","#00f","#f0f","#fa0"];
const SHAPES = [
  [[1,1,1,1]], [[2,2,2],[0,2,0]], [[3,3,0],[0,3,3]], [[0,4,4],[4,4,0]],
  [[5,5,5],[5,0,0]], [[6,6,6],[0,0,6]], [[7,7],[7,7]]
];
// -- Utility --
const el = sel => document.querySelector(sel);
// --- Reactivity helpers ---
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
// --- Tetris core class ---
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
      // hole in random place
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
    // board
    this.board.forEach((row,y) => row.forEach((v,x) => v && this.drawBlock(x,y,v)));
    // piece
    this.piece && this.piece.shape.forEach((r,dy) => r.forEach((v,dx) => {
      if(v) this.drawBlock(this.piece.x+dx,this.piece.y+dy,v);
    }));
    // grid: for minimalist look, skip
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

// --- UI & App logic ---
const root = document.getElementById("root");
let mode = null; // "solo" | "battle"
let playerGame, oppGame;
let peer, isInitiator = false;
let controlsActive = false;
let opponentConnected = false;

function renderMenu() {
  root.innerHTML = "";
  root.appendChild(
    createElement("div", {className:"main-menu"}, [
      createElement("h1", null, "Tetris"),
      createElement("button", {className:"btn", onClick: startSolo}, "Solo Mode"),
      createElement("button", {className:"btn", onClick: startBattle}, "Battle Mode"),
      createElement("div", {className:"instructions"}, [
        "← → : Move | ↑ : Rotate | ↓ : Drop | Space: Hard Drop | P: Pause"
      ])
    ])
  );
}

function startSolo() {
  mode = "solo";
  renderGameUI({solo:true});
  startPlayerGame();
}

function startBattle() {
  mode = "battle";
  // If URL has battle id, join, else create and show link
  let hash = window.location.hash.replace("#","");
  if (hash.length > 8 && hash.startsWith("battle-")) {
    renderGameUI({battle:true, waiting:true});
    joinBattle(hash);
  } else {
    // Generate id and link
    let id = "battle-" + Math.random().toString(36).substring(2,12);
    window.location.hash = id;
    renderBattleLink(id);
  }
}

function renderBattleLink(id) {
  root.innerHTML = "";
  let link = `${window.location.origin}${window.location.pathname}#${id}`;
  root.appendChild(
    createElement("div", {className:"battle-link"}, [
      createElement("h1", null, "Battle Mode"),
      createElement("div", null, "Share this link with your friend:"),
      createElement("input", {type:"text", value:link, readOnly:true, onClick:(e)=>e.target.select()}),
      createElement("button", {className:"btn", onClick:()=>navigator.clipboard.writeText(link)}, "Copy Link"),
      createElement("div", {style:{fontSize:"1.2em",color:"#aaa"}}, "Waiting for opponent to join..."),
      createElement("button", {className:"btn", onClick:()=>{window.location.hash=""; renderMenu();}}, "Back")
    ])
  );
  waitForPeer(id);
}

function renderGameUI(opts={}) {
  root.innerHTML = "";
  let boardW = 300, boardH = 600;
  let tetrisFlex = createElement("div", {className:"tetris-flex"}, []);
  let game1 = createElement("div", {className:"tetris-container"}, [
    createElement("h2", {style:"color:#0ff;"}, opts.battle ? "You" : "Solo"),
    createScoreboard("you"),
    createElement("div", {className:"canvas-wrap"}, [
      createElement("canvas", {id:"canvas1", width:boardW, height:boardH})
    ]),
    createElement("div", {className:"instructions"}, [
      "← → : Move | ↑ : Rotate | ↓ : Drop | Space: Hard Drop | P: Pause"
    ]),
    createElement("div", {id:"overlay1", className:"overlay", style:"display:none;"})
  ]);
  tetrisFlex.append(game1);
  if (opts.battle) {
    let game2 = createElement("div", {className:"tetris-container"}, [
      createElement("h2", {style:"color:#f55;"}, "Opponent"),
      createScoreboard("opponent"),
      createElement("div", {className:"canvas-wrap"}, [
        createElement("canvas", {id:"canvas2", width:boardW, height:boardH})
      ]),
      createElement("div", {id:"overlay2", className:"overlay", style:"display:block;"}, "Waiting for opponent...")
    ]);
    tetrisFlex.append(game2);
  }
  root.appendChild(tetrisFlex);
  if (opts.solo) {
    controlsActive = true;
    el("#overlay1").style.display = "none";
  }
  if (opts.battle) {
    controlsActive = false;
    el("#overlay1").style.display = "block";
    el("#overlay1").textContent = "Connecting...";
    el("#overlay2").style.display = "block";
    el("#overlay2").textContent = "Waiting for opponent...";
  }
}

function createScoreboard(who) {
  return createElement("div", {className:"scoreboard", id:`scoreboard-${who}`}, [
    createElement("div", null, "Score: ", createElement("span", {id:`score-${who}`}, "0")),
    createElement("div", null, "Lines: ", createElement("span", {id:`lines-${who}`}, "0")),
    createElement("div", null, "Level: ", createElement("span", {id:`level-${who}`}, "1"))
  ]);
}

// --- Game setup ---
function startPlayerGame() {
  let canvas = el("#canvas1");
  playerGame = new TetrisGame(canvas,
    ()=>showOverlay("overlay1","Game Over"),
    (s,l,v)=>updateScoreboard("you",s,l,v),
    ()=>{},
    ()=>{}
  );
  playerGame.reset();
  playerGame.spawn();
  playerGame.draw();
  playerGame.start();
  el("#overlay1").style.display = "none";
  controlsActive = true;
}
function updateScoreboard(who, s, l, v) {
  el(`#score-${who}`).textContent = s;
  el(`#lines-${who}`).textContent = l;
  el(`#level-${who}`).textContent = v;
}
function showOverlay(id, msg) {
  let o = el(`#${id}`);
  if (o) { o.innerHTML = msg; o.style.display = "flex"; }
  controlsActive = false;
}
function hideOverlay(id) {
  let o = el(`#${id}`);
  if (o) o.style.display = "none";
}

// --- BATTLE MODE Networking ---
function waitForPeer(id) {
  isInitiator = true;
  peer = new SimplePeer({initiator: true, trickle:false});
  peer.on('signal', data => {
    window.peerSignal = JSON.stringify(data);
    window.location.hash = id + "." + btoa(JSON.stringify(data));
  });
  peer.on('connect', ()=> {
    renderGameUI({battle:true});
    setupBattleGame(true);
  });
  peer.on('data', handlePeerData);
  // Wait for opponent to join with link containing .[signal]
  window.onhashchange = ()=>{
    let [_, s] = window.location.hash.split(".");
    if (s) {
      peer.signal(JSON.parse(atob(s)));
    }
  };
}
function joinBattle(id) {
  isInitiator = false;
  let [battleid, sig] = id.split(".");
  peer = new SimplePeer({initiator:false, trickle:false});
  peer.on('signal', data => {
    window.location.hash = battleid + "." + btoa(JSON.stringify(data));
  });
  peer.on('connect', ()=> {
    renderGameUI({battle:true});
    setupBattleGame(false);
  });
  peer.on('data', handlePeerData);
  if (sig) peer.signal(JSON.parse(atob(sig)));
}

// --- Battle gameplay ---
function setupBattleGame(youAreInitiator) {
  // Our game
  let canvas1 = el("#canvas1");
  let canvas2 = el("#canvas2");
  playerGame = new TetrisGame(canvas1,
    ()=>{ showOverlay("overlay1","Game Over"); sendPeer({gameOver:true}); },
    (s,l,v)=>{ updateScoreboard("you",s,l,v); sendPeer({score:s,lines:l,level:v}); },
    (count)=>{ if(count>1) sendPeer({garbage:count-1}); },
    (count)=>{ if(count>1) sendPeer({garbage:count-1}); }
  );
  playerGame.reset();
  playerGame.spawn();
  playerGame.draw();
  oppGame = new TetrisGame(canvas2,
    ()=>showOverlay("overlay2","Opponent Lost!"),
    (s,l,v)=>updateScoreboard("opponent",s,l,v)
  );
  oppGame.reset();
  oppGame.spawn();
  oppGame.draw();
  // You start first if you created the room
  controlsActive = true;
  el("#overlay1").style.display = "none";
  el("#overlay2").style.display = "none";
  opponentConnected = true;
}
function sendPeer(data) {
  try { peer && peer.send && peer.send(JSON.stringify(data)); } catch{}
}
function handlePeerData(raw) {
  let data = {};
  try { data = JSON.parse(raw); } catch {}
  // Handle different messages
  if (data.score !== undefined) updateScoreboard("opponent", data.score, data.lines, data.level);
  if (data.gameOver) showOverlay("overlay2","Opponent Lost!");
  if (data.garbage) playerGame.addGarbage(data.garbage);
}

// --- Event listeners ---
document.addEventListener('keydown', e => {
  if (!controlsActive) return;
  if (e.key === "Tab") { e.preventDefault(); document.body.innerHTML = ""; return; }
  if (playerGame && !playerGame.gameOver && !playerGame.paused) {
    if (e.key==="ArrowLeft") playerGame.move(-1);
    else if (e.key==="ArrowRight") playerGame.move(1);
    else if (e.key==="ArrowDown") playerGame.drop();
    else if (e.key==="ArrowUp") playerGame.turn();
    else if (e.key===" ") playerGame.hardDrop();
    else if (e.key==="p"||e.key==="P") {
      playerGame.togglePause();
      if (playerGame.paused) showOverlay("overlay1","Paused");
      else hideOverlay("overlay1");
    }
    playerGame.draw();
  }
});

// --- Start ---
renderMenu();
