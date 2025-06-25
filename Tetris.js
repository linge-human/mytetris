// Responsive, functional minimalist Tetris

const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const ROWS = 20, COLS = 10;
let BLOCK = 24; // base, will be set by resize
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
let board, piece, next, score, lines, level, dropInterval, gameOver, paused, animId;
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const startBtn = document.getElementById('startBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const tetrisContainer = document.getElementById('tetrisContainer');

function reset() {
  board = Array.from({length: ROWS},()=>Array(COLS).fill(0));
  score = 0; lines = 0; level = 1; dropInterval = 600; gameOver = false; paused = false;
  spawn(); next = randomPiece();
  updateScore();
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Draw board
  board.forEach((row,y) => row.forEach((v,x) => v && drawBlock(x,y,v)));
  // Draw piece
  piece.shape.forEach((r,dy) => r.forEach((v,dx) => {
    if(v) drawBlock(piece.x + dx, piece.y + dy, v);
  }));
  // Draw grid (optional for minimal look)
  // for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) {
  //   ctx.strokeStyle='#222'; ctx.strokeRect(x*BLOCK,y*BLOCK,BLOCK,BLOCK);
  // }
}

function drawBlock(x,y,v) {
  ctx.fillStyle = COLORS[v-1];
  ctx.fillRect(x*BLOCK+1,y*BLOCK+1,BLOCK-2,BLOCK-2);
}

function randomPiece() {
  let i = Math.floor(Math.random()*SHAPES.length);
  return {shape:SHAPES[i].map(r=>[...r]), x:3, y:0, type:i+1};
}

function spawn() {
  piece = next || randomPiece();
  piece.x = 3; piece.y = 0;
  next = randomPiece();
  if(collide(0,0,piece.shape)) { gameOver = true; cancelAnimationFrame(animId); draw(); alert("Game Over!"); }
}

function collide(dx,dy,shape) {
  return shape.some((row, y) => row.some((v, x) =>
    v && (
      board[y+piece.y+dy]?.[x+piece.x+dx] ||
      x+piece.x+dx<0 || x+piece.x+dx>=COLS ||
      y+piece.y+dy>=ROWS
    )
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
  animId = requestAnimationFrame(update);
}

function handleResize() {
  // Responsive: Board should fill available height (minus a little for UI)
  const cont = tetrisContainer;
  // find max possible canvas size
  const pad = cont.offsetWidth > 600 ? 64 : 8;
  let W = Math.min(window.innerWidth, cont.offsetWidth) - pad;
  let H = Math.min(window.innerHeight, cont.offsetHeight) - pad;
  // maintain aspect (1:2)
  if (H > W*2) H = W*2;
  else W = H/2;
  canvas.width = COLS * Math.floor(W/COLS);
  canvas.height = ROWS * Math.floor(H/ROWS);
  BLOCK = Math.floor(canvas.width/COLS);
  draw();
}

window.addEventListener('resize', handleResize);

document.addEventListener('keydown', e => {
  if(gameOver) return;
  if(e.key=="Tab") {
    e.preventDefault();
    document.body.innerHTML = ""; // Blank page
    return;
  }
  if(paused) return;
  if(e.key=="ArrowLeft") move(-1);
  else if(e.key=="ArrowRight") move(1);
  else if(e.key=="ArrowDown") drop();
  else if(e.key=="ArrowUp") turn();
  else if(e.key==" ") hardDrop();
  draw();
});

document.addEventListener('keydown', e => {
  if(e.key=="p"||e.key=="P") {
    paused=!paused;
    pauseOverlay.hidden = !paused;
    if(!paused) update();
    else cancelAnimationFrame(animId);
  }
});

startBtn.onclick = () => {
  reset();
  pauseOverlay.hidden = true;
  handleResize();
  cancelAnimationFrame(animId);
  last=performance.now(); dropAcc=0;
  update();
};

reset();
handleResize();
draw();

