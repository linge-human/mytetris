// Minimalist Tetris by Copilot
const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const ROWS = 20, COLS = 10, BLOCK = 20;
const COLORS = ["#0ff","#f00","#ff0","#0f0","#00f","#f0f","#fa0"];
const SHAPES = [
  [[1,1,1,1]], // I
  [[2,2,2],[0,2,0]], // T
  [[3,3,0],[0,3,3]], // S
  [[0,4,4],[4,4,0]], // Z
  [[5,5,5],[5,0,0]], // L
  [[6,6,6],[0,0,6]], // J
  [[7,7],[7,7]] // O
];
let board, piece, next, score, lines, level, dropInterval, gameOver, paused;
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const startBtn = document.getElementById('startBtn');

function reset() {
  board = Array.from({length: ROWS},()=>Array(COLS).fill(0));
  score = 0; lines = 0; level = 1; dropInterval = 600; gameOver = false; paused = false;
  spawn(); next = randomPiece();
  updateScore();
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  board.forEach((row,y) => row.forEach((v,x) => v && drawBlock(x,y,v)));
  piece.shape.forEach((r,dy) => r.forEach((v,dx) => {
    if(v) drawBlock(piece.x + dx, piece.y + dy, v);
  }));
}

function drawBlock(x,y,v) {
  ctx.fillStyle = COLORS[v-1];
  ctx.fillRect(x*BLOCK,y*BLOCK,BLOCK-1,BLOCK-1);
}

function randomPiece() {
  let i = Math.floor(Math.random()*SHAPES.length);
  return {shape:SHAPES[i].map(r=>[...r]), x:3, y:0, type:i+1};
}

function spawn() {
  piece = next || randomPiece();
  piece.x = 3; piece.y = 0;
  next = randomPiece();
  if(collide(0,0,piece.shape)) { gameOver = true; draw(); alert("Game Over!"); }
}

function collide(dx,dy,shape) {
  return shape.some((row, y) => row.some((v, x) =>
    v && (board[y+piece.y+dy]?.[x+piece.x+dx] || x+piece.x+dx<0 || x+piece.x+dx>=COLS || y+piece.y+dy>=ROWS)
  ));
}

function merge() {
  piece.shape.forEach((r,dy) => r.forEach((v,dx) => {
    if(v && piece.y+dy>=0) board[piece.y+dy][piece.x+dx]=v;
  }));
}

function rotate(mat) {
  return mat[0].map((_,i)=>mat.map(r=>r[i]).reverse());
}

function drop() {
  if(gameOver || paused) return;
  if(!collide(0,1,piece.shape)) { piece.y++; }
  else {
    merge();
    clearLines();
    spawn();
  }
  draw();
}

function hardDrop() {
  while(!collide(0,1,piece.shape)) piece.y++;
  drop();
}

function move(dir) {
  if(!collide(dir,0,piece.shape)) piece.x+=dir;
}

function turn() {
  let rot = rotate(piece.shape);
  if(!collide(0,0,rot)) piece.shape=rot;
}

function clearLines() {
  let count=0;
  board = board.filter(r=>!(r.every(v=>v)));
  count = ROWS-board.length;
  while(board.length<ROWS) board.unshift(Array(COLS).fill(0));
  if(count) {
    score += [0,40,100,300,1200][count]*(level);
    lines += count;
    level = 1 + Math.floor(lines/10);
    dropInterval = 600-Math.min(500,level*50);
    updateScore();
  }
}

function updateScore() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

let last = 0, dropAcc = 0;
function update(now=0) {
  if(gameOver) return;
  let dt = now-last; last=now;
  if(!paused) {
    dropAcc += dt;
    if(dropAcc > dropInterval) {
      drop();
      dropAcc = 0;
    }
    draw();
  }
  requestAnimationFrame(update);
}

document.addEventListener('keydown', e => {
  if(gameOver || paused) return;
  if(e.key=="ArrowLeft") move(-1);
  else if(e.key=="ArrowRight") move(1);
  else if(e.key=="ArrowDown") drop();
  else if(e.key=="ArrowUp") turn();
  else if(e.key==" ") hardDrop();
  draw();
});

document.addEventListener('keydown', e => {
  if(e.key=="p"||e.key=="P") { paused=!paused; if(!paused) update(); }
});

startBtn.onclick = () => {
  reset();
  update();
};

reset();
draw();
