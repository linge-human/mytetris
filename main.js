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

// --- TetrisGame class (unchanged) ---
class TetrisGame {
  constructor(canvas, onGameOver, onScore, onLineClear) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.BLOCK = Math.floor(Math.min(this.canvas.width/COLS, this.canvas.height/ROWS));
    this.onGameOver = onGameOver;
    this.onScore = onScore;
    this.onLineClear = onLineClear;
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
  addGarbage(n) {} // Not needed in solo
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
    this.ctx.fillStyle = COLORS[v-1];
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

// --- UI for Solo Game ---
const root = document.getElementById("root");
let game = null;

function renderSoloMenu() {
  root.innerHTML = "";
  root.appendChild(
    createElement("div", {className:"menu"}, [
      createElement("h1", null, "Tetris Solo"),
      createElement("button", {className:"btn", onClick: startSoloGame}, "Start Game"),
      createElement("div", {className:"instructions"}, [
        "← → : Move | ↑ : Rotate | ↓ : Drop | Space: Hard Drop | P: Pause"
      ])
    ])
  );
}

function startSoloGame() {
  root.innerHTML = "";
  let boardW = 260, boardH = 520;
  let tcont = createElement("div", {className:"tetris-container"}, [
    createElement("h2", null, "Your Board"),
    createScoreboard(),
    createElement("div", {className:"canvas-wrap"}, [
      createElement("canvas", {id:"canvas", width:boardW, height:boardH})
    ]),
    createElement("div", {id:"overlay", className:"overlay", style:"display:none;"})
  ]);
  root.appendChild(tcont);

  let canvas = el("#canvas");
  game = new TetrisGame(
    canvas,
    ()=>showOverlay("overlay","Game Over<br><button class='btn' onclick='window.location.reload()'>Restart</button>"),
    (s,l,v)=>updateScoreboard(s,l,v)
  );
  game.reset();
  game.spawn();
  game.draw();
  game.start();
  el("#overlay").style.display = "none";
  document.addEventListener('keydown', handleKey);
}

function handleKey(e) {
  if (!game || game.gameOver || game.paused) return;
  if (e.key==="ArrowLeft") game.move(-1);
  else if (e.key==="ArrowRight") game.move(1);
  else if (e.key==="ArrowDown") game.drop();
  else if (e.key==="ArrowUp") game.turn();
  else if (e.key===" ") game.hardDrop();
  else if (e.key==="p"||e.key==="P") {
    game.togglePause();
    if (game.paused) showOverlay("overlay", "Paused");
    else hideOverlay("overlay");
  }
  game.draw();
}

function createScoreboard() {
  return createElement("div", {className:"scoreboard", id:`scoreboard`}, [
    createElement("div", null, "Score: ", createElement("span", {id:`score`}, "0")),
    createElement("div", null, "Lines: ", createElement("span", {id:`lines`}, "0")),
    createElement("div", null, "Level: ", createElement("span", {id:`level`}, "1"))
  ]);
}
function updateScoreboard(s, l, v) {
  el(`#score`).textContent = s;
  el(`#lines`).textContent = l;
  el(`#level`).textContent = v;
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
renderSoloMenu();
