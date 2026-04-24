/* ================================================================
   LA CASA OLMEDO — TERROR ESCAPE ROOM v2
   Bug fix · Screamers SVG · Sonidos variados · Terror extremo
   ================================================================ */
'use strict';

const STATE = {
  phase: 0, totalPhases: 6,
  timerSeconds: 90*60, timerInterval: null,
  startTime: Date.now(),
  inventory: [], solved: {},
  advancing: false,        // ← FIX doble avance
  attempts: {}, hintsGiven: {},
  lastActivity: Date.now(),
  ambientInterval: null,
  lockDigits: [0,0,0,0],
  ritualSlots: ['','','',''],
  score: 100,
};

// ─── AUDIO ───
const AC = (window.AudioContext||window.webkitAudioContext)
           ? new (window.AudioContext||window.webkitAudioContext)() : null;
function resumeAC(){ if(AC&&AC.state==='suspended') AC.resume(); }

function playTone(freq,dur,type='sine',vol=0.05,delay=0){
  if(!AC) return; resumeAC();
  try{
    const o=AC.createOscillator(), g=AC.createGain();
    o.connect(g); g.connect(AC.destination);
    o.frequency.value=freq; o.type=type;
    const t=AC.currentTime+delay;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.start(t); o.stop(t+dur+0.05);
  }catch(e){}
}
function playNoise(dur,vol=0.04,filter=400){
  if(!AC) return; resumeAC();
  try{
    const buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const src=AC.createBufferSource(); src.buffer=buf;
    const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=filter; f.Q.value=0.8;
    const g=AC.createGain(); g.gain.value=vol;
    src.connect(f); f.connect(g); g.connect(AC.destination);
    src.start(); src.stop(AC.currentTime+dur);
  }catch(e){}
}
function playCreak(){ playNoise(0.9,0.22,180); }
function playDrip(){ playTone(160,0.4,'sine',0.07); setTimeout(()=>playTone(140,0.2,'sine',0.03),120); }
function playWrong(){ playTone(180,0.5,'sawtooth',0.07); setTimeout(()=>playTone(150,0.3,'sawtooth',0.04),150); }
function playUnlock(){ [523,659,784,1047].forEach((f,i)=>playTone(f,0.3,'triangle',0.07,i*0.12)); }
function playGlitch(){ [440,220,880,110].forEach((f,i)=>playTone(f,0.04,'square',0.04,i*0.03)); }
function playDoorSlam(){ playNoise(0.15,0.55,100); setTimeout(()=>playNoise(0.3,0.18,80),160); }
function playScream(){
  if(!AC) return; resumeAC();
  try{
    const o=AC.createOscillator(), g=AC.createGain();
    o.connect(g); g.connect(AC.destination); o.type='sawtooth';
    o.frequency.setValueAtTime(1100,AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(180,AC.currentTime+1.3);
    g.gain.setValueAtTime(0.14,AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+1.6);
    o.start(); o.stop(AC.currentTime+1.7);
  }catch(e){}
}
function playHeartbeat(fast=false){
  if(!AC) return; resumeAC();
  const gap=fast?0.18:0.28;
  [[0,0.07],[gap,0.05]].forEach(([d,v])=>{
    const o=AC.createOscillator(), g=AC.createGain();
    o.connect(g); g.connect(AC.destination); o.type='sine'; o.frequency.value=55;
    const t=AC.currentTime+d;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(v,t+0.03);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o.start(t); o.stop(t+0.2);
  });
}
function playWhisper(){
  if(!AC) return; resumeAC();
  try{
    const buf=AC.createBuffer(1,AC.sampleRate*2.5,AC.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.3;
    const src=AC.createBufferSource(); src.buffer=buf;
    const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2200; f.Q.value=2;
    const lfo=AC.createOscillator(), lg=AC.createGain();
    lfo.frequency.value=5; lg.gain.value=0.3; lfo.connect(lg);
    const mg=AC.createGain(); mg.gain.value=0.04; lg.connect(mg.gain);
    src.connect(f); f.connect(mg); mg.connect(AC.destination);
    lfo.start(); src.start(); src.stop(AC.currentTime+2.5); lfo.stop(AC.currentTime+2.5);
  }catch(e){}
}
function playChurch(){
  [220,330,440].forEach((f,i)=>{ playTone(f,3,'sine',0.025,i*0.5); playTone(f*2,2,'sine',0.012,i*0.5+0.1); });
}

function startAmbience(){
  if(!AC) return;
  let tick=0;
  STATE.ambientInterval=setInterval(()=>{
    tick++; resumeAC();
    if(tick%3===0) playTone(32+Math.random()*18,4+Math.random()*3,'sine',0.01);
    if(Math.random()<0.13) playDrip();
    if(Math.random()<0.06) playCreak();
    if(Math.random()<0.05) playWhisper();
    if(Math.random()<0.007) playChurch();
    if(STATE.timerSeconds<600) playHeartbeat(STATE.timerSeconds<180);
  },3500);
}

// ─── SCREAMERS SVG ───
const SCREAMERS=[
  // Cara gritando
  `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" style="max-height:65vh;filter:contrast(2) brightness(0.55)">
    <rect width="400" height="500" fill="#040202"/>
    <ellipse cx="200" cy="215" rx="118" ry="148" fill="#180c08"/>
    <ellipse cx="200" cy="195" rx="98" ry="128" fill="#0c0604"/>
    <ellipse cx="153" cy="165" rx="27" ry="37" fill="#000"/>
    <ellipse cx="247" cy="165" rx="27" ry="37" fill="#000"/>
    <ellipse cx="153" cy="170" rx="7" ry="11" fill="#8b0000" opacity="0.9"/>
    <ellipse cx="247" cy="170" rx="7" ry="11" fill="#8b0000" opacity="0.9"/>
    <ellipse cx="200" cy="268" rx="43" ry="54" fill="#000"/>
    <ellipse cx="200" cy="268" rx="33" ry="39" fill="#180000"/>
    ${[168,181,194,207,220].map(x=>`<rect x="${x}" y="246" width="10" height="21" rx="2" fill="#c0b090" opacity="0.7"/>`).join('')}
    ${[175,188,201,214].map(x=>`<rect x="${x}" y="277" width="10" height="19" rx="2" fill="#a09080" opacity="0.6"/>`).join('')}
    <path d="M98,95 Q128,145 118,195" stroke="#4a0000" stroke-width="2" fill="none" opacity="0.5"/>
    <path d="M302,115 Q272,155 282,205" stroke="#4a0000" stroke-width="2" fill="none" opacity="0.5"/>
    <text x="200" y="430" text-anchor="middle" fill="#6b0000" font-size="26" font-family="Georgia,serif" opacity="0.8">NO SALDRÁS</text>
  </svg>`,
  // Figura en pasillo
  `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="max-height:65vh;filter:contrast(1.9) brightness(0.45)">
    <defs><radialGradient id="hg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#180d06"/><stop offset="100%" stop-color="#010101"/></radialGradient></defs>
    <rect width="600" height="400" fill="url(#hg)"/>
    <polygon points="0,0 148,118 148,282 0,400" fill="#090603"/>
    <polygon points="600,0 452,118 452,282 600,400" fill="#090603"/>
    <polygon points="148,118 452,118 452,282 148,282" fill="#060402"/>
    <ellipse cx="300" cy="153" rx="17" ry="21" fill="#000"/>
    <rect x="283" y="173" width="34" height="68" rx="3" fill="#000"/>
    <line x1="283" y1="193" x2="253" y2="228" stroke="#000" stroke-width="7" stroke-linecap="round"/>
    <line x1="317" y1="193" x2="347" y2="228" stroke="#000" stroke-width="7" stroke-linecap="round"/>
    <line x1="291" y1="241" x2="285" y2="286" stroke="#000" stroke-width="7" stroke-linecap="round"/>
    <line x1="309" y1="241" x2="315" y2="286" stroke="#000" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="292" cy="150" rx="4" ry="5" fill="#ff0000" opacity="0.95"/>
    <ellipse cx="308" cy="150" rx="4" ry="5" fill="#ff0000" opacity="0.95"/>
    <text x="300" y="360" text-anchor="middle" fill="#3a0000" font-size="20" font-family="Georgia,serif">TE VE</text>
  </svg>`,
  // Mano saliendo
  `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" style="max-height:65vh;filter:contrast(2)">
    <rect width="400" height="500" fill="#030202"/>
    <path d="M158,500 L163,315 Q165,290 173,285 L176,175 Q177,160 186,158 Q195,156 196,170 L198,255 L200,170 Q201,156 210,158 Q219,160 220,175 L222,255 L224,195 Q225,178 236,177 Q247,176 247,194 L246,266 L250,216 Q252,196 263,196 Q274,196 273,216 L270,306 Q288,276 293,286 Q308,306 283,336 L258,376 L253,500 Z" fill="#180e08" stroke="#281408" stroke-width="1"/>
    <path d="M183,295 Q188,245 186,195" stroke="#080400" stroke-width="2" fill="none"/>
    <path d="M199,275 Q201,225 200,185" stroke="#080400" stroke-width="2" fill="none"/>
    <path d="M214,285 Q216,235 215,205" stroke="#080400" stroke-width="2" fill="none"/>
    <ellipse cx="181" cy="160" rx="7" ry="5" fill="#0d0806"/>
    <ellipse cx="199" cy="167" rx="7" ry="5" fill="#0d0806"/>
    <ellipse cx="218" cy="172" rx="7" ry="5" fill="#0d0806"/>
    <ellipse cx="235" cy="190" rx="7" ry="5" fill="#0d0806"/>
    <circle cx="189" cy="225" r="4" fill="#5a0000" opacity="0.8"/>
    <circle cx="209" cy="205" r="3" fill="#5a0000" opacity="0.7"/>
    <circle cx="227" cy="245" r="5" fill="#8b0000" opacity="0.9"/>
    <text x="200" y="80" text-anchor="middle" fill="#4a0000" font-size="22" font-family="Georgia,serif">QUÉDATE</text>
    <text x="200" y="112" text-anchor="middle" fill="#2a0000" font-size="16" font-family="Georgia,serif">con nosotros</text>
  </svg>`,
];

let screamCooldown=false;
function triggerScreamer(txt){
  if(screamCooldown) return;
  screamCooldown=true; setTimeout(()=>screamCooldown=false,14000);
  const overlay=document.getElementById('scareOverlay');
  const img=document.getElementById('scareImage');
  const el=document.getElementById('scareText');
  if(img) img.innerHTML=SCREAMERS[Math.floor(Math.random()*SCREAMERS.length)];
  if(el)  el.textContent=txt||'';
  overlay.classList.add('active');
  playScream();
  // Flash blanco
  const f=document.createElement('div');
  f.style.cssText='position:fixed;inset:0;background:white;z-index:1001;pointer-events:none;animation:wf 0.3s ease forwards;';
  document.body.appendChild(f);
  const s=document.createElement('style'); s.textContent='@keyframes wf{from{opacity:0.9}to{opacity:0}}';
  document.head.appendChild(s);
  setTimeout(()=>f.remove(),400);
  setTimeout(()=>overlay.classList.remove('active'),2300);
}

// ─── TIMER ───
function startTimer(){
  STATE.timerInterval=setInterval(()=>{
    STATE.timerSeconds--;
    const m=Math.floor(STATE.timerSeconds/60), s=STATE.timerSeconds%60;
    const el=document.getElementById('hudTimer');
    if(el){ el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; if(STATE.timerSeconds<=600) el.classList.add('urgent'); }
    checkAutoHints(); checkDynamicEvents();
    if(STATE.timerSeconds<=0){ clearInterval(STATE.timerInterval); triggerGameOver(); }
  },1000);
}

// ─── INVENTARIO ───
const ITEM_NAMES={'llave_maestra':'🗝 Llave Maestra','paginas_diario':'📜 Diario','foto_familia':'🖼 Fotografía','cirio_negro':'🕯 Cirio Negro','carta_oculta':'✉ Carta Oculta','sello_olmedo':'⚜ Sello Olmedo','llave_sotano':'🗝 Llave Sótano'};
function addItem(id){ if(STATE.inventory.includes(id)) return; STATE.inventory.push(id); renderInventory(); showMessage('OBJETO ENCONTRADO',`Recogido: ${ITEM_NAMES[id]||id}`); }
function hasItem(id){ return STATE.inventory.includes(id); }
function renderInventory(){
  const c=document.getElementById('inventoryItems'); if(!c) return;
  if(!STATE.inventory.length){ c.innerHTML='<span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);font-style:italic;">vacío</span>'; return; }
  c.innerHTML=STATE.inventory.map(id=>`<div class="inv-item" onclick="inspectItem('${id}')">${ITEM_NAMES[id]||id}</div>`).join('');
}
function inspectItem(id){
  const descs={'llave_maestra':'Hierro oxidado. Iniciales "R.O." en el mango. Huele a tierra húmeda.','paginas_diario':'Letra femenina temblorosa. Palabras rodeadas en rojo. Tinta diluida, como si llorara.','foto_familia':'Reverso: "La cuarta nunca salió en las fotos." Hay una mancha donde debería estar.','cirio_negro':'Nunca encendido. Números grabados en la cera que aparecen y desaparecen.','carta_oculta':'"Si lees esto, ya es tarde. El sótano. El número es el año en que todo terminó."','sello_olmedo':'Un cuervo sobre una torre. El metal está siempre frío.','llave_sotano':'Pequeña, negra. Marcada con "S". No se calienta aunque la sostengas horas.'};
  const ex=document.getElementById('itemInspect'); if(ex) ex.remove();
  const div=document.createElement('div'); div.id='itemInspect'; div.className='incoming-message';
  div.style.cssText='position:fixed;bottom:80px;right:0;top:auto;width:320px;';
  div.innerHTML=`<div class="msg-header"><span>INSPECCIÓN</span><button class="msg-close" onclick="document.getElementById('itemInspect').remove()">✕</button></div><div class="msg-body" style="font-style:italic;">${descs[id]||'Misterioso.'}</div>`;
  document.body.appendChild(div); setTimeout(()=>div.classList.add('show'),50);
}

// ─── MENSAJES ───
function showMessage(from,body,delay=0){ setTimeout(()=>{ document.getElementById('msgFrom').textContent=from; document.getElementById('msgBody').textContent=body; document.getElementById('incomingMsg').classList.add('show'); playGlitch(); },delay); }
function closeMessage(){ document.getElementById('incomingMsg').classList.remove('show'); }

// ─── PISTAS ───
const HINTS={
  0:['El reloj de pie lleva décadas parado. ¿En qué hora están sus agujas?','Manecilla corta (horas) → 11. Manecilla larga roja (minutos) → 47.','El código es: 1147'],
  1:['Las palabras marcadas en rojo tienen algo en común: sus iniciales.','R-O-S-A-R-I-O. Léelas en orden.','Escribe: ROSARIO'],
  2:['El cifrado César. ¿Cuántos miembros tenía la familia? Ese es el desplazamiento.','Eran 7. Cada letra se desplaza 7 posiciones hacia atrás: J→C, B→U, H→A, Y→R, A→T, H→A.','La palabra es: CUARTA'],
  3:['Las runas siguen el orden del ritual: Norte, Este, Sur, Oeste.','Fuego (N), Agua (E), Tierra (S), Viento (O).','🔥 arriba · 💧 derecha · 🌿 abajo · 💨 izquierda'],
  4:['La receta tiene 3 pasos. Cuenta los ingredientes de cada uno.','Paso 1: 3 ingredientes. Paso 2: 7. Paso 3: 4.','El código es: 374'],
  5:['La carta dice "el año en que todo terminó". Búscalo en los documentos.','El titular del periódico y el diario lo confirman.','El código es: 1947'],
};
function checkAutoHints(){
  const p=STATE.phase; if(!STATE.hintsGiven[p]) STATE.hintsGiven[p]=0;
  const mins=(Date.now()-STATE.lastActivity)/60000;
  if(mins>8 && STATE.hintsGiven[p]<(HINTS[p]?.length||0)){ giveHint(p,STATE.hintsGiven[p]++); STATE.lastActivity=Date.now(); }
}
function giveHint(p,idx){
  const h=HINTS[p]?.[idx]; if(!h) return;
  const pan=document.getElementById('hintPanel'); document.getElementById('hintText').textContent=h;
  pan.classList.add('show'); setTimeout(()=>pan.classList.remove('show'),13000);
}
function triggerHintByFailure(p){
  const idx=Math.min(STATE.hintsGiven[p]||0,(HINTS[p]?.length||1)-1);
  giveHint(p,idx); if((STATE.hintsGiven[p]||0)<((HINTS[p]?.length||1)-1)) STATE.hintsGiven[p]=(STATE.hintsGiven[p]||0)+1;
  STATE.score=Math.max(0,STATE.score-5);
}

// ─── EVENTOS DINÁMICOS ───
const EVENTS=[
  {t:82*60,fn:()=>showMessage('SISTEMA','Alguien activó la alarma de la mansión... desde dentro.',600)},
  {t:72*60,fn:()=>{ playWhisper(); showMessage('DESCONOCIDO','¿Por qué has vuelto? No debías volver.',900); }},
  {t:64*60,fn:()=>{ triggerScreenGlitch(); showMessage('R.O.','Ayúdame. Todavía estoy aquí. En el sótano.',1600); }},
  {t:54*60,fn:()=>showMessage('SISTEMA','⚠ ACTIVIDAD PARANORMAL — Sector B — Nivel crítico',300)},
  {t:46*60,fn:()=>{ playDoorSlam(); showMessage('PADRE OLMEDO','La niña nunca debió nacer. Ese fue el principio.',700); }},
  {t:38*60,fn:()=>{ if(Math.random()<0.6) triggerScreamer('TE OBSERVO'); else triggerScreenGlitch(); }},
  {t:28*60,fn:()=>{ triggerScreenGlitch(); showMessage('ALGO','YA FALTA POCO. ¿O CREÍAS QUE IBAS A SALIR?',0); }},
  {t:20*60,fn:()=>showMessage('ROSARIO OLMEDO','El código del sótano... 1947. Ese fue el año. Corre.',300)},
  {t:11*60,fn:()=>{ showMessage('SISTEMA','⚠ 11 MINUTOS. La mansión te retiene.',0); triggerHeartbeatEffect(); }},
  {t:6*60, fn:()=>triggerScreamer('¡CORRE!')},
  {t:2*60, fn:()=>{ showMessage('ALGO','QUEDATE · QUEDATE · QUEDATE',0); playScream(); }},
];
EVENTS.forEach(e=>e.sent=false);
function checkDynamicEvents(){ EVENTS.forEach(e=>{ if(!e.sent&&STATE.timerSeconds<=e.t){ e.sent=true; e.fn(); } }); }
function triggerScreenGlitch(){ document.body.classList.add('glitch-body'); playGlitch(); setTimeout(()=>document.body.classList.remove('glitch-body'),380); }
function triggerHeartbeatEffect(){ let n=0; const iv=setInterval(()=>{ playHeartbeat(true); if(++n>=10) clearInterval(iv); },650); }

// ─── FASES ───
const PHASES=[
  {id:0,label:'HALL DE ENTRADA', render:renderPhase0},
  {id:1,label:'BIBLIOTECA',       render:renderPhase1},
  {id:2,label:'DORMITORIO',       render:renderPhase2},
  {id:3,label:'CAPILLA PRIVADA',  render:renderPhase3},
  {id:4,label:'COCINA',           render:renderPhase4},
  {id:5,label:'SÓTANO SELLADO',   render:renderPhase5},
];

function advancePhase(){
  if(STATE.advancing) return;       // ← FIX
  STATE.advancing=true;
  STATE.phase++; STATE.lastActivity=Date.now(); STATE.score=Math.max(0,STATE.score-2);
  if(STATE.phase>=PHASES.length){ triggerVictory(); return; }
  document.getElementById('hudPhaseFill').style.width=((STATE.phase/PHASES.length)*100)+'%';
  document.getElementById('hudPhaseLabel').textContent=PHASES[STATE.phase].label;
  const tr=document.getElementById('sceneTransition'); tr.classList.add('active'); playDoorSlam();
  setTimeout(()=>{ PHASES[STATE.phase].render(); tr.classList.remove('active'); STATE.advancing=false; },1100);
}

// ─── VALIDACIÓN ───
function checkAnswer(inputId,feedbackId,correct,onCorrect,key){
  if(STATE.solved[key]) return;   // ← FIX
  const input=document.getElementById(inputId), fb=document.getElementById(feedbackId);
  if(!input||!fb) return;
  const val=input.value.trim().toUpperCase().replace(/\s+/g,'');
  if(!STATE.attempts[key]) STATE.attempts[key]=0; STATE.attempts[key]++;
  if(val===correct.toUpperCase().replace(/\s+/g,'')){
    STATE.solved[key]=true; input.classList.add('correct'); input.disabled=true;
    const btn=document.querySelector(`button[onclick*="${key}"]`)||input.parentElement?.querySelector('.action-btn');
    if(btn) btn.disabled=true;
    fb.className='feedback-msg success show'; fb.textContent=getSMsg(); playUnlock(); markDots(key);
    setTimeout(onCorrect,1600);
  } else {
    input.classList.add('wrong'); fb.className='feedback-msg error show'; fb.textContent=getEMsg(STATE.attempts[key]);
    playWrong(); setTimeout(()=>input.classList.remove('wrong'),500);
    if(STATE.attempts[key]>=3) triggerHintByFailure(STATE.phase);
    if(STATE.attempts[key]>=4&&Math.random()<0.38) setTimeout(()=>triggerScreamer(),900);
    markDots(key); STATE.score=Math.max(0,STATE.score-3);
  }
}
const SMSGS=['...la cerradura cede con un sonido húmedo.','...algo se mueve en las paredes.','...un crujido largo recorre el suelo.','...el frío desaparece por un instante.','...un susurro dice "sí".'];
const EMSGS=['Incorrecto.','No es eso. Algo cambia de sitio.','El ambiente se vuelve más pesado.','Escuchas una risa, casi infantil.','La vela parpadea. Tres veces.'];
function getSMsg(){ return SMSGS[Math.floor(Math.random()*SMSGS.length)]; }
function getEMsg(n){ return EMSGS[Math.min(n-1,EMSGS.length-1)]; }
function markDots(key){ document.querySelectorAll(`[data-dots="${key}"] .attempt-dot`).forEach((d,i)=>{ if(i<(STATE.attempts[key]||0)) d.classList.add('used'); }); }

// ─── HELPERS ───
function phaseDots(cur){ return `<div class="phase-indicator">${Array.from({length:6},(_,i)=>`<div class="phase-dot ${i<cur?'done':i===cur?'active':''}"></div>`).join('')}</div>`; }
function dotRow(n){ return Array.from({length:n},()=>'<div class="attempt-dot"></div>').join(''); }

// ═══════════════════════════════════════════════
// FASE 0: HALL DE ENTRADA
// ═══════════════════════════════════════════════
function renderPhase0(){
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(0)}
    <div class="narrative-panel candle-effect" data-room="HALL DE ENTRADA · MEDIANOCHE">
      <p class="narrative-text">
        La puerta se cierra detrás de ti con un golpe seco. El eco rebota en las paredes durante demasiado tiempo.<br><br>
        El olor llega primero: <em>madera podrida, cera vieja</em>, y algo más. Algo orgánico que no debería estar aquí.<br><br>
        Un <em>reloj de pie</em> domina la pared del fondo, sus agujas inmóviles. Frente a ti, una
        <span class="disturbing">puerta de hierro con cerradura de cuatro dígitos</span> bloquea el interior.<br><br>
        En el suelo hay marcas de arrastre. <span class="disturbing">Recientes.</span>
      </p>
    </div>
    <div style="position:relative;width:100%;height:5px;overflow:visible;margin-bottom:6px;">
      <div style="position:absolute;width:50px;height:90px;background:radial-gradient(ellipse,rgba(0,0,0,0.5)0%,transparent 70%);top:-45px;animation:shadow-walk 14s ease-in-out infinite;pointer-events:none;"></div>
    </div>
    <div class="puzzle-container" style="background:rgba(14,9,6,0.96);">
      <div class="puzzle-title"><span class="puzzle-icon">🕰</span>El Reloj Olmedo</div>
      <div style="display:flex;justify-content:center;margin-bottom:8px;position:relative;">
        ${generateClockSVG()}
      </div>
      <p style="font-family:var(--font-mono);font-size:0.65rem;color:var(--blood);letter-spacing:0.2em;text-align:center;margin-bottom:24px;animation:blink-text 2.5s ease infinite;">"EL TIEMPO SE DETUVO CUANDO TODO ACABÓ"</p>
      <div class="puzzle-title"><span class="puzzle-icon">🔒</span>Cerradura de la Puerta</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">Hora, luego minutos. Haz clic para girar cada dígito.</p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div style="display:flex;gap:8px;">${STATE.lockDigits.map((d,i)=>`<div class="lock-digit" id="lockD${i}" onclick="cycleDigit(${i})">${d}</div>`).join('')}</div>
        <button class="action-btn primary-btn" id="lockBtn" onclick="checkLock()">ABRIR CERRADURA</button>
        <div class="feedback-msg" id="lockFeedback"></div>
        <div class="attempt-dots" data-dots="lock0">${dotRow(5)}</div>
      </div>
    </div>
    <div class="document-card">
      <div class="document-header">NOTA · ENCONTRADA EN EL SUELO</div>
      <div class="document-body">
Ha venido otra vez. Anoche lo escuché en el pasillo.
No dormí. No puedo dormir ya.

El código de la puerta es la hora en que
<span class="redacted">████████████████</span>
Papá dice que lo <span class="key-word">recuerdo</span> todo.
Tiene razón. No puedo olvidarlo.

      — R
      </div>
      <div class="document-stain" style="width:90px;height:70px;top:15px;right:25px;"></div>
    </div>`;
}

function generateClockSVG(){
  const cx=110,cy=110,r=80;
  const hA=((11*30+47*0.5)-90)*Math.PI/180, hx=cx+44*Math.cos(hA), hy=cy+44*Math.sin(hA);
  const mA=(47*6-90)*Math.PI/180, mx=cx+68*Math.cos(mA), my=cy+68*Math.sin(mA);
  const nums=Array.from({length:12},(_,i)=>{
    const a=(i*30-90)*Math.PI/180, n=i===0?12:i, nr=r-13, nx=cx+nr*Math.cos(a), ny=cy+nr*Math.sin(a);
    const hi=[10,11,0].includes(i);
    return `<text x="${nx.toFixed(1)}" y="${ny.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="${hi?'#e8dcc8':'#5a4538'}" font-size="${hi?'12':'10'}" font-weight="${hi?'bold':'normal'}" font-family="Georgia,serif">${n}</text>`;
  }).join('');
  const ticks=Array.from({length:60},(_,i)=>{
    const a=(i*6-90)*Math.PI/180, isH=i%5===0, r1=r-2, r2=r-(isH?11:6);
    return `<line x1="${(cx+r1*Math.cos(a)).toFixed(1)}" y1="${(cy+r1*Math.sin(a)).toFixed(1)}" x2="${(cx+r2*Math.cos(a)).toFixed(1)}" y2="${(cy+r2*Math.sin(a)).toFixed(1)}" stroke="${i===47?'#c0392b':isH?'#4a3828':'#2a1e14'}" stroke-width="${i===47?3:isH?2:1}" stroke-linecap="round"/>`;
  }).join('');
  return `<svg viewBox="0 0 220 280" width="210" style="filter:drop-shadow(0 0 30px rgba(139,0,0,0.5))">
    <rect x="25" y="5" width="170" height="270" rx="8" fill="#110c07" stroke="#4a3020" stroke-width="2"/>
    <rect x="33" y="13" width="154" height="254" rx="6" fill="#0d0905" stroke="#2a1a10" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${r+9}" fill="#180e08" stroke="#5a3820" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${r+5}" fill="#100a05" stroke="#2a1810" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a1008" stroke="#3a2818" stroke-width="1.5"/>
    ${ticks}${nums}
    <line x1="${cx}" y1="${cy}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#e8dcc8" stroke-width="5" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="#c0392b" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="#8b0000" stroke="#c0392b" stroke-width="1.5"/>
    <line x1="${cx}" y1="${cy+r+9}" x2="${cx}" y2="245" stroke="#2a1808" stroke-width="2"/>
    <ellipse cx="${cx}" cy="255" rx="17" ry="12" fill="#160c06" stroke="#3a2010" stroke-width="1.5"/>
    <text x="${cx}" y="274" text-anchor="middle" fill="#2a1808" font-size="7" font-family="Georgia,serif" letter-spacing="3">OLMEDO · 1920</text>
  </svg>`;
}

