import { PLAYER_CLASSES, type PlayerClass } from './PlayerClass';
import { SpecialBlockType } from './ItemManager';
import { SHAPES, type ShapeType, Tetromino } from './Tetromino';

interface PracticeState {
  x: number;
  y: number;
  rotation: number;
  shape: ShapeType;
  board: string[][];
  garbage: number;
  score: number;
  lines: number;
  objective: number;
  lastAction: string;
}

const STYLE_ID = 'cascade-interactive-tutorial-style';
const OVERLAY_ID = 'cascade-interactive-tutorial-overlay';
const COLS = 10;
const ROWS = 20;
const CELL = 22;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .cit-launch { margin: .7rem 1.5rem 0; padding: .72rem 1rem; border: 1px solid rgba(0,229,255,.55); border-radius: .55rem; color:#00e5ff; background:rgba(0,229,255,.08); font:700 .7rem/1 Inter,sans-serif; letter-spacing:.12em; cursor:pointer; }
    .cit-launch:hover { background:rgba(0,229,255,.18); transform:translateY(-1px); }
    .cit-overlay { position:fixed; inset:0; z-index:80; display:none; align-items:center; justify-content:center; padding:1rem; background:rgba(2,4,15,.9); backdrop-filter:blur(8px); }
    .cit-overlay.open { display:flex; }
    .cit-panel { width:min(100%,1080px); max-height:94vh; overflow:auto; background:linear-gradient(145deg,#15183e,#07091d); border:1px solid rgba(0,229,255,.4); border-radius:1rem; color:#eef2ff; box-shadow:0 0 70px rgba(0,229,255,.14); }
    .cit-head { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding:1rem 1.25rem; border-bottom:1px solid rgba(169,176,255,.2); }
    .cit-head h2 { margin:0; font:800 1rem/1.3 Inter,sans-serif; } .cit-head p { margin:.3rem 0 0; color:#00e5ff; font:700 .62rem/1.2 'Press Start 2P',monospace; letter-spacing:.12em; }
    .cit-close { border:1px solid rgba(255,255,255,.25); color:white; background:transparent; border-radius:.4rem; width:2rem; height:2rem; cursor:pointer; font-size:1.2rem; }
    .cit-tabs { display:flex; gap:.4rem; overflow:auto; padding:.8rem 1.25rem 0; } .cit-tab { padding:.55rem .75rem; border:1px solid rgba(169,176,255,.2); border-bottom:0; border-radius:.4rem .4rem 0 0; background:rgba(255,255,255,.04); color:#a4aac5; cursor:pointer; font:700 .68rem Inter,sans-serif; white-space:nowrap; } .cit-tab.active { background:#00e5ff; color:#06101b; }
    .cit-view { display:none; padding:1.25rem; } .cit-view.active { display:block; }
    .cit-practice-grid { display:grid; grid-template-columns:minmax(260px,1fr) minmax(230px,.8fr); gap:1.2rem; align-items:start; } .cit-board-wrap { display:flex; justify-content:center; padding:1rem; border:1px solid rgba(0,229,255,.2); background:#050713; border-radius:.7rem; } .cit-board { width:min(100%,220px); height:auto; image-rendering:pixelated; background:#080b1d; border:2px solid #27305e; }
    .cit-copy h3 { margin:0 0 .45rem; font:800 1.05rem Inter,sans-serif; } .cit-copy p { color:#b8bed7; font:400 .88rem/1.5 Inter,sans-serif; } .cit-objective { padding:.75rem; border-left:3px solid #ffc107; background:rgba(255,193,7,.08); color:#ffe8a6; font:700 .8rem/1.45 Inter,sans-serif; }
    .cit-actions { display:flex; flex-wrap:wrap; gap:.45rem; margin-top:.8rem; } .cit-action { padding:.58rem .7rem; border:1px solid rgba(0,229,255,.35); border-radius:.4rem; color:#dce6ff; background:#111735; cursor:pointer; font:700 .72rem Inter,sans-serif; } .cit-action:hover,.cit-action:focus-visible { border-color:#00e5ff; color:#00e5ff; outline:none; } .cit-action.primary { background:#00e5ff; color:#06101b; }
    .cit-keys { display:grid; grid-template-columns:repeat(3,1fr); gap:.45rem; margin-top:.8rem; } .cit-key { padding:.5rem; border:1px solid rgba(169,176,255,.18); border-radius:.35rem; text-align:center; color:#b8bed7; font:700 .66rem Inter,sans-serif; } .cit-key b { display:block; color:#00e5ff; font:800 .9rem 'Courier New',monospace; }
    .cit-status { margin-top:.8rem; padding:.65rem; background:rgba(255,255,255,.04); color:#9da6c8; font:600 .72rem/1.4 Inter,sans-serif; } .cit-meter { height:7px; margin-top:.45rem; background:#252b4b; border-radius:99px; overflow:hidden; } .cit-meter i { display:block; height:100%; background:#00e5ff; transition:width .2s ease; }
    .cit-demo-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.7rem; } .cit-demo-card { padding:.8rem; border:1px solid rgba(169,176,255,.18); border-radius:.55rem; background:rgba(255,255,255,.035); } .cit-demo-card h4 { margin:0 0 .3rem; color:#fff; font:800 .8rem Inter,sans-serif; } .cit-demo-card p { margin:.25rem 0; color:#aeb6d2; font:400 .75rem/1.45 Inter,sans-serif; }
    .cit-class-row { display:flex; flex-wrap:wrap; gap:.45rem; margin-bottom:1rem; } .cit-class { padding:.55rem .7rem; border:1px solid rgba(169,176,255,.2); border-radius:.4rem; color:#cbd3ee; background:#111735; cursor:pointer; font:700 .72rem Inter,sans-serif; } .cit-class.selected { border-color:#00e5ff; color:#00e5ff; background:rgba(0,229,255,.1); }
    @media(max-width:700px){.cit-practice-grid,.cit-demo-grid{grid-template-columns:1fr}.cit-board-wrap{padding:.7rem}}
  `;
  document.head.appendChild(style);
}

function emptyBoard(): string[][] { return Array.from({ length: ROWS }, () => Array(COLS).fill('')); }
function cloneShape(shape: ShapeType, rotation: number): number[][] {
  const base = SHAPES[shape][rotation % SHAPES[shape].length];
  return base.map(row => [...row]);
}
function newPractice(): PracticeState {
  return { x: 3, y: 0, rotation: 0, shape: 'T', board: emptyBoard(), garbage: 0, score: 0, lines: 0, objective: 0, lastAction: 'Use the buttons or your keyboard to move the piece.' };
}

export function mountInteractiveTutorial(tutorialModal: HTMLElement) {
  ensureStyles();
  if (document.getElementById(OVERLAY_ID)) return;
  const launch = document.createElement('button');
  launch.className = 'cit-launch';
  launch.type = 'button';
  launch.textContent = '▶ OPEN INTERACTIVE PRACTICE ARENA';
  const modalBody = tutorialModal.querySelector('.overflow-y-auto');
  (modalBody ?? tutorialModal).appendChild(launch);

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'cit-overlay';
  overlay.innerHTML = `
    <div class="cit-panel" role="dialog" aria-modal="true" aria-labelledby="cit-title">
      <div class="cit-head"><div><p>GUIDED TRAINING SIMULATION</p><h2 id="cit-title">Practice before you queue</h2></div><button class="cit-close" type="button" aria-label="Close practice">×</button></div>
      <div class="cit-tabs" role="tablist">
        <button class="cit-tab active" data-cit-tab="controls" type="button">Controls</button>
        <button class="cit-tab" data-cit-tab="garbage" type="button">Garbage</button>
        <button class="cit-tab" data-cit-tab="specials" type="button">Special blocks</button>
        <button class="cit-tab" data-cit-tab="classes" type="button">Class skills</button>
      </div>
      <section class="cit-view active" data-cit-view="controls">
        <div class="cit-practice-grid"><div class="cit-board-wrap"><canvas class="cit-board" width="220" height="440"></canvas></div><div class="cit-copy"><h3>Move the falling T piece</h3><p>This is a safe miniature board. It does not touch your real match. Use your keyboard or the on-screen controls and watch the piece respond.</p><div class="cit-objective" data-cit-objective>Objective 1/4: move the piece left or right.</div><div class="cit-keys"><div class="cit-key"><b>← →</b>Move</div><div class="cit-key"><b>↑ / X</b>Rotate</div><div class="cit-key"><b>↓</b>Soft drop</div><div class="cit-key"><b>SPACE</b>Hard drop</div><div class="cit-key"><b>Z</b>Rotate back</div><div class="cit-key"><b>C</b>Hold</div></div><div class="cit-actions"><button class="cit-action" data-cit-action="left">← LEFT</button><button class="cit-action" data-cit-action="right">RIGHT →</button><button class="cit-action" data-cit-action="rotate">ROTATE ↑</button><button class="cit-action" data-cit-action="soft">SOFT DROP ↓</button><button class="cit-action" data-cit-action="hold">HOLD C</button><button class="cit-action primary" data-cit-action="hard">HARD DROP SPACE</button><button class="cit-action" data-cit-action="reset">RESET LESSON</button></div><div class="cit-status" data-cit-status>Ready. The board will show every action.</div></div></div>
      </section>
      <section class="cit-view" data-cit-view="garbage"><div class="cit-practice-grid"><div class="cit-board-wrap"><canvas class="cit-board" width="220" height="440" data-cit-garbage-board></canvas></div><div class="cit-copy"><h3>See garbage pressure and counterplay</h3><p>Incoming garbage is shown in gray at the bottom. In the current game build it is applied immediately when received, rather than sitting in a separate visible pending queue.</p><div class="cit-objective" data-cit-garbage-status>Queue preview: 0 lines · Board impact: none</div><div class="cit-meter"><i data-cit-garbage-meter style="width:0%"></i></div><div class="cit-actions"><button class="cit-action primary" data-cit-garbage="send">＋ SEND 2 GARBAGE</button><button class="cit-action" data-cit-garbage="cancel">CLEAR / CANCEL 1</button><button class="cit-action" data-cit-garbage="reset">RESET BOARD</button></div><p class="cit-status">Try sending garbage, then clear/cancel it. In a real match, clears send pressure back to opponents; Shield, Fortify, Counter Strike, Recycle, and Garbage Eater are your defensive answers.</p></div></div></section>
      <section class="cit-view" data-cit-view="specials"><h3>Click a special to see its visual effect</h3><p class="cit-status">The highlighted cell is the special block. The demo animates the result so you can see what the effect is meant to look like when its row clears.</p><div class="cit-demo-grid" data-cit-special-grid></div><div class="cit-status" data-cit-special-status>Choose a card to preview it.</div></section>
      <section class="cit-view" data-cit-view="classes"><h3>Press the skill buttons and watch the HUD change</h3><div class="cit-class-row" data-cit-class-row></div><div class="cit-demo-grid"><div class="cit-demo-card"><h4 data-cit-class-name>Tank</h4><p data-cit-class-passive></p><p data-cit-class-q></p><p data-cit-class-e></p><p data-cit-class-r></p></div><div class="cit-demo-card"><p class="cit-status" data-cit-skill-status>Choose a class, then fire Q, E, or R.</p><div class="cit-actions"><button class="cit-action" data-cit-skill="Q">Q</button><button class="cit-action" data-cit-skill="E">E</button><button class="cit-action primary" data-cit-skill="R">R ULTIMATE</button></div><div class="cit-meter"><i data-cit-skill-meter style="width:65%"></i></div><p class="cit-status">Demo meter: <span data-cit-skill-lines>26</span> / <span data-cit-skill-cost>50</span> lines</p></div></div></section>
    </div>`;
  document.body.appendChild(overlay);

  const close = overlay.querySelector<HTMLButtonElement>('.cit-close')!;
  const canvas = overlay.querySelector<HTMLCanvasElement>('.cit-board')!;
  const ctx = canvas.getContext('2d')!;
  const garbageCanvas = overlay.querySelector<HTMLCanvasElement>('[data-cit-garbage-board]')!;
  const garbageCtx = garbageCanvas.getContext('2d')!;
  let state = newPractice();
  let garbage = 0;
  let selectedClass: PlayerClass = 'TANK';
  let skillLines = 26;
  let garbageAnim = 0;

  const colorFor: Record<string, string> = { I:'#00e5ff', O:'#ffd700', T:'#b026ff', S:'#00ff88', Z:'#ff1493', J:'#4080ff', L:'#ff8c42', GARBAGE:'#656b86', BOMB:'#ff5555', HEAVY:'#ffc107', MULTIPLIER:'#b026ff', SPEED:'#00e5ff', SHIELD:'#00ff88', FREEZE:'#ff1493', GARBAGE_EATER:'#9aa0b8' };
  function drawBoard(target: CanvasRenderingContext2D, board: string[][], active?: PracticeState, garbageRows = 0) {
    target.clearRect(0, 0, COLS * CELL, ROWS * CELL);
    target.fillStyle = '#080b1d'; target.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    target.strokeStyle = 'rgba(100,120,180,.18)'; target.lineWidth = 1;
    for (let x=0;x<=COLS;x++){target.beginPath();target.moveTo(x*CELL,0);target.lineTo(x*CELL,ROWS*CELL);target.stroke();}
    for (let y=0;y<=ROWS;y++){target.beginPath();target.moveTo(0,y*CELL);target.lineTo(COLS*CELL,y*CELL);target.stroke();}
    const paint = (x:number,y:number,type:string,alpha=1) => { if(x<0||x>=COLS||y<0||y>=ROWS)return; target.globalAlpha=alpha; target.fillStyle=colorFor[type]||'#00e5ff'; target.fillRect(x*CELL+2,y*CELL+2,CELL-4,CELL-4); target.fillStyle='rgba(255,255,255,.24)'; target.fillRect(x*CELL+3,y*CELL+3,CELL-7,3); target.globalAlpha=1; };
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(board[y][x]) paint(x,y,board[y][x]);
    if(garbageRows>0) for(let y=ROWS-garbageRows;y<ROWS;y++) for(let x=0;x<COLS;x++) if(!board[y][x]) paint(x,y,'GARBAGE');
    if(active){ const matrix=cloneShape(active.shape,active.rotation); matrix.forEach((row,ry)=>row.forEach((v,rx)=>{if(v)paint(active.x+rx,active.y+ry,active.shape,.95)})); }
  }
  function updateControls() {
    drawBoard(ctx,state.board,state); const objective=overlay.querySelector<HTMLElement>('[data-cit-objective]')!; const status=overlay.querySelector<HTMLElement>('[data-cit-status]')!;
    const steps=['move the piece left or right','rotate the piece','soft drop the piece','hard drop to place it']; objective.textContent=`Objective ${Math.min(4,state.objective+1)}/4: ${steps[Math.min(3,state.objective)]}.`; status.textContent=state.lastAction;
  }
  function action(kind:string){ state.lastAction=''; if(kind==='left'){state.x=Math.max(0,state.x-1);state.objective=Math.max(state.objective,1);state.lastAction='Moved left.'} if(kind==='right'){state.x=Math.min(COLS-4,state.x+1);state.objective=Math.max(state.objective,1);state.lastAction='Moved right.'} if(kind==='rotate'){state.rotation=(state.rotation+1)%4;state.objective=Math.max(state.objective,2);state.lastAction='Rotated clockwise.'} if(kind==='soft'){state.y=Math.min(ROWS-4,state.y+1);state.objective=Math.max(state.objective,3);state.score+=1;state.lastAction='Soft drop: the piece moved down.'} if(kind==='hold'){state.lastAction='Hold: the current piece is stored so you can swap it back later. It is limited to once per lock in a real match.'} if(kind==='hard'){state.y=ROWS-3;state.board[state.y][Math.min(COLS-1,state.x+1)]=state.shape;state.lines++;state.score+=80;state.objective=4;state.lastAction='Hard drop: piece placed. Great — start another lesson with Reset.'} if(kind==='reset') state=newPractice(); updateControls(); }

  function drawGarbage(){ const board=emptyBoard(); for(let y=ROWS-garbage;y<ROWS;y++) for(let x=0;x<COLS;x++) board[y][x]='GARBAGE'; if(garbage>0){const hole=(garbage*3)%COLS; for(let y=ROWS-garbage;y<ROWS;y++) board[y][hole]='';} drawBoard(garbageCtx,board); const status=overlay.querySelector<HTMLElement>('[data-cit-garbage-status]')!; status.textContent=`Queue preview: ${garbage} lines · Board impact: ${garbage ? 'immediate in this build' : 'none'}`; const meter=overlay.querySelector<HTMLElement>('[data-cit-garbage-meter]')!; meter.style.width=`${Math.min(100,garbage*10)}%`; }
  function specialCard(type: SpecialBlockType, name:string, desc:string){ const card=document.createElement('button'); card.type='button'; card.className='cit-demo-card'; card.innerHTML=`<h4 style="color:${colorFor[type]}">${name}</h4><p>${desc}</p><span class="cit-action">PREVIEW EFFECT</span>`; card.addEventListener('click',()=>{ const s=overlay.querySelector<HTMLElement>('[data-cit-special-status]')!; s.textContent=`${name}: ${desc} Demo result shown — imagine this triggering when the marked row clears.`; card.animate([{transform:'scale(1)'},{transform:'scale(1.03)'},{transform:'scale(1)'}],{duration:260}); }); return card; }
  const specialGrid=overlay.querySelector<HTMLElement>('[data-cit-special-grid]')!;
  [[SpecialBlockType.BOMB,'Bomb','Blasts a 3×3 area.'],[SpecialBlockType.HEAVY,'Heavy','Destroys the row beneath it.'],[SpecialBlockType.MULTIPLIER,'Multiplier','Activates a score multiplier.'],[SpecialBlockType.SPEED,'Speed','Reduces your drop interval.'],[SpecialBlockType.SHIELD,'Shield','Blocks the next garbage attack.'],[SpecialBlockType.FREEZE,'Freeze','Freezes opponents’ abilities for 3 seconds.'],[SpecialBlockType.GARBAGE_EATER,'Garbage Eater','Removes one ordinary garbage line.']].forEach(([t,n,d])=>specialGrid.appendChild(specialCard(t as SpecialBlockType,n as string,d as string)));

  function updateClass(){ const info=PLAYER_CLASSES.find(x=>x.id===selectedClass)!; (overlay.querySelector('[data-cit-class-name]') as HTMLElement).textContent=info.name; (overlay.querySelector('[data-cit-class-passive]') as HTMLElement).textContent=info.passiveDescription; (overlay.querySelector('[data-cit-class-q]') as HTMLElement).textContent=`[Q] ${info.abilityQName}: ${info.abilityQDescription}`; (overlay.querySelector('[data-cit-class-e]') as HTMLElement).textContent=`[E] ${info.abilityEName}: ${info.abilityEDescription}`; (overlay.querySelector('[data-cit-class-r]') as HTMLElement).textContent=`[R] ${info.ultimateName}: ${info.ultimateDescription}`; const cost=info.ultimateCost; (overlay.querySelector('[data-cit-skill-cost]') as HTMLElement).textContent=String(cost); (overlay.querySelector('[data-cit-skill-lines]') as HTMLElement).textContent=String(skillLines); (overlay.querySelector('[data-cit-skill-meter]') as HTMLElement).style.width=`${Math.min(100,skillLines/cost*100)}%`; }
  const classRow=overlay.querySelector<HTMLElement>('[data-cit-class-row]')!; PLAYER_CLASSES.forEach(info=>{const b=document.createElement('button');b.type='button';b.className=`cit-class ${info.id===selectedClass?'selected':''}`;b.textContent=info.name;b.addEventListener('click',()=>{selectedClass=info.id;classRow.querySelectorAll('.cit-class').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');updateClass();});classRow.appendChild(b);});

  overlay.querySelectorAll<HTMLButtonElement>('[data-cit-tab]').forEach(tab=>tab.addEventListener('click',()=>{overlay.querySelectorAll('[data-cit-tab]').forEach(x=>x.classList.toggle('active',x===tab));overlay.querySelectorAll('[data-cit-view]').forEach(x=>x.classList.toggle('active',x.getAttribute('data-cit-view')===tab.dataset.citTab));}));
  overlay.querySelectorAll<HTMLButtonElement>('[data-cit-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.citAction!)));
  overlay.querySelectorAll<HTMLButtonElement>('[data-cit-garbage]').forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.citGarbage!; if(mode==='send')garbage=Math.min(15,garbage+2); if(mode==='cancel')garbage=Math.max(0,garbage-1); if(mode==='reset')garbage=0; drawGarbage();}));
  overlay.querySelectorAll<HTMLButtonElement>('[data-cit-skill]').forEach(b=>b.addEventListener('click',()=>{const slot=b.dataset.citSkill!; const info=PLAYER_CLASSES.find(x=>x.id===selectedClass)!; const status=overlay.querySelector<HTMLElement>('[data-cit-skill-status]')!; if(slot==='R' && skillLines<info.ultimateCost){status.textContent=`${info.ultimateName} needs ${info.ultimateCost-skillLines} more cleared lines in this demo.`; return;} if(slot==='R')skillLines=0; status.textContent=`${info.name} ${slot} activated — watch for this kind of HUD change in a real match.`; updateClass();}));
  function keyHandler(event:KeyboardEvent){if(!overlay.classList.contains('open'))return; const map:Record<string,string>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',x:'rotate',X:'rotate',ArrowDown:'soft',' ':'hard',c:'hold',C:'hold'}; if(map[event.key]){event.preventDefault();action(map[event.key]);}}
  document.addEventListener('keydown',keyHandler); launch.addEventListener('click',()=>{overlay.classList.add('open'); overlay.setAttribute('aria-hidden','false'); updateControls(); drawGarbage(); updateClass();}); const closeOverlay=()=>{overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');}; close.addEventListener('click',closeOverlay); overlay.addEventListener('click',e=>{if(e.target===overlay)closeOverlay();});
  updateControls(); drawGarbage(); updateClass();
}