function cycleDigit(i){ if(STATE.solved['lock0']) return; STATE.lockDigits[i]=(STATE.lockDigits[i]+1)%10; const el=document.getElementById(`lockD${i}`); if(el) el.textContent=STATE.lockDigits[i]; playTone(300+i*50,0.08,'triangle',0.04); }

function checkLock(){
  if(STATE.solved['lock0']) return;
  const code=STATE.lockDigits.join('');
  if(!STATE.attempts['lock0']) STATE.attempts['lock0']=0; STATE.attempts['lock0']++;
  markDots('lock0'); const fb=document.getElementById('lockFeedback');
  if(code==='1147'){
    STATE.solved['lock0']=true;
    document.getElementById('lockBtn').disabled=true;
    STATE.lockDigits.forEach((_,i)=>document.getElementById(`lockD${i}`)?.classList.add('open'));
    fb.className='feedback-msg success show'; fb.textContent='...un clic sordo. La cerradura cede. La puerta se abre.';
    playUnlock(); addItem('paginas_diario'); setTimeout(advancePhase,2500);
  } else {
    fb.className='feedback-msg error show'; fb.textContent=getEMsg(STATE.attempts['lock0']); playWrong();
    STATE.lockDigits.forEach((_,i)=>{ const el=document.getElementById(`lockD${i}`); el?.classList.add('locked'); setTimeout(()=>el?.classList.remove('locked'),500); });
    if(STATE.attempts['lock0']>=3) triggerHintByFailure(0);
    if(STATE.attempts['lock0']>=4&&Math.random()<0.4) setTimeout(()=>triggerScreamer(),700);
    STATE.score=Math.max(0,STATE.score-3);
  }
}

// ═══════════════════════════════════════════════
// FASE 1: BIBLIOTECA
// ═══════════════════════════════════════════════
function renderPhase1(){
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(1)}
    <div class="narrative-panel" data-room="BIBLIOTECA · PLANTA BAJA" style="border-left-color:#4a3020;background:rgba(16,11,5,0.75);">
      <p class="narrative-text">
        Miles de libros con los lomos quemados. El olor a humo lleva décadas impregnado en las paredes.<br><br>
        En el escritorio, <em>las páginas del diario</em>. Letra femenina y temblorosa. Algunas palabras están
        <span class="disturbing">rodeadas en tinta roja</span>, como señaladas después de ser escritas.<br><br>
        Al fondo, una <em>vitrina sellada</em>. Dentro, una llave. El candado pide una combinación de letras.
      </p>
    </div>
    <div style="position:relative;width:100%;height:60px;overflow:hidden;margin-bottom:8px;background:rgba(8,5,2,0.7);border:1px solid #1a1008;">
      <div style="position:absolute;font-size:1.1rem;top:15px;animation:fall-book 9s ease infinite;">📕</div>
      <div style="position:absolute;font-size:0.9rem;top:12px;left:65%;animation:fall-book 12s ease 3.5s infinite;">📗</div>
      <div style="position:absolute;font-size:1rem;top:18px;left:35%;animation:fall-book 7s ease 1s infinite;">📘</div>
    </div>
    <div class="diary-entry">
      <div class="diary-date">14 DE OCTUBRE, 1947 · TERCER DÍA SIN DORMIR</div>
      <div style="white-space:pre-line;font-style:italic;line-height:2.2;font-size:0.95rem;">
Hoy el padre vino otra vez.
El <mark style="background:rgba(139,0,0,0.3);color:#e74c3c;padding:0 4px;border-radius:1px;">Rojo</mark> de sus ojos cuando me mira.
Todo está <mark style="background:rgba(139,0,0,0.3);color:#e74c3c;padding:0 4px;border-radius:1px;">Oscuro</mark> en esta casa.
<mark style="background:rgba(139,0,0,0.3);color:#e74c3c;padding:0 4px;border-radius:1px;">Seis</mark> meses llevamos encerrados.
El viejo <mark style="background:rgba(139,0,0,0.3);color:#e74c3c;padding:0 4px;border-radius:1px;">Anciano</mark> del pueblo tenía razón.
El <mark style="background:rgba(139,0,0,0.3);color:#e74c3c;padding:0 4px;border-radius:1px;">Río</mark> se llevó a los que intentaron huir.
La <mark style="background:rgba(139,0,0,0.3);color:#e74c3c;padding:0 4px;border-radius:1px;">Iglesia</mark> no puede ayudarnos.
Ese <mark style="background:rgba(139,0,0,0.3);color:#e74c3c;padding:0 4px;border-radius:1px;">Otoño</mark> fue el último.

Que alguien lea esto algún día. Por favor.
      </div>
    </div>
    <div class="puzzle-container" style="border-color:#3a2010;">
      <div class="puzzle-title"><span class="puzzle-icon">🔤</span>Candado de la Vitrina</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">Las palabras en rojo ocultan un nombre. Sus iniciales, en orden.</p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <input type="text" class="game-input" id="diaryInput" placeholder="_ _ _ _ _ _ _" maxlength="10" autocomplete="off" onkeyup="if(event.key==='Enter')checkDiary()"/>
        <button class="action-btn primary-btn" onclick="checkDiary()">ABRIR VITRINA</button>
        <div class="feedback-msg" id="diaryFeedback"></div>
        <div class="attempt-dots" data-dots="diary1">${dotRow(5)}</div>
      </div>
    </div>`;
  setTimeout(()=>playWhisper(),3500);
}
function checkDiary(){ checkAnswer('diaryInput','diaryFeedback','ROSARIO',()=>{ addItem('llave_maestra'); addItem('foto_familia'); setTimeout(advancePhase,1500); },'diary1'); }

// ═══════════════════════════════════════════════
// FASE 2: DORMITORIO
// ═══════════════════════════════════════════════
function renderPhase2(){
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(2)}
    <div class="narrative-panel" data-room="DORMITORIO MAYOR · PRIMERA PLANTA" style="border-left-color:#6b0000;background:rgba(20,6,6,0.8);">
      <p class="narrative-text">
        La cama está hecha. Perfectamente hecha, como si esperaran volver.<br><br>
        En la pared, un óleo de la familia. Cuentas las figuras:
        <span class="disturbing">cinco. Pero la fotografía mostraba seis.</span> Falta alguien.<br><br>
        Bajo el colchón, un papel con caracteres extraños. El armario está bloqueado. Una nota en la puerta pide una palabra. La palabra que la familia escondía.
      </p>
    </div>
    <div style="width:100%;border:1px solid #2a1010;overflow:hidden;margin-bottom:12px;background:#0a0404;">
      <svg viewBox="0 0 600 110" width="100%" style="opacity:0.55;">
        <rect width="600" height="110" fill="#0a0404"/>
        ${[70,150,230,390,470].map((x,i)=>`<ellipse cx="${x}" cy="34" rx="${14-i*0.5}" ry="${16-i*0.5}" fill="#180a08"/><rect x="${x-10}" y="50" width="${20-i}" height="${38+i*2}" fill="#120706"/>`).join('')}
        <ellipse cx="310" cy="34" rx="14" ry="16" fill="none" stroke="#3a0808" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
        <rect x="300" y="50" width="20" height="40" fill="none" stroke="#3a0808" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
        <text x="310" y="105" text-anchor="middle" fill="#3a0808" font-size="9" font-family="serif" opacity="0.6">?</text>
        <text x="300" y="106" text-anchor="middle" fill="#1a0606" font-size="7" font-family="Georgia,serif" letter-spacing="4">FAMILIA OLMEDO · 1946</text>
      </svg>
    </div>
    <div class="puzzle-container" style="border-color:#4a1010;background:rgba(18,4,4,0.85);">
      <div class="puzzle-title"><span class="puzzle-icon">📜</span>Mensaje Cifrado</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.88rem;margin-bottom:6px;">Hallado bajo el colchón, en tinta invisible:</p>
      <div class="cipher-display" style="font-size:1.7rem;letter-spacing:0.45em;">J&nbsp;&nbsp;B&nbsp;&nbsp;H&nbsp;&nbsp;Y&nbsp;&nbsp;A&nbsp;&nbsp;H</div>
      <p class="cipher-key-hint">Cifrado romano · La familia era numerosa · Desplazamiento igual al número de miembros</p>
    </div>
    <div class="document-card" style="border-color:#3a1010;">
      <div class="document-header">FOTOGRAFÍA FAMILIAR · REVERSO · 1946</div>
      <div class="document-body" style="font-style:italic;line-height:2.1;">
"La <span class="key-word">cuarta</span> nunca salió en las fotos.
Decía que la cámara la asustaba.
Nosotros sabíamos la verdad.
<span class="redacted">████████████████████████</span>
Siete éramos. Uno no debía existir."
      </div>
      <div class="document-stain" style="width:100px;height:80px;top:10px;right:20px;"></div>
    </div>
    <div class="puzzle-container" style="border-color:#4a1010;">
      <div class="puzzle-title"><span class="puzzle-icon">🚪</span>Cerrojo del Armario</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">Descifra el mensaje. ¿Qué escondía la familia?</p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <input type="text" class="game-input" id="cipherInput" placeholder="_ _ _ _ _ _" maxlength="10" autocomplete="off" onkeyup="if(event.key==='Enter')checkCipher()"/>
        <button class="action-btn primary-btn" onclick="checkCipher()">ABRIR ARMARIO</button>
        <div class="feedback-msg" id="cipherFeedback"></div>
        <div class="attempt-dots" data-dots="cipher2">${dotRow(5)}</div>
      </div>
    </div>`;
  setTimeout(()=>{ playWhisper(); }, 2500);
  setTimeout(()=>{ showMessage('ALGO','Estamos en la habitación contigo.',0); }, 20000);
}
function checkCipher(){ checkAnswer('cipherInput','cipherFeedback','CUARTA',()=>{ addItem('cirio_negro'); addItem('carta_oculta'); setTimeout(advancePhase,1500); },'cipher2'); }

// ═══════════════════════════════════════════════
// FASE 3: CAPILLA
// ═══════════════════════════════════════════════
function renderPhase3(){
  STATE.ritualSlots=['','','',''];
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(3)}
    <div class="narrative-panel" data-room="CAPILLA PRIVADA · PLANTA BAJA" style="border-left-color:#3d1a00;background:rgba(14,7,2,0.85);">
      <p class="narrative-text">
        Los bancos están volcados. Decenas de velas apagadas cubriendo cada superficie.<br><br>
        En el altar, <em>cuatro huecos tallados</em> esperan algo. En el suelo, cuatro piedras con símbolos elementales.<br><br>
        En la pared, grabado a sangre, un texto en latín describe el orden del ritual.
        <span class="disturbing">Complétalo y la puerta sellada se abrirá.</span><br><br>
        No estás solo en esta capilla.
      </p>
    </div>
    <div style="display:flex;justify-content:center;gap:20px;padding:16px 0;background:rgba(8,4,1,0.85);border:1px solid #1a0e04;margin-bottom:12px;">
      ${[0,1.2,0.5,1.8,0.3,2.0].map((d,i)=>`
        <div style="display:flex;flex-direction:column;align-items:center;animation:candle-sway ${2.2+i*0.3}s ease-in-out infinite ${d}s;">
          <div style="width:6px;height:14px;background:radial-gradient(ellipse at 50% 0%,#fff8e0 0%,#ffaa22 50%,transparent 100%);border-radius:50% 50% 30% 30%;animation:flame-flicker ${0.4+i*0.08}s ease-in-out infinite alternate;"></div>
          <div style="width:9px;height:${25+i*6}px;background:linear-gradient(180deg,#1c1008,#0d0804);border:1px solid #2a1810;"></div>
        </div>`).join('')}
    </div>
    <div class="document-card" style="border-color:#3d1a00;">
      <div class="document-header">INSCRIPCIÓN EN LA PARED · ESCRITA CON SANGRE</div>
      <div class="document-body" style="font-style:italic;line-height:2.3;">
"<span class="key-word">Ignis</span> a septentrione incipit,
<span class="key-word">Aqua</span> in oriente sequitur,
<span class="key-word">Terra</span> in meridie ponetur,
<span class="key-word">Ventus</span> in occidente claudit."

<span style="color:var(--text-dim);font-size:0.84rem;">El fuego empieza en el Norte · el agua sigue en el Este
la tierra en el Sur · el viento cierra en el Oeste</span>
      </div>
    </div>
    <div class="puzzle-container" style="border-color:#3d1a00;background:rgba(10,5,1,0.9);">
      <div class="puzzle-title"><span class="puzzle-icon">⛧</span>Círculo Ritual</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.88rem;margin-bottom:16px;">Selecciona una runa, luego haz clic en su posición en el círculo.</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:20px;flex-wrap:wrap;">
        ${[['🔥','Fuego'],['💧','Agua'],['🌿','Tierra'],['💨','Viento']].map(([e,n])=>`
          <div onclick="selectRune('${e}','${n}')" style="padding:10px 14px;border:1px solid #3a2d20;background:#0e0804;cursor:pointer;font-size:1.3rem;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--blood)'" onmouseout="this.style.borderColor='#3a2d20'">
            ${e} <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim);vertical-align:middle;">${n}</span>
          </div>`).join('')}
      </div>
      <div style="position:relative;width:220px;height:220px;margin:0 auto 20px;">
        <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.2" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="100" fill="none" stroke="#8b0000" stroke-width="1" stroke-dasharray="6,4"/>
          <circle cx="110" cy="110" r="72" fill="none" stroke="#3a2d20" stroke-width="1"/>
          <line x1="110" y1="10" x2="110" y2="210" stroke="#1a1010" stroke-width="0.5"/>
          <line x1="10" y1="110" x2="210" y2="110" stroke="#1a1010" stroke-width="0.5"/>
        </svg>
        <div style="position:absolute;top:6px;left:50%;transform:translateX(-50%);"><div id="slot_norte" class="rune-slot" onclick="placeRune('norte')" style="font-size:1.4rem;">${STATE.ritualSlots[0]||'<span style="color:#2a1e14;font-size:0.75rem;font-family:var(--font-mono)">N</span>'}</div></div>
        <div style="position:absolute;right:6px;top:50%;transform:translateY(-50%);"><div id="slot_este" class="rune-slot" onclick="placeRune('este')" style="font-size:1.4rem;">${STATE.ritualSlots[1]||'<span style="color:#2a1e14;font-size:0.75rem;font-family:var(--font-mono)">E</span>'}</div></div>
        <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);"><div id="slot_sur" class="rune-slot" onclick="placeRune('sur')" style="font-size:1.4rem;">${STATE.ritualSlots[2]||'<span style="color:#2a1e14;font-size:0.75rem;font-family:var(--font-mono)">S</span>'}</div></div>
        <div style="position:absolute;left:6px;top:50%;transform:translateY(-50%);"><div id="slot_oeste" class="rune-slot" onclick="placeRune('oeste')" style="font-size:1.4rem;">${STATE.ritualSlots[3]||'<span style="color:#2a1e14;font-size:0.75rem;font-family:var(--font-mono)">O</span>'}</div></div>
      </div>
      <p id="selectedRuneLabel" style="font-family:var(--font-mono);font-size:0.75rem;color:var(--candle);text-align:center;min-height:20px;"></p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
        <button class="action-btn primary-btn" onclick="checkRitual()">COMPLETAR RITUAL</button>
        <button class="action-btn" onclick="resetRitual()" style="font-size:0.7rem;padding:6px 18px;">Limpiar círculo</button>
        <div class="feedback-msg" id="ritualFeedback"></div>
        <div class="attempt-dots" data-dots="ritual3">${dotRow(5)}</div>
      </div>
    </div>`;
  setTimeout(()=>playChurch(), 3500);
}
let selectedRune=null;
function selectRune(e,n){ selectedRune=e; document.getElementById('selectedRuneLabel').textContent=`Seleccionado: ${e} ${n}`; playTone(440,0.1,'triangle',0.04); }
function placeRune(pos){ if(!selectedRune){ giveHint(3,0); return; } const map={norte:0,este:1,sur:2,oeste:3}; STATE.ritualSlots[map[pos]]=selectedRune; const el=document.getElementById(`slot_${pos}`); if(el){ el.textContent=selectedRune; el.classList.add('placed'); } playTone(300+map[pos]*80,0.15,'sine',0.05); selectedRune=null; document.getElementById('selectedRuneLabel').textContent=''; }
function resetRitual(){ STATE.ritualSlots=['','','','']; renderPhase3(); }
function checkRitual(){
  if(STATE.solved['ritual3']) return;
  const correct=['🔥','💧','🌿','💨'];
  if(!STATE.attempts['ritual3']) STATE.attempts['ritual3']=0; STATE.attempts['ritual3']++;
  markDots('ritual3'); const fb=document.getElementById('ritualFeedback');
  if(STATE.ritualSlots.every((r,i)=>r===correct[i])){
    STATE.solved['ritual3']=true; fb.className='feedback-msg success show'; fb.textContent='...el sello de cera se derrite. Un olor a azufre llena la capilla.';
    playUnlock(); setTimeout(()=>{ addItem('sello_olmedo'); advancePhase(); },2000);
  } else {
    fb.className='feedback-msg error show'; fb.textContent=getEMsg(STATE.attempts['ritual3']); playWrong();
    if(STATE.attempts['ritual3']>=3) triggerHintByFailure(3);
    if(STATE.attempts['ritual3']>=3&&Math.random()<0.4) setTimeout(()=>triggerScreamer(),700);
    STATE.score=Math.max(0,STATE.score-3);
  }
}

// ═══════════════════════════════════════════════
// FASE 4: COCINA
// ═══════════════════════════════════════════════
function renderPhase4(){
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(4)}
    <div class="narrative-panel" data-room="COCINA · PLANTA BAJA" style="border-left-color:#5a2a00;background:rgba(16,8,2,0.85);">
      <p class="narrative-text">
        Décadas sin usarse, pero <em>la hornilla central está caliente.</em><br><br>
        Sobre la mesa, un libro de recetas abierto en una página manchada.
        Lo que se cocinaba aquí no era comida.<br><br>
        Una <span class="disturbing">puerta reforzada</span> conduce al sótano.
        Una rueda numerada bloquea el paso. La combinación la guarda la receta.
      </p>
    </div>
    <div style="width:100%;padding:16px;background:rgba(6,3,1,0.85);border:1px solid #1e0e04;display:flex;align-items:flex-end;justify-content:center;gap:16px;height:70px;position:relative;overflow:hidden;margin-bottom:12px;">
      ${[0,1,2,3].map(i=>`<div style="width:4px;height:55px;background:linear-gradient(0deg,transparent 0%,rgba(190,160,120,0.12) 40%,rgba(200,170,130,0.08) 70%,transparent 100%);animation:steam-rise ${1.4+i*0.35}s ease-in-out infinite ${i*0.45}s;transform-origin:bottom;"></div>`).join('')}
      <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:130px;height:10px;background:rgba(70,35,8,0.7);border-radius:2px;box-shadow:0 0 12px rgba(180,90,10,0.3);"></div>
    </div>
    <div class="document-card" style="border-color:#3a1a00;">
      <div class="document-header">LIBRO DE RECETAS DE ROSARIO OLMEDO · 1945</div>
      <div class="document-body" style="line-height:2.2;">
<span style="color:var(--bone);font-size:1rem;font-family:var(--font-title);">Estofado para los que no duermen</span>

<strong style="color:var(--candle);">Paso 1 — Preparación:</strong>
Agua de pozo (sin tocar luz solar),
huesos de animal,
sal gruesa de mar.

<strong style="color:var(--candle);">Paso 2 — El cuerpo:</strong>
Raíz de belladona fresca,
pétalos de rosa negra,
tierra del cementerio viejo,
grasa de vela negra,
hilo rojo sin tejer,
plumas de cuervo (exactamente 7),
una moneda de los muertos.

<strong style="color:var(--candle);">Paso 3 — El sellado:</strong>
Una gota de sangre del que invoca,
tres vueltas de oración en silencio,
incienso de mirra,
cenizas del nombre.

<span style="color:var(--text-dim);font-size:0.82rem;font-style:italic;">"Cocinar en orden. El número de ingredientes de cada paso, en ese orden, abre lo que no debe abrirse."</span>
      </div>
    </div>
    <div class="puzzle-container" style="border-color:#3a1a00;">
      <div class="puzzle-title"><span class="puzzle-icon">🚪</span>Rueda de Combinación — Puerta al Sótano</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">Tres dígitos: ingredientes del paso 1, paso 2, paso 3.</p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <input type="text" class="game-input" id="recipeInput" placeholder="_ _ _" maxlength="5" autocomplete="off" onkeyup="if(event.key==='Enter')checkRecipe()"/>
        <button class="action-btn primary-btn" onclick="checkRecipe()">ABRIR PUERTA</button>
        <div class="feedback-msg" id="recipeFeedback"></div>
        <div class="attempt-dots" data-dots="recipe4">${dotRow(5)}</div>
      </div>
    </div>
    ${hasItem('carta_oculta')?`<div class="document-card" style="border-color:rgba(139,0,0,0.4);background:rgba(14,3,3,0.85);"><div class="document-header">CARTA OCULTA — RELEÍDA</div><div class="document-body" style="font-style:italic;color:rgba(200,140,140,0.8);">"Si lees esto, ya es tarde para mí. El sótano. El número es el año en que todo terminó. No te quedes después de medianoche. <span class='disturbing'>Ella todavía está ahí abajo.</span>"</div></div>`:''}`;
}
function checkRecipe(){ checkAnswer('recipeInput','recipeFeedback','374',()=>{ addItem('llave_sotano'); setTimeout(advancePhase,1500); },'recipe4'); }

// ═══════════════════════════════════════════════
// FASE 5: SÓTANO — CLÍMAX
// ═══════════════════════════════════════════════
function renderPhase5(){
  STATE.lockDigits=[0,0,0,0];
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(5)}
    <div class="narrative-panel" data-room="SÓTANO SELLADO · BAJO TIERRA" style="border:1px solid rgba(139,0,0,0.4);border-left:3px solid #c0392b;background:rgba(18,2,2,0.95);">
      <p class="narrative-text" style="color:rgba(225,195,180,0.95);">
        Las escaleras descienden hacia la nada.<br><br>
        El sótano es <em>grande. Demasiado grande</em> para lo que debería ser.<br><br>
        <span class="disturbing">En las paredes: marcas de uñas.</span> Largas. Profundas. Recientes.<br><br>
        En el centro, una silla con correas de cuero. Mira hacia la pared donde alguien escribió una y otra vez:
        <span class="disturbing" style="font-size:1rem;display:block;margin-top:10px;letter-spacing:0.15em;line-height:2.2;">SACADME · SACADME · SACADME · SACADME · SACADME</span>
        <br>Al fondo: la <em>puerta de hierro</em>. La salida.<br><br>
        <span style="color:#c0392b;font-style:normal;">Hay algo detrás de ti. No te des la vuelta.</span>
      </p>
    </div>
    <div style="width:100%;padding:10px 16px;background:rgba(6,1,1,0.95);border:1px solid rgba(60,0,0,0.4);text-align:center;font-family:var(--font-mono);font-size:0.68rem;letter-spacing:0.28em;color:rgba(120,0,0,0.35);animation:wall-text-pulse 3.5s ease-in-out infinite;margin-bottom:12px;">
      SACADME&nbsp;·&nbsp;SACADME&nbsp;·&nbsp;SACADME&nbsp;·&nbsp;SACADME&nbsp;·&nbsp;SACADME
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;margin-bottom:16px;">
      <div class="document-card" style="border-color:#3a0606;">
        <div class="document-header">LA VOZ DEL PUEBLO · 12·XI·1947</div>
        <div class="document-body" style="font-size:0.84rem;line-height:1.95;">
<span class="key-word" style="font-size:0.95rem;">DESAPARECE LA FAMILIA OLMEDO</span>
Sin rastro. Sin explicación.

Autoridades cierran el caso.
La mansión, clausurada.

El año: <span class="key-word" style="font-size:1.3rem;font-weight:bold;">1947</span>
        </div>
      </div>
      <div class="diary-entry" style="font-size:0.85rem;background:rgba(14,2,2,0.95);">
        <div class="diary-date" style="color:#c0392b;">ÚLTIMA PÁGINA · SIN FECHA</div>
Esta es mi última nota.

El código de salida
es el año.
El año en que
yo terminé.

<span class='key-word' style='font-size:1.35rem;'>1947.</span>

Escápate.
Por favor.

— R.O.
      </div>
    </div>
    <div class="puzzle-container" style="border:2px solid rgba(139,0,0,0.55);background:rgba(14,2,2,0.97);">
      <div class="puzzle-title" style="color:var(--blood-light);"><span class="puzzle-icon">🚪</span>Puerta de Hierro — La Única Salida</div>
      <p style="font-family:var(--font-body);font-style:italic;color:rgba(180,110,110,0.85);font-size:0.9rem;margin-bottom:16px;">El año en que la familia Olmedo desapareció. Escuchas pasos. Date prisa.</p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div style="display:flex;gap:8px;">${STATE.lockDigits.map((d,i)=>`<div class="lock-digit" id="finalD${i}" onclick="cycleFinal(${i})" style="width:64px;height:84px;font-size:2.5rem;border-color:rgba(139,0,0,0.4);">${d}</div>`).join('')}</div>
        <p style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim);">← haz clic para girar</p>
        <button class="action-btn primary-btn" id="finalBtn" onclick="checkFinal()" style="border-color:var(--blood-light);color:var(--blood-light);font-size:1rem;padding:14px 42px;animation:final-btn-pulse 1.5s ease-in-out infinite;">ABRIR LA PUERTA</button>
        <div class="feedback-msg" id="finalFeedback"></div>
        <div class="attempt-dots" data-dots="final5">${dotRow(5)}</div>
      </div>
    </div>`;
  setTimeout(()=>triggerScreamer('ELLA TE VE'),4500);
  setTimeout(()=>{ playDoorSlam(); showMessage('ALGO','NO SALDRÁS. NADIE SALE JAMÁS.',400); },22000);
}
function cycleFinal(i){ if(STATE.solved['final5']) return; STATE.lockDigits[i]=(STATE.lockDigits[i]+1)%10; const el=document.getElementById(`finalD${i}`); if(el) el.textContent=STATE.lockDigits[i]; playTone(260+i*40,0.08,'triangle',0.04); }
function checkFinal(){
  if(STATE.solved['final5']) return;
  const code=STATE.lockDigits.join('');
  if(!STATE.attempts['final5']) STATE.attempts['final5']=0; STATE.attempts['final5']++;
  markDots('final5'); const fb=document.getElementById('finalFeedback');
  const msgs=['Incorrecto. Algo se mueve en la oscuridad.','No es eso. Los pasos se acercan.','Fallo. La vela se apaga.','Incorrecto. La respiración detrás es más cercana.','ERROR. YA NO HAY TIEMPO.'];
  if(code==='1947'){
    STATE.solved['final5']=true;
    document.getElementById('finalBtn').disabled=true;
    STATE.lockDigits.forEach((_,i)=>document.getElementById(`finalD${i}`)?.classList.add('open'));
    fb.className='feedback-msg success show'; fb.textContent='...la puerta de hierro gime. Aire frío. Luz. Libertad.';
    playUnlock(); setTimeout(triggerVictory,2800);
  } else {
    fb.className='feedback-msg error show'; fb.textContent=msgs[Math.min(STATE.attempts['final5']-1,msgs.length-1)]; playWrong();
    STATE.lockDigits.forEach((_,i)=>{ const el=document.getElementById(`finalD${i}`); el?.classList.add('locked'); setTimeout(()=>el?.classList.remove('locked'),500); });
    if(STATE.attempts['final5']>=2) triggerHintByFailure(5);
    if(STATE.attempts['final5']>=3) setTimeout(()=>triggerScreamer('¡CORRE!'),500);
    STATE.score=Math.max(0,STATE.score-5);
  }
}

// ─── FIN ───
function triggerVictory(){
  clearInterval(STATE.timerInterval); clearInterval(STATE.ambientInterval);
  const el=Math.floor((Date.now()-STATE.startTime)/1000), m=Math.floor(el/60), s=el%60;
  let score=STATE.score+(STATE.timerSeconds>60*60?30:STATE.timerSeconds>30*60?15:0);
  const sc=document.getElementById('endgameScreen'); sc.style.display='flex';
  document.getElementById('endTitle').className='endgame-title escaped';
  document.getElementById('endTitle').textContent='Escapaste.';
  document.getElementById('endText').innerHTML=`Saliste de la Mansión Olmedo.<br><br>Ahora conoces la verdad: Rosario fue encerrada por su propia familia. La llamaban "la cuarta". Decían que era diferente, que no debía existir.<br><br>Lo que su padre hizo en ese sótano nunca debería repetirse.<br><br><em style="color:var(--text-dim);">Gracias a ti, al menos alguien lo sabe.</em>`;
  document.getElementById('endScore').innerHTML=`TIEMPO: ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} &nbsp;·&nbsp; PUNTUACIÓN: ${score}/100 &nbsp;·&nbsp; PISTAS: ${Object.values(STATE.hintsGiven).reduce((a,b)=>a+b,0)} &nbsp;·&nbsp; INTENTOS: ${Object.values(STATE.attempts).reduce((a,b)=>a+b,0)}`;
  playUnlock();
}
function triggerGameOver(){
  clearInterval(STATE.timerInterval); clearInterval(STATE.ambientInterval);
  triggerScreamer('FIN');
  setTimeout(()=>{
    const sc=document.getElementById('endgameScreen'); sc.style.display='flex';
    document.getElementById('endTitle').className='endgame-title died';
    document.getElementById('endTitle').textContent='El tiempo se agotó.';
    document.getElementById('endText').innerHTML=`La oscuridad se cerró sobre ti.<br><br>No todos los que entran salen.<br><br><em style="color:var(--text-dim);">Ahora formas parte de la casa.</em>`;
    document.getElementById('endScore').innerHTML=`TIEMPO AGOTADO &nbsp;·&nbsp; FASES: ${STATE.phase}/6 &nbsp;·&nbsp; PUNTUACIÓN: ${STATE.score}/100`;
    playTone(80,5,'sawtooth',0.1);
  },2600);
}

// ─── INIT ───
window.addEventListener('load',()=>{
  const style=document.createElement('style');
  style.textContent=`
    .glitch-body{animation:body-glitch 0.38s step-end forwards;}
    @keyframes body-glitch{0%{filter:none;transform:none;}15%{filter:hue-rotate(90deg) invert(0.07);transform:translateX(-3px);}30%{filter:none;transform:translateX(2px);}55%{filter:hue-rotate(-80deg) saturate(1.9);transform:translateX(-1px);}75%{filter:brightness(1.4);transform:none;}100%{filter:none;transform:none;}}
    @keyframes shadow-walk{0%{left:-6%;opacity:0;}10%{opacity:0.55;}48%{left:50%;opacity:0.35;}56%{left:52%;opacity:0;}57%{left:105%;opacity:0;}100%{left:105%;opacity:0;}}
    @keyframes fall-book{0%,100%{transform:translateY(-45px) rotate(-6deg);opacity:0;}15%,85%{opacity:0.35;}50%{transform:translateY(25px) rotate(6deg);opacity:0.25;}}
    @keyframes steam-rise{0%,100%{transform:scaleX(1) translateY(0);opacity:0;}20%,80%{opacity:0.9;}50%{transform:scaleX(1.6) translateY(-38px);opacity:0.25;}}
    @keyframes candle-sway{0%,100%{transform:rotate(-2.5deg);}50%{transform:rotate(2.5deg);}}
    @keyframes flame-flicker{from{transform:scaleY(1) scaleX(1);opacity:0.9;}to{transform:scaleY(1.35) scaleX(0.75);opacity:0.55;}}
    @keyframes wall-text-pulse{0%,100%{opacity:0.12;letter-spacing:0.28em;}50%{opacity:0.4;letter-spacing:0.38em;}}
    @keyframes blink-text{0%,100%{opacity:0.55;}50%{opacity:0.12;}}
    @keyframes final-btn-pulse{0%,100%{box-shadow:0 0 6px rgba(139,0,0,0.25);}50%{box-shadow:0 0 28px rgba(192,57,43,0.65);}}
    @keyframes wf{from{opacity:0.9}to{opacity:0}}
  `;
  document.head.appendChild(style);

  startTimer(); startAmbience(); renderPhase0();

  setTimeout(()=>showMessage('SISTEMA','Conexión establecida. Buena suerte... la necesitarás.'),4500);
  setTimeout(()=>playWhisper(),9000);
  setTimeout(()=>showMessage('DESCONOCIDO','Ya te tenemos.',38000),38000);
});
