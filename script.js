/* ================================================================
   LA CASA OLMEDO v3 — SCRIPT PRINCIPAL
   Onboarding · Narrativa 3 actos · Puzzles visuales · Mapa mansión
   Resultados con rango · Captura leads · Terror extremo
   ================================================================ */
'use strict';

// ─── ESTADO ───
const STATE = {
  phase: 0, totalPhases: 6,
  timerSeconds: 90*60, timerInterval: null,
  startTime: Date.now(),
  inventory: [], solved: {}, advancing: false,
  attempts: {}, hintsGiven: {}, lastActivity: Date.now(),
  ambientInterval: null,
  lockDigits: [0,0,0,0],
  ritualSlots: ['','','',''],
  score: 100, totalErrors: 0,
  playerName: localStorage.getItem('olmedo_name') || '',
  playerEmail: localStorage.getItem('olmedo_email') || '',
  // Mapa mansión: salas por fase
  mapRooms: ['HALL','BIBLIO','DORMIT','CAPILLA','COCINA','SÓTANO'],
};

// ─── AUDIO ENGINE ───
const AC = (window.AudioContext||window.webkitAudioContext)
           ? new (window.AudioContext||window.webkitAudioContext)() : null;
function resumeAC(){ if(AC&&AC.state==='suspended') AC.resume(); }

function playTone(f,d,t='sine',v=0.05,delay=0){
  if(!AC) return; resumeAC();
  try{
    const o=AC.createOscillator(), g=AC.createGain();
    o.connect(g); g.connect(AC.destination);
    o.frequency.value=f; o.type=t;
    const ct=AC.currentTime+delay;
    g.gain.setValueAtTime(0,ct);
    g.gain.linearRampToValueAtTime(v,ct+0.05);
    g.gain.exponentialRampToValueAtTime(0.001,ct+d);
    o.start(ct); o.stop(ct+d+0.05);
  }catch(e){}
}
function playNoise(d,v=0.04,fq=400){
  if(!AC) return; resumeAC();
  try{
    const buf=AC.createBuffer(1,AC.sampleRate*d,AC.sampleRate);
    const data=buf.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    const src=AC.createBufferSource(); src.buffer=buf;
    const fil=AC.createBiquadFilter(); fil.type='bandpass'; fil.frequency.value=fq; fil.Q.value=0.8;
    const g=AC.createGain(); g.gain.value=v;
    src.connect(fil); fil.connect(g); g.connect(AC.destination);
    src.start(); src.stop(AC.currentTime+d);
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
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+0.03);
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
    const fil=AC.createBiquadFilter(); fil.type='bandpass'; fil.frequency.value=2200; fil.Q.value=2;
    const lfo=AC.createOscillator(), lg=AC.createGain();
    lfo.frequency.value=5; lg.gain.value=0.3; lfo.connect(lg);
    const mg=AC.createGain(); mg.gain.value=0.04; lg.connect(mg.gain);
    src.connect(fil); fil.connect(mg); mg.connect(AC.destination);
    lfo.start(); src.start(); src.stop(AC.currentTime+2.5); lfo.stop(AC.currentTime+2.5);
  }catch(e){}
}

function playChurch(){
  [110,165,220,294].forEach((f,i)=>{ playTone(f,5,'sine',0.018,i*0.6); playTone(f*2,3,'sine',0.009,i*0.6+0.2); });
}

// ═══════════════════════════════════════════
// MÚSICA GENERATIVA DE TERROR — MOTOR COMPLETO
// ═══════════════════════════════════════════

let droneNodes=[], musicPhase=0;

// Drone disonante continuo — la base de todo
function startDrone(){
  if(!AC) return; resumeAC();
  // Dos osciladores ligeramente desafinados crean batido perturbador
  const freqs=[36.7, 37.1, 55.0, 73.4]; // notas muy graves
  droneNodes=freqs.map((f,i)=>{
    try{
      const o=AC.createOscillator();
      const g=AC.createGain();
      const filt=AC.createBiquadFilter();
      filt.type='lowpass'; filt.frequency.value=200+i*30;
      o.type=i%2===0?'sawtooth':'sine';
      o.frequency.value=f;
      o.connect(filt); filt.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(0,AC.currentTime);
      g.gain.linearRampToValueAtTime(0.018+i*0.004, AC.currentTime+3);
      o.start();
      // Vibrato lento y perturbador
      const lfo=AC.createOscillator();
      const lfoG=AC.createGain();
      lfo.frequency.value=0.08+i*0.03; // muy lento
      lfoG.gain.value=1.5;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      lfo.start();
      return {o,g,lfo};
    }catch(e){ return null; }
  }).filter(Boolean);
}

function stopDrone(){
  droneNodes.forEach(n=>{
    try{
      n.g.gain.linearRampToValueAtTime(0,AC.currentTime+2);
      setTimeout(()=>{ try{n.o.stop();n.lfo.stop();}catch(e){} },2200);
    }catch(e){}
  });
  droneNodes=[];
}

// Cuerda de violín disonante — un arco que chirría
function playStringDissonance(){
  if(!AC) return; resumeAC();
  try{
    const dur=3+Math.random()*4;
    // Ruido filtrado como arco de violín
    const buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++){
      // Ruido + componente sinusoidal = sonido de arco
      d[i]=(Math.random()*2-1)*0.4 + Math.sin(i*0.08)*0.3 + Math.sin(i*0.113)*0.2;
    }
    const src=AC.createBufferSource(); src.buffer=buf;
    const fil1=AC.createBiquadFilter(); fil1.type='bandpass'; fil1.frequency.value=180+Math.random()*120; fil1.Q.value=4;
    const fil2=AC.createBiquadFilter(); fil2.type='bandpass'; fil2.frequency.value=320+Math.random()*80; fil2.Q.value=3;
    const g=AC.createGain(); g.gain.setValueAtTime(0,AC.currentTime);
    g.gain.linearRampToValueAtTime(0.06,AC.currentTime+0.4);
    g.gain.linearRampToValueAtTime(0.04,AC.currentTime+dur-0.5);
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+dur);
    src.connect(fil1); fil1.connect(fil2); fil2.connect(g); g.connect(AC.destination);
    src.start(); src.stop(AC.currentTime+dur);
  }catch(e){}
}

// Respiración perturbadora — inhalación y exhalación
function playBreathing(){
  if(!AC) return; resumeAC();
  try{
    // Inhalar
    const buf1=AC.createBuffer(1,AC.sampleRate*1.2,AC.sampleRate);
    const d1=buf1.getChannelData(0);
    for(let i=0;i<d1.length;i++) d1[i]=(Math.random()*2-1)*0.5*Math.sin(Math.PI*i/d1.length);
    const src1=AC.createBufferSource(); src1.buffer=buf1;
    const fil1=AC.createBiquadFilter(); fil1.type='bandpass'; fil1.frequency.value=800; fil1.Q.value=1.5;
    const g1=AC.createGain(); g1.gain.value=0.05;
    src1.connect(fil1); fil1.connect(g1); g1.connect(AC.destination);
    src1.start();

    // Exhalar (más lento, más grave)
    setTimeout(()=>{
      try{
        const buf2=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);
        const d2=buf2.getChannelData(0);
        for(let i=0;i<d2.length;i++) d2[i]=(Math.random()*2-1)*0.4*(1-i/d2.length);
        const src2=AC.createBufferSource(); src2.buffer=buf2;
        const fil2=AC.createBiquadFilter(); fil2.type='bandpass'; fil2.frequency.value=400; fil2.Q.value=1.2;
        const g2=AC.createGain(); g2.gain.value=0.04;
        src2.connect(fil2); fil2.connect(g2); g2.connect(AC.destination);
        src2.start();
      }catch(e){}
    },1300);
  }catch(e){}
}

// Pasos lentos y pesados — alguien camina en el piso de arriba
function playFootsteps(){
  if(!AC) return; resumeAC();
  const steps=2+Math.floor(Math.random()*4);
  for(let i=0;i<steps;i++){
    setTimeout(()=>{
      try{
        // Impacto bajo
        const o=AC.createOscillator(), g=AC.createGain();
        o.connect(g); g.connect(AC.destination);
        o.type='sine'; o.frequency.setValueAtTime(80,AC.currentTime); o.frequency.exponentialRampToValueAtTime(30,AC.currentTime+0.3);
        g.gain.setValueAtTime(0.12,AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.4);
        o.start(); o.stop(AC.currentTime+0.5);
        // Crujido de madera
        playNoise(0.2,0.08,200);
      }catch(e){}
    },i*(600+Math.random()*400));
  }
}

// Llanto lejano de niño — el más perturbador
function playDistantCrying(){
  if(!AC) return; resumeAC();
  try{
    const dur=4;
    const buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate);
    const d=buf.getChannelData(0);
    // Onda compleja que simula llanto
    for(let i=0;i<d.length;i++){
      const t=i/AC.sampleRate;
      const vibrato=Math.sin(t*6)*0.015;
      const cry=Math.sin(2*Math.PI*(300+vibrato*100)*t)*0.3
               +Math.sin(2*Math.PI*(600+vibrato*200)*t)*0.15
               +Math.sin(2*Math.PI*(900+vibrato*50)*t)*0.08
               +(Math.random()*2-1)*0.05; // ligero ruido
      const env=Math.sin(Math.PI*i/d.length)*Math.sin(Math.PI*4*i/d.length+0.5)*0.5+0.5;
      d[i]=cry*env*0.6;
    }
    const src=AC.createBufferSource(); src.buffer=buf;
    const rev=AC.createConvolver();
    // Reverb simple con impulso de ruido
    const revBuf=AC.createBuffer(2,AC.sampleRate*2,AC.sampleRate);
    for(let ch=0;ch<2;ch++){
      const rd=revBuf.getChannelData(ch);
      for(let i=0;i<rd.length;i++) rd[i]=(Math.random()*2-1)*Math.pow(1-i/rd.length,2);
    }
    rev.buffer=revBuf;
    const g=AC.createGain(); g.gain.value=0.035;
    const dg=AC.createGain(); dg.gain.value=0.02;
    src.connect(rev); rev.connect(g); g.connect(AC.destination);
    src.connect(dg); dg.connect(AC.destination);
    src.start(); src.stop(AC.currentTime+dur);
  }catch(e){}
}

// Acorde de piano muerto — tecla vieja que cae sola
function playDeadPiano(){
  if(!AC) return; resumeAC();
  // Notas del acorde de Re menor disminuido (muy ominoso)
  const notes=[293.7, 349.2, 415.3, 466.2];
  const chosen=notes.filter(()=>Math.random()<0.6);
  chosen.forEach((f,i)=>{
    try{
      const o=AC.createOscillator(), g=AC.createGain();
      // Piano sintético: suma de armónicos con decaimiento
      const g2=AC.createGain();
      o.connect(g); g.connect(AC.destination);
      // Segunda armónica (suena más a piano viejo)
      const o2=AC.createOscillator(), g3=AC.createGain();
      o2.frequency.value=f*2; o2.type='sine';
      o2.connect(g3); g3.connect(AC.destination);
      g3.gain.setValueAtTime(0,AC.currentTime+i*0.08);
      g3.gain.linearRampToValueAtTime(0.018,AC.currentTime+i*0.08+0.01);
      g3.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+i*0.08+3);
      o2.start(AC.currentTime+i*0.08); o2.stop(AC.currentTime+i*0.08+3.5);

      o.type='triangle'; o.frequency.value=f;
      g.gain.setValueAtTime(0,AC.currentTime+i*0.08);
      g.gain.linearRampToValueAtTime(0.04,AC.currentTime+i*0.08+0.01);
      g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+i*0.08+4);
      o.start(AC.currentTime+i*0.08); o.stop(AC.currentTime+i*0.08+4.5);
    }catch(e){}
  });
}

// Caja de música rota — fragmento de melodía perturbadora
function playMusicBox(){
  if(!AC) return; resumeAC();
  // Melodía pentatónica menor en modo frigio (muy oscura)
  const melody=[329,311,277,261,220,233,261,246];
  const chosen=melody.slice(0,3+Math.floor(Math.random()*5));
  chosen.forEach((f,i)=>{
    try{
      const o=AC.createOscillator(), g=AC.createGain();
      o.connect(g); g.connect(AC.destination);
      o.type='sine'; o.frequency.value=f*2; // 2 octavas arriba = caja de música
      const t=AC.currentTime+i*0.22+(Math.random()*0.05);
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.05,t+0.01);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.8);
      o.start(t); o.stop(t+0.9);
    }catch(e){}
  });
}

// Scratch de violín — chirrido breve y penetrante
function playViolinScratch(){
  if(!AC) return; resumeAC();
  try{
    const o=AC.createOscillator(), g=AC.createGain();
    o.connect(g); g.connect(AC.destination);
    o.type='sawtooth';
    const f=200+Math.random()*300;
    o.frequency.setValueAtTime(f,AC.currentTime);
    o.frequency.linearRampToValueAtTime(f*(0.7+Math.random()*0.6),AC.currentTime+0.15);
    g.gain.setValueAtTime(0,AC.currentTime);
    g.gain.linearRampToValueAtTime(0.06,AC.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.3);
    o.start(); o.stop(AC.currentTime+0.35);
    // Segundo chirrido
    if(Math.random()<0.5){
      setTimeout(()=>playViolinScratch(),200+Math.random()*300);
    }
  }catch(e){}
}

// Golpe en la pared — algo desde dentro
function playWallKnock(){
  if(!AC) return; resumeAC();
  const times=Math.random()<0.4?3:1;
  for(let i=0;i<times;i++){
    setTimeout(()=>{
      try{
        const o=AC.createOscillator(), g=AC.createGain();
        o.connect(g); g.connect(AC.destination);
        o.type='sine'; o.frequency.setValueAtTime(120,AC.currentTime); o.frequency.exponentialRampToValueAtTime(50,AC.currentTime+0.1);
        g.gain.setValueAtTime(0.15,AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.2);
        o.start(); o.stop(AC.currentTime+0.25);
        playNoise(0.1,0.12,150);
      }catch(e){}
    },i*500);
  }
}

// Viento entre grietas — variación más compleja
function playWind(){
  if(!AC) return; resumeAC();
  try{
    const dur=5+Math.random()*5;
    const buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++){
      d[i]=(Math.random()*2-1)*0.6*(0.5+0.5*Math.sin(Math.PI*4*i/d.length));
    }
    const src=AC.createBufferSource(); src.buffer=buf;
    const fil=AC.createBiquadFilter(); fil.type='bandpass';
    fil.frequency.value=200+Math.random()*400; fil.Q.value=0.5;
    const fil2=AC.createBiquadFilter(); fil2.type='highshelf'; fil2.frequency.value=2000; fil2.gain.value=-10;
    const g=AC.createGain(); g.gain.setValueAtTime(0,AC.currentTime);
    g.gain.linearRampToValueAtTime(0.03+Math.random()*0.02,AC.currentTime+1.5);
    g.gain.linearRampToValueAtTime(0.01,AC.currentTime+dur-1);
    g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+dur);
    src.connect(fil); fil.connect(fil2); fil2.connect(g); g.connect(AC.destination);
    src.start(); src.stop(AC.currentTime+dur);
  }catch(e){}
}

// ESCALADA DE INTENSIDAD según fase y tiempo
function getIntensityLevel(){
  const timeRatio=1-(STATE.timerSeconds/(90*60));
  const phaseRatio=STATE.phase/6;
  return Math.min(1,(timeRatio+phaseRatio)/2);
}

function startAmbience(){
  if(!AC) return;
  startDrone(); // Drone siempre activo
  let tick=0;

  STATE.ambientInterval=setInterval(()=>{
    tick++; resumeAC();
    const intensity=getIntensityLevel();

    // ── SONIDOS BASE (siempre) ──
    if(tick%5===0) playWind();
    if(Math.random()<0.10) playDrip();

    // ── CAPA MUSICAL (cada 8-12 segs) ──
    if(tick%3===0){
      const r=Math.random();
      if(r<0.25) playDeadPiano();
      else if(r<0.45) playMusicBox();
      else if(r<0.60) playStringDissonance();
      else if(r<0.70) playChurch();
    }

    // ── SONIDOS ORGÁNICOS (aleatorios) ──
    if(Math.random()<0.08) playCreak();
    if(Math.random()<0.06+intensity*0.08) playBreathing();
    if(Math.random()<0.04+intensity*0.06) playFootsteps();
    if(Math.random()<0.03+intensity*0.05) playViolinScratch();

    // ── SONIDOS DE TERROR ESCALANTE ──
    if(Math.random()<0.015+intensity*0.04) playWallKnock();
    if(Math.random()<0.012+intensity*0.035) playWhisper();
    if(Math.random()<0.005+intensity*0.02) playDistantCrying();

    // ── EVENTOS RAROS MUY PERTURBADORES ──
    if(Math.random()<0.003+intensity*0.008) playChurch();

    // ── ÚLTIMOS MINUTOS: latidos ──
    if(STATE.timerSeconds<600) playHeartbeat(STATE.timerSeconds<180);

    // ── ESCALADA EXTREMA: últimos 5 minutos ──
    if(STATE.timerSeconds<300){
      if(Math.random()<0.15) playViolinScratch();
      if(Math.random()<0.10) playBreathing();
      if(Math.random()<0.08) playWallKnock();
    }
  },3000); // Cada 3 segundos (más frecuente que antes)

  // Eventos de música especiales en momentos clave
  setTimeout(()=>{ playDeadPiano(); playDistantCrying(); },8000);
  setTimeout(()=>{ playMusicBox(); },25000);
  setTimeout(()=>{ playStringDissonance(); playViolinScratch(); },55000);
}

// ─── SCREAMERS SVG ───
const SCREAMERS=[
  `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" style="max-height:60vh;filter:contrast(2) brightness(0.55)"><rect width="400" height="500" fill="#040202"/><ellipse cx="200" cy="215" rx="118" ry="148" fill="#180c08"/><ellipse cx="200" cy="195" rx="98" ry="128" fill="#0c0604"/><ellipse cx="153" cy="165" rx="27" ry="37" fill="#000"/><ellipse cx="247" cy="165" rx="27" ry="37" fill="#000"/><ellipse cx="153" cy="170" rx="7" ry="11" fill="#8b0000" opacity="0.9"/><ellipse cx="247" cy="170" rx="7" ry="11" fill="#8b0000" opacity="0.9"/><ellipse cx="200" cy="268" rx="43" ry="54" fill="#000"/><ellipse cx="200" cy="268" rx="33" ry="39" fill="#180000"/>${[168,181,194,207,220].map(x=>`<rect x="${x}" y="246" width="10" height="21" rx="2" fill="#c0b090" opacity="0.7"/>`).join('')}${[175,188,201,214].map(x=>`<rect x="${x}" y="277" width="10" height="19" rx="2" fill="#a09080" opacity="0.6"/>`).join('')}<path d="M98,95 Q128,145 118,195" stroke="#4a0000" stroke-width="2" fill="none" opacity="0.5"/><path d="M302,115 Q272,155 282,205" stroke="#4a0000" stroke-width="2" fill="none" opacity="0.5"/><text x="200" y="430" text-anchor="middle" fill="#6b0000" font-size="26" font-family="Georgia,serif" opacity="0.8">NO SALDRÁS</text></svg>`,
  `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" style="max-height:60vh;filter:contrast(1.9) brightness(0.45)"><defs><radialGradient id="hg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#180d06"/><stop offset="100%" stop-color="#010101"/></radialGradient></defs><rect width="600" height="400" fill="url(#hg)"/><polygon points="0,0 148,118 148,282 0,400" fill="#090603"/><polygon points="600,0 452,118 452,282 600,400" fill="#090603"/><polygon points="148,118 452,118 452,282 148,282" fill="#060402"/><ellipse cx="300" cy="153" rx="17" ry="21" fill="#000"/><rect x="283" y="173" width="34" height="68" rx="3" fill="#000"/><line x1="283" y1="193" x2="253" y2="228" stroke="#000" stroke-width="7" stroke-linecap="round"/><line x1="317" y1="193" x2="347" y2="228" stroke="#000" stroke-width="7" stroke-linecap="round"/><ellipse cx="292" cy="150" rx="4" ry="5" fill="#ff0000" opacity="0.95"/><ellipse cx="308" cy="150" rx="4" ry="5" fill="#ff0000" opacity="0.95"/><text x="300" y="360" text-anchor="middle" fill="#3a0000" font-size="20" font-family="Georgia,serif">TE VE</text></svg>`,
  `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" style="max-height:60vh;filter:contrast(2)"><rect width="400" height="500" fill="#030202"/><path d="M158,500 L163,315 Q165,290 173,285 L176,175 Q177,160 186,158 Q195,156 196,170 L198,255 L200,170 Q201,156 210,158 Q219,160 220,175 L222,255 L224,195 Q225,178 236,177 Q247,176 247,194 L246,266 L250,216 Q252,196 263,196 Q274,196 273,216 L270,306 Q288,276 293,286 Q308,306 283,336 L258,376 L253,500 Z" fill="#180e08" stroke="#281408" stroke-width="1"/><ellipse cx="181" cy="160" rx="7" ry="5" fill="#0d0806"/><ellipse cx="199" cy="167" rx="7" ry="5" fill="#0d0806"/><ellipse cx="218" cy="172" rx="7" ry="5" fill="#0d0806"/><ellipse cx="235" cy="190" rx="7" ry="5" fill="#0d0806"/><circle cx="189" cy="225" r="4" fill="#5a0000" opacity="0.8"/><circle cx="209" cy="205" r="3" fill="#5a0000" opacity="0.7"/><circle cx="227" cy="245" r="5" fill="#8b0000" opacity="0.9"/><text x="200" y="80" text-anchor="middle" fill="#4a0000" font-size="22" font-family="Georgia,serif">QUÉDATE</text><text x="200" y="112" text-anchor="middle" fill="#2a0000" font-size="16" font-family="Georgia,serif">con nosotros</text></svg>`,
];
let screamCooldown=false;
function triggerScreamer(txt=''){
  if(screamCooldown) return; screamCooldown=true; setTimeout(()=>screamCooldown=false,14000);
  const overlay=document.getElementById('scareOverlay');
  document.getElementById('scareImage').innerHTML=SCREAMERS[Math.floor(Math.random()*SCREAMERS.length)];
  document.getElementById('scareText').textContent=txt;
  overlay.classList.add('active'); playScream();
  const f=document.createElement('div');
  f.style.cssText='position:fixed;inset:0;background:white;z-index:1001;pointer-events:none;animation:wf 0.3s ease forwards;';
  document.body.appendChild(f); setTimeout(()=>f.remove(),400);
  setTimeout(()=>overlay.classList.remove('active'),2300);
}

// ─── TIMER CON GOTAS ───
function startTimer(){
  STATE.timerInterval=setInterval(()=>{
    STATE.timerSeconds--;
    const m=Math.floor(STATE.timerSeconds/60), s=STATE.timerSeconds%60;
    const el=document.getElementById('hudTimer');
    if(el){ el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; if(STATE.timerSeconds<=600) el.classList.add('urgent'); }
    // Gotas progresivas
    if(STATE.timerSeconds===70*60||STATE.timerSeconds===50*60||STATE.timerSeconds===30*60||STATE.timerSeconds===15*60||STATE.timerSeconds===5*60) addTimerDrip();
    checkAutoHints(); checkDynamicEvents();
    if(STATE.timerSeconds<=0){ clearInterval(STATE.timerInterval); triggerGameOver(); }
  },1000);
}

function addTimerDrip(){
  const container=document.getElementById('timerDrips'); if(!container) return;
  const d=document.createElement('div'); d.className='timer-drip-drop';
  d.style.setProperty('--h',(15+Math.random()*20)+'px');
  container.appendChild(d);
  setTimeout(()=>d.remove(),2000);
}

// ─── MAPA DE MANSIÓN ───
function renderMansionMap(){
  const phase=STATE.phase;
  // SVG planta de mansión simplificada — 6 habitaciones
  const rooms=[
    {x:5,y:30,w:28,h:22,label:'HALL',i:0},
    {x:38,y:5,w:28,h:22,label:'LIB',i:1},
    {x:71,y:5,w:28,h:22,label:'DOR',i:2},
    {x:38,y:32,w:28,h:22,label:'CAP',i:3},
    {x:71,y:32,w:28,h:22,label:'COC',i:4},
    {x:38,y:58,w:58,h:20,label:'SÓTANO',i:5},
  ];
  const svg=rooms.map(r=>{
    const done=r.i<phase, active=r.i===phase, locked=r.i>phase;
    const fill=done?'rgba(139,0,0,0.4)':active?'rgba(212,130,26,0.25)':'rgba(10,8,5,0.8)';
    const stroke=done?'#6b0000':active?'#d4821a':'#2a1e14';
    const textColor=done?'#c0392b':active?'#d4821a':'#3a2d20';
    const candle=done||active?`<circle cx="${r.x+r.w-5}" cy="${r.y+5}" r="2" fill="${done?'#8b0000':'#d4821a'}" opacity="0.8"/>`:''
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="${stroke}" stroke-width="1" rx="1"/>
      <text x="${r.x+r.w/2}" y="${r.y+r.h/2+1}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-size="5" font-family="'Special Elite',monospace" letter-spacing="0.5">${r.label}</text>
      ${candle}`;
  }).join('');
  return `<svg viewBox="0 0 104 82" width="104" height="82" style="display:block;">${svg}</svg>`;
}

function updateMap(){
  const el=document.getElementById('hudMap'); if(el) el.innerHTML=renderMansionMap();
  const loc=document.getElementById('hudLocation');
  const labels=['HALL DE ENTRADA','BIBLIOTECA','DORMITORIO','CAPILLA PRIVADA','COCINA','SÓTANO SELLADO'];
  if(loc) loc.textContent=labels[STATE.phase]||'';
}

// ─── SISTEMA DE ERRORES Y OSCURECIMIENTO ───
function registerError(){
  STATE.totalErrors++;
  STATE.score=Math.max(0,STATE.score-3);
  updateScoreHUD();
  // Oscurecer pantalla progresivamente
  const overlay=document.getElementById('brightnessOverlay');
  if(overlay){
    const darkness=Math.min(STATE.totalErrors*0.04,0.35);
    overlay.style.background=`rgba(0,0,0,${darkness})`;
  }
  // Marcar dot de error
  const dots=document.querySelectorAll('.err-dot');
  const idx=Math.min(STATE.totalErrors-1,dots.length-1);
  if(dots[idx]) dots[idx].classList.add('used');
  // Screamer en muchos errores
  if(STATE.totalErrors===6&&Math.random()<0.5) setTimeout(()=>triggerScreamer('¿CUÁNTOS FALLOS MÁS?'),800);
}

function registerSuccess(){
  // Al acertar, recuperar un poco de brillo
  const overlay=document.getElementById('brightnessOverlay');
  if(overlay){
    const darkness=Math.max(0,parseFloat(overlay.style.background.match(/[\d.]+/g)?.[3]||0)-0.02);
    overlay.style.background=`rgba(0,0,0,${darkness})`;
  }
}

function updateScoreHUD(){
  const el=document.getElementById('hudScore'); if(el) el.textContent=STATE.score+' pts';
}

// ─── INVENTARIO ───
const ITEM_NAMES={'llave_maestra':'🗝 Llave Maestra','paginas_diario':'📜 Diario','foto_familia':'🖼 Fotografía','cirio_negro':'🕯 Cirio Negro','carta_oculta':'✉ Carta Oculta','sello_olmedo':'⚜ Sello Olmedo','llave_sotano':'🗝 Llave Sótano'};
function addItem(id){ if(STATE.inventory.includes(id)) return; STATE.inventory.push(id); renderInventory(); showMessage('OBJETO ENCONTRADO',`Recogido: ${ITEM_NAMES[id]||id}`); }
function hasItem(id){ return STATE.inventory.includes(id); }
function renderInventory(){
  const c=document.getElementById('inventoryItems'); if(!c) return;
  if(!STATE.inventory.length){ c.innerHTML='<span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim);font-style:italic;">vacío</span>'; return; }
  c.innerHTML=STATE.inventory.map(id=>`<div class="inv-item" onclick="inspectItem('${id}')">${ITEM_NAMES[id]||id}</div>`).join('');
}
function inspectItem(id){
  const descs={'llave_maestra':'Hierro oxidado. "R.O." grabado en el mango. Huele a tierra húmeda.','paginas_diario':'Letra femenina temblorosa. Palabras rodeadas en rojo. Tinta diluida como lágrimas.','foto_familia':'Reverso: "La cuarta nunca salió en las fotos." Una mancha donde debería estar ella.','cirio_negro':'Nunca encendido. Números grabados en la cera que aparecen y desaparecen con el calor.','carta_oculta':'"Si lees esto, ya es tarde. El sótano. El número es el año en que todo terminó."','sello_olmedo':'Un cuervo sobre una torre. El metal está siempre frío, sin importar cuánto tiempo lo sostengas.','llave_sotano':'Pequeña, negra, marcada con "S". No se calienta aunque la sostengas durante horas.'};
  const ex=document.getElementById('itemInspect'); if(ex) ex.remove();
  const div=document.createElement('div'); div.id='itemInspect'; div.className='incoming-message';
  div.style.cssText='position:fixed;bottom:80px;right:0;top:auto;width:300px;';
  div.innerHTML=`<div class="msg-header"><span>INSPECCIÓN</span><button class="msg-close" onclick="document.getElementById('itemInspect').remove()">✕</button></div><div class="msg-body" style="font-style:italic;">${descs[id]||'Misterioso.'}</div>`;
  document.body.appendChild(div); setTimeout(()=>div.classList.add('show'),50);
}

// ─── MENSAJES ───
function showMessage(from,body,delay=0){
  setTimeout(()=>{
    document.getElementById('msgFrom').textContent=from;
    document.getElementById('msgBody').textContent=body;
    document.getElementById('incomingMsg').classList.add('show');
    playGlitch();
  },delay);
}
function closeMessage(){ document.getElementById('incomingMsg').classList.remove('show'); }

// ─── PISTAS ───
const HINTS={
  0:['El reloj lleva décadas parado. Fíjate en qué hora marcan las agujas.','Manecilla corta (gruesa/blanca) → 11. Manecilla larga (roja) → 47.','Código: 1147'],
  1:['Las manchas en el mapa ocultan letras. Haz clic en cada mancha para revelarlas.','Hay 7 manchas. Las letras forman un nombre femenino.','Las letras revelan: ROSARIO'],
  2:['El espejo está roto en 9 fragmentos. Ordénalos para revelar el mensaje.','La imagen correcta muestra un número escrito en el espejo empañado.','El número en el espejo es: 7. La palabra cifrada con César+7 = CUARTA'],
  3:['Las runas siguen el orden del ritual: Norte, Este, Sur, Oeste.','Fuego al Norte, Agua al Este, Tierra al Sur, Viento al Oeste.','🔥 arriba · 💧 derecha · 🌿 abajo · 💨 izquierda'],
  4:['Arrastra los ingredientes correctos al caldero en el orden de la receta.','Paso 1: los 3 primeros ingredientes. El caldero burbujea si es correcto.','Los ingredientes correctos están marcados con asterisco en la receta.'],
  5:['El puzzle final tiene 3 pasos. Lee los documentos con atención.','El año que aparece en el titular del periódico y en la última página del diario.','El código final es: 1947'],
};
function checkAutoHints(){
  const p=STATE.phase; if(!STATE.hintsGiven[p]) STATE.hintsGiven[p]=0;
  const mins=(Date.now()-STATE.lastActivity)/60000;
  if(mins>8&&STATE.hintsGiven[p]<(HINTS[p]?.length||0)){ giveHint(p,STATE.hintsGiven[p]++); STATE.lastActivity=Date.now(); }
}
function giveHint(p,idx){
  const h=HINTS[p]?.[idx]; if(!h) return;
  const pan=document.getElementById('hintPanel');
  document.getElementById('hintText').textContent=h;
  pan.classList.add('show'); setTimeout(()=>pan.classList.remove('show'),13000);
}
function triggerHintByFailure(p){
  const idx=Math.min(STATE.hintsGiven[p]||0,(HINTS[p]?.length||1)-1);
  giveHint(p,idx);
  if((STATE.hintsGiven[p]||0)<((HINTS[p]?.length||1)-1)) STATE.hintsGiven[p]=(STATE.hintsGiven[p]||0)+1;
}

// ─── EVENTOS DINÁMICOS ───
const EVENTS=[
  {t:85*60,fn:()=>{ playWind(); showMessage('SISTEMA','La temperatura de la mansión bajó 8 grados de golpe.',800); }},
  {t:82*60,fn:()=>{ playFootsteps(); showMessage('SISTEMA','Alguien activó la alarma desde dentro.',600); }},
  {t:78*60,fn:()=>{ showHorrorText('algo te observa desde el pasillo','#8b0000',2500); playBreathing(); }},
  {t:72*60,fn:()=>{ playWhisper(); showMessage('DESCONOCIDO','¿Por qué has vuelto? No debías.',900); }},
  {t:68*60,fn:()=>{ playMusicBox(); showHorrorText('una caja de música suena sola en algún lugar','#6b5a48',3000); }},
  {t:64*60,fn:()=>{ triggerScreenGlitch(); playViolinScratch(); showMessage('R.O.','Ayúdame. Sigo aquí. En el sótano.',1600); }},
  {t:60*60,fn:()=>{ playWallKnock(); showHorrorText('tres golpes desde dentro de la pared','#8b0000',2500); }},
  {t:54*60,fn:()=>{ playFootsteps(); showMessage('SISTEMA','⚠ ACTIVIDAD PARANORMAL — Nivel crítico',300); }},
  {t:50*60,fn:()=>{ playDistantCrying(); showHorrorText('llanto de niño en el piso de arriba','#9b1c1c',3500); }},
  {t:46*60,fn:()=>{ playDoorSlam(); playStringDissonance(); showMessage('PADRE OLMEDO','La niña nunca debió nacer. Ese fue el principio.',700); }},
  {t:42*60,fn:()=>{ triggerSubtleScreamer(); playBreathing(); }},
  {t:38*60,fn:()=>{ triggerScreenGlitch(); playViolinScratch(); if(Math.random()<0.5) triggerScreamer('TE OBSERVO'); showMessage('ROSARIO','No puedo parar de escuchar su voz. No puedo.',400); }},
  {t:34*60,fn:()=>{ playWallKnock(); playDistantCrying(); showHorrorText('los golpes en la pared se acercan','#8b0000',3000); }},
  {t:28*60,fn:()=>{ triggerScreenGlitch(); playDeadPiano(); showMessage('ALGO','YA FALTA POCO. ¿O CREÍAS QUE IBAS A SALIR?',0); }},
  {t:24*60,fn:()=>{ playMusicBox(); showHorrorText('la caja de música para de golpe','#6b5a48',2000); }},
  {t:20*60,fn:()=>{ playStringDissonance(); showMessage('ROSARIO OLMEDO','1947. Ese fue el año. Corre.',300); }},
  {t:16*60,fn:()=>{ triggerScreamer('DETRÁS DE TI'); }},
  {t:11*60,fn:()=>{ showMessage('SISTEMA','⚠ 11 MINUTOS.',0); triggerHeartbeatEffect(); playViolinScratch(); }},
  {t:8*60, fn:()=>{ playFootsteps(); showHorrorText('los pasos bajan las escaleras','#c0392b',2500); }},
  {t:6*60, fn:()=>{ triggerScreamer('¡CORRE!'); playScream(); }},
  {t:4*60, fn:()=>{ playDistantCrying(); showHorrorText('el llanto es ahora un susurro en tu oído','#9b1c1c',3000); }},
  {t:2*60, fn:()=>{ showMessage('ALGO','QUEDATE · QUEDATE · QUEDATE',0); playScream(); triggerScreenGlitch(); }},
  {t:60,   fn:()=>{ triggerScreamer('FIN INMINENTE'); playStringDissonance(); }},
];
EVENTS.forEach(e=>e.sent=false);
function checkDynamicEvents(){ EVENTS.forEach(e=>{ if(!e.sent&&STATE.timerSeconds<=e.t){ e.sent=true; e.fn(); } }); }

function triggerScreenGlitch(){
  document.body.classList.add('glitch-body'); playGlitch();
  setTimeout(()=>document.body.classList.remove('glitch-body'),380);
}
function triggerHeartbeatEffect(){ let n=0; const iv=setInterval(()=>{ playHeartbeat(true); if(++n>=10) clearInterval(iv); },650); }

// Texto de horror que aparece brevemente en la pantalla (sin popup)
function showHorrorText(text, color='#8b0000', duration=2500){
  const el=document.createElement('div');
  el.style.cssText=`
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    font-family:'IM Fell English',serif;font-style:italic;font-size:clamp(1rem,3vw,1.4rem);
    color:${color};text-align:center;pointer-events:none;z-index:700;
    animation:horror-text-appear ${duration}ms ease forwards;
    text-shadow:0 0 20px ${color};max-width:80%;
  `;
  el.textContent=text;
  if(!document.getElementById('horrorTextStyle')){
    const s=document.createElement('style'); s.id='horrorTextStyle';
    s.textContent=`@keyframes horror-text-appear{0%{opacity:0;letter-spacing:0.5em;}15%{opacity:1;letter-spacing:0.08em;}75%{opacity:0.9;}100%{opacity:0;letter-spacing:0.15em;}}`;
    document.head.appendChild(s);
  }
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), duration+100);
}

// Screamer sutil — imagen pequeña en esquina sin flash total
function triggerSubtleScreamer(){
  if(screamCooldown) return;
  const el=document.createElement('div');
  el.style.cssText=`
    position:fixed;bottom:80px;right:0;width:120px;z-index:600;
    animation:subtle-screamer 2.5s ease forwards;pointer-events:none;
  `;
  el.innerHTML=SCREAMERS[1]; // La figura del pasillo
  if(!document.getElementById('subtleScreamerStyle')){
    const s=document.createElement('style'); s.id='subtleScreamerStyle';
    s.textContent=`@keyframes subtle-screamer{0%{opacity:0;transform:translateX(100%);}10%{opacity:0.8;transform:translateX(0);}80%{opacity:0.6;}100%{opacity:0;transform:translateX(20px);}}`;
    document.head.appendChild(s);
  }
  document.body.appendChild(el);
  playWhisper();
  setTimeout(()=>el.remove(), 2600);
}

// ─── SISTEMA DE FASES ───
const PHASES=[
  {id:0,label:'HALL DE ENTRADA', render:renderPhase0},
  {id:1,label:'BIBLIOTECA',       render:renderPhase1},
  {id:2,label:'DORMITORIO',       render:renderPhase2},
  {id:3,label:'CAPILLA PRIVADA',  render:renderPhase3},
  {id:4,label:'COCINA',           render:renderPhase4},
  {id:5,label:'SÓTANO SELLADO',   render:renderPhase5},
];

function advancePhase(){
  if(STATE.advancing) return;
  STATE.advancing=true;
  STATE.phase++; STATE.lastActivity=Date.now(); STATE.score=Math.max(0,STATE.score-2);
  if(STATE.phase>=PHASES.length){ triggerVictory(); return; }
  updateMap();
  const tr=document.getElementById('sceneTransition');
  tr.classList.add('active'); playDoorSlam();
  setTimeout(()=>{ PHASES[STATE.phase].render(); tr.classList.remove('active'); STATE.advancing=false; updateScoreHUD(); },1100);
}

// ─── VALIDACIÓN ───
function checkAnswer(inputId,feedbackId,correct,onCorrect,key){
  if(STATE.solved[key]) return;
  const input=document.getElementById(inputId), fb=document.getElementById(feedbackId);
  if(!input||!fb) return;
  const val=input.value.trim().toUpperCase().replace(/\s+/g,'');
  if(!STATE.attempts[key]) STATE.attempts[key]=0; STATE.attempts[key]++;
  if(val===correct.toUpperCase().replace(/\s+/g,'')){
    STATE.solved[key]=true; input.classList.add('correct'); input.disabled=true;
    fb.className='feedback-msg success show'; fb.textContent=getSMsg(); playUnlock(); markDots(key);
    registerSuccess(); STATE.score+=10; updateScoreHUD();
    setTimeout(onCorrect,1600);
  } else {
    input.classList.add('wrong'); fb.className='feedback-msg error show'; fb.textContent=getEMsg(STATE.attempts[key]);
    playWrong(); setTimeout(()=>input.classList.remove('wrong'),500);
    registerError(); markDots(key);
    if(STATE.attempts[key]>=3) triggerHintByFailure(STATE.phase);
    if(STATE.attempts[key]>=4&&Math.random()<0.35) setTimeout(()=>triggerScreamer(),900);
  }
}
const SMSGS=['...la cerradura cede con un sonido húmedo.','...algo se mueve en las paredes.','...un crujido recorre el suelo.','...el frío desaparece un instante.','...un susurro dice "sí".'];
const EMSGS=['Incorrecto.','No es eso. Algo cambia de sitio.','El ambiente se vuelve más pesado.','Escuchas una risa, casi infantil.','La vela parpadea. Tres veces.'];
function getSMsg(){ return SMSGS[Math.floor(Math.random()*SMSGS.length)]; }
function getEMsg(n){ return EMSGS[Math.min(n-1,EMSGS.length-1)]; }
function markDots(key){ document.querySelectorAll(`[data-dots="${key}"] .attempt-dot`).forEach((d,i)=>{ if(i<(STATE.attempts[key]||0)) d.classList.add('used'); }); }
function phaseDots(cur){ return `<div class="phase-indicator">${Array.from({length:6},(_,i)=>`<div class="phase-dot ${i<cur?'done':i===cur?'active':''}"></div>`).join('')}</div>`; }
function dotRow(n){ return Array.from({length:n},()=>'<div class="attempt-dot"></div>').join(''); }

// ═══════════════════════════════════════════════════════════
// FASE 0: HALL — Reloj con animación de entrada
// ═══════════════════════════════════════════════════════════
function renderPhase0(){
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(0)}
    <div class="narrative-panel candle-effect" data-room="HALL DE ENTRADA · MEDIANOCHE">
      <p class="narrative-text">
        La puerta se cierra detrás de ti con un golpe seco. El eco rebota demasiado tiempo.<br><br>
        El olor: <em>madera podrida, cera vieja</em>, y algo más. Algo orgánico.<br><br>
        Un <em>reloj de pie</em> domina la pared del fondo. Sus agujas se mueven lentamente... y se detienen.
        <span class="disturbing">Una cerradura de cuatro dígitos</span> bloquea la puerta interior.<br><br>
        En el suelo hay marcas de arrastre. <span class="disturbing">Recientes.</span>
      </p>
    </div>
    <div style="position:relative;width:100%;height:5px;overflow:visible;margin-bottom:6px;">
      <div style="position:absolute;width:50px;height:90px;background:radial-gradient(ellipse,rgba(0,0,0,0.5)0%,transparent 70%);top:-45px;animation:shadow-walk 14s ease-in-out infinite;pointer-events:none;"></div>
    </div>
    <div class="puzzle-container">
      <div class="puzzle-title"><span class="puzzle-icon">🕰</span>El Reloj Olmedo</div>
      <div style="display:flex;justify-content:center;margin-bottom:8px;position:relative;" id="clockWrap">
        <div id="clockSvgWrap">${generateClockSVG(10,10)}</div>
      </div>
      <p id="clockCaption" style="font-family:var(--font-mono);font-size:0.65rem;color:var(--blood);letter-spacing:0.2em;text-align:center;margin-bottom:24px;animation:blink-text 2.5s ease infinite;opacity:0;transition:opacity 1s;">
        "EL TIEMPO SE DETUVO CUANDO TODO ACABÓ"
      </p>
      <div class="puzzle-title"><span class="puzzle-icon">🔒</span>Cerradura</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">Hora y minutos que marcan las agujas. Haz clic para girar cada dígito.</p>
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
      <div class="document-stain" style="width:85px;height:65px;top:14px;right:22px;"></div>
    </div>`;

  // Animación del reloj: arranca moviéndose y para en 11:47
  animateClock();
}

function animateClock(){
  let hDeg=0, mDeg=0;
  const target_h=(11*30+47*0.5)-90; // ángulo de las 11h
  const target_m=47*6-90;           // ángulo de los 47min
  let t=0;
  const iv=setInterval(()=>{
    t+=0.06;
    hDeg=target_h*Math.min(1,t); mDeg=target_m*Math.min(1,t);
    const wrap=document.getElementById('clockSvgWrap');
    if(wrap) wrap.innerHTML=generateClockSVG(hDeg,mDeg);
    if(t>=1){
      clearInterval(iv);
      playCreak();
      setTimeout(()=>{
        const cap=document.getElementById('clockCaption');
        if(cap) cap.style.opacity='1';
      },400);
    }
  },35);
}

function generateClockSVG(hAngleDeg, mAngleDeg){
  const cx=110,cy=110,r=80;
  const hA=hAngleDeg*Math.PI/180;
  const mA=mAngleDeg*Math.PI/180;
  const hx=cx+44*Math.cos(hA), hy=cy+44*Math.sin(hA);
  const mx=cx+68*Math.cos(mA), my=cy+68*Math.sin(mA);
  const nums=Array.from({length:12},(_,i)=>{
    const a=(i*30-90)*Math.PI/180,n=i===0?12:i,nr=r-13,nx=cx+nr*Math.cos(a),ny=cy+nr*Math.sin(a);
    const hi=[10,11,0].includes(i);
    return `<text x="${nx.toFixed(1)}" y="${ny.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="${hi?'#e8dcc8':'#5a4538'}" font-size="${hi?'12':'10'}" font-weight="${hi?'bold':'normal'}" font-family="Georgia,serif">${n}</text>`;
  }).join('');
  const ticks=Array.from({length:60},(_,i)=>{
    const a=(i*6-90)*Math.PI/180,isH=i%5===0,r1=r-2,r2=r-(isH?11:6);
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
  const code=STATE.lockDigits.join(''); if(!STATE.attempts['lock0']) STATE.attempts['lock0']=0; STATE.attempts['lock0']++;
  const fb=document.getElementById('lockFeedback'); markDots('lock0');
  if(code==='1147'){
    STATE.solved['lock0']=true; document.getElementById('lockBtn').disabled=true;
    STATE.lockDigits.forEach((_,i)=>document.getElementById(`lockD${i}`)?.classList.add('open'));
    fb.className='feedback-msg success show'; fb.textContent='...un clic sordo. La cerradura cede.';
    playUnlock(); addItem('paginas_diario'); STATE.score+=15; updateScoreHUD();
    setTimeout(advancePhase,2500);
  } else {
    fb.className='feedback-msg error show'; fb.textContent=getEMsg(STATE.attempts['lock0']); playWrong();
    STATE.lockDigits.forEach((_,i)=>{ const el=document.getElementById(`lockD${i}`); el?.classList.add('locked'); setTimeout(()=>el?.classList.remove('locked'),500); });
    registerError(); if(STATE.attempts['lock0']>=3) triggerHintByFailure(0);
    if(STATE.attempts['lock0']>=4&&Math.random()<0.4) setTimeout(()=>triggerScreamer(),700);
  }
}

// ═══════════════════════════════════════════════════════════
// FASE 1: BIBLIOTECA — Puzzle manchas en el mapa
// ═══════════════════════════════════════════════════════════
const MAP_STAINS=[
  {x:80,y:60,r:22,letter:'R'},
  {x:200,y:90,r:18,letter:'O'},
  {x:140,y:150,r:25,letter:'S'},
  {x:280,y:55,r:20,letter:'A'},
  {x:60,y:170,r:16,letter:'R'},
  {x:320,y:140,r:22,letter:'I'},
  {x:230,y:180,r:19,letter:'O'},
];
let stainRevealed=[];

function renderPhase1(){
  stainRevealed=new Array(MAP_STAINS.length).fill(false);
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(1)}
    <div class="narrative-panel" data-room="BIBLIOTECA · PLANTA BAJA" style="border-left-color:#4a3020;background:rgba(16,11,5,0.75);">
      <p class="narrative-text">
        Miles de libros con los lomos quemados. Olor a humo impregnado para siempre.<br><br>
        En la mesa central, un <em>mapa antiguo de la mansión</em>. Está manchado —
        <span class="disturbing">manchas oscuras que ocultan algo debajo.</span><br><br>
        Al fondo, una vitrina sellada. Dentro, una llave. El candado espera un nombre.
      </p>
    </div>
    <div style="position:relative;width:100%;height:60px;overflow:hidden;margin-bottom:8px;background:rgba(8,5,2,0.7);border:1px solid #1a1008;">
      <div style="position:absolute;font-size:1.1rem;top:15px;animation:fall-book 9s ease infinite;">📕</div>
      <div style="position:absolute;font-size:0.9rem;top:12px;left:65%;animation:fall-book 12s ease 3.5s infinite;">📗</div>
      <div style="position:absolute;font-size:1rem;top:18px;left:35%;animation:fall-book 7s ease 1s infinite;">📘</div>
    </div>
    <div class="puzzle-container">
      <div class="puzzle-title"><span class="puzzle-icon">🗺</span>Mapa de la Mansión — Manchas Ocultas</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.88rem;margin-bottom:14px;">Haz clic en cada mancha para revelar lo que esconde.</p>
      <div style="display:flex;justify-content:center;margin-bottom:16px;">
        <svg id="mansionMapPuzzle" viewBox="0 0 380 220" width="100%" style="max-width:480px;cursor:pointer;border:1px solid #2a1e14;background:#0e0a06;">
          <!-- Fondo del mapa -->
          <rect x="0" y="0" width="380" height="220" fill="#100c08"/>
          <!-- Habitaciones del mapa estilizado -->
          <rect x="10" y="10" width="80" height="60" fill="none" stroke="#2a1e14" stroke-width="1"/>
          <rect x="95" y="10" width="80" height="60" fill="none" stroke="#2a1e14" stroke-width="1"/>
          <rect x="180" y="10" width="80" height="60" fill="none" stroke="#2a1e14" stroke-width="1"/>
          <rect x="265" y="10" width="105" height="60" fill="none" stroke="#2a1e14" stroke-width="1"/>
          <rect x="10" y="75" width="175" height="80" fill="none" stroke="#2a1e14" stroke-width="1"/>
          <rect x="190" y="75" width="180" height="80" fill="none" stroke="#2a1e14" stroke-width="1"/>
          <rect x="10" y="160" width="360" height="50" fill="none" stroke="#3a0000" stroke-width="1.5"/>
          <text x="190" y="188" text-anchor="middle" fill="#2a0808" font-size="9" font-family="monospace" letter-spacing="4">S Ó T A N O</text>
          <!-- Manchas de sangre (clicables) -->
          ${MAP_STAINS.map((s,i)=>`
            <g id="stain_${i}" onclick="revealStain(${i})" style="cursor:pointer;">
              <ellipse cx="${s.x}" cy="${s.y}" rx="${s.r}" ry="${s.r*0.75}" fill="rgba(90,0,0,0.75)" id="stainBlob_${i}"/>
              <text x="${s.x}" y="${s.y}" text-anchor="middle" dominant-baseline="central" fill="transparent" font-size="14" font-weight="bold" font-family="Georgia,serif" id="stainLetter_${i}">${s.letter}</text>
            </g>`).join('')}
        </svg>
      </div>
      <div style="display:flex;justify-content:center;margin-bottom:16px;">
        <div id="revealedLetters" style="font-family:var(--font-mono);font-size:1.4rem;letter-spacing:0.4em;color:var(--candle);min-height:2rem;min-width:200px;text-align:center;border-bottom:1px solid #3a2d20;padding-bottom:6px;">
          ${stainRevealed.map((_,i)=>stainRevealed[i]?MAP_STAINS[i].letter:'_').join(' ')}
        </div>
      </div>
      <div class="puzzle-title" style="margin-top:16px;"><span class="puzzle-icon">🔤</span>Candado de la Vitrina</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.88rem;margin-bottom:14px;">Las letras reveladas forman un nombre.</p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        <input type="text" class="game-input" id="diaryInput" placeholder="_ _ _ _ _ _ _" maxlength="10" autocomplete="off" onkeyup="if(event.key==='Enter')checkDiary()"/>
        <button class="action-btn primary-btn" onclick="checkDiary()">ABRIR VITRINA</button>
        <div class="feedback-msg" id="diaryFeedback"></div>
        <div class="attempt-dots" data-dots="diary1">${dotRow(5)}</div>
      </div>
    </div>`;
  setTimeout(()=>playWhisper(),3500);
}

function revealStain(i){
  if(stainRevealed[i]) return;
  stainRevealed[i]=true;
  const blob=document.getElementById(`stainBlob_${i}`);
  const letter=document.getElementById(`stainLetter_${i}`);
  if(blob) blob.style.opacity='0.1';
  if(letter){ letter.style.fill='#d4821a'; letter.style.fontSize='16px'; }
  playDrip();
  const rd=document.getElementById('revealedLetters');
  if(rd) rd.textContent=stainRevealed.map((r,j)=>r?MAP_STAINS[j].letter:'_').join(' ');
  if(stainRevealed.every(Boolean)){
    setTimeout(()=>{ const fb=document.getElementById('diaryFeedback'); if(fb){ fb.className='feedback-msg hint show'; fb.textContent='Todas las letras reveladas. ¿Qué nombre forman?'; } },300);
  }
}
function checkDiary(){ checkAnswer('diaryInput','diaryFeedback','ROSARIO',()=>{ addItem('llave_maestra'); addItem('foto_familia'); STATE.score+=15; setTimeout(advancePhase,1500); },'diary1'); }

// ═══════════════════════════════════════════════════════════
// FASE 2: DORMITORIO — Espejo roto (drag & drop)
// ═══════════════════════════════════════════════════════════
// 9 fragmentos, el orden correcto revela el número 7 en el espejo
const MIRROR_PIECES=[
  {id:0,emoji:'🌫',correctPos:0},{id:1,emoji:'👁',correctPos:1},{id:2,emoji:'🌫',correctPos:2},
  {id:3,emoji:'🩸',correctPos:3},{id:4,emoji:'7',correctPos:4},{id:5,emoji:'🩸',correctPos:5},
  {id:6,emoji:'🌫',correctPos:6},{id:7,emoji:'💀',correctPos:7},{id:8,emoji:'🌫',correctPos:8},
];
let mirrorOrder=[]; // posición actual de cada pieza
let dragSrc=null;

function renderPhase2(){
  // Mezclar piezas
  mirrorOrder=[...Array(9).keys()].sort(()=>Math.random()-0.5);
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(2)}
    <div class="narrative-panel" data-room="DORMITORIO MAYOR · PRIMERA PLANTA" style="border-left-color:#6b0000;background:rgba(20,6,6,0.8);">
      <p class="narrative-text">
        La cama está perfectamente hecha. Como si esperaran volver.<br><br>
        Un espejo grande en la pared está <span class="disturbing">roto en nueve fragmentos</span>.
        Algo está escrito en el cristal empañado, pero los fragmentos están desordenados.<br><br>
        En la pared opuesta, la pintura familiar: cinco figuras. La sexta, ausente.
      </p>
    </div>
    <div style="width:100%;border:1px solid #2a1010;overflow:hidden;margin-bottom:12px;background:#0a0404;">
      <svg viewBox="0 0 600 110" width="100%" style="opacity:0.55;">
        <rect width="600" height="110" fill="#0a0404"/>
        ${[70,150,230,390,470].map((x,i)=>`<ellipse cx="${x}" cy="34" rx="${14-i*0.5}" ry="${16-i*0.5}" fill="#180a08"/><rect x="${x-10}" y="50" width="${20-i}" height="${38+i*2}" fill="#120706"/>`).join('')}
        <ellipse cx="310" cy="34" rx="14" ry="16" fill="none" stroke="#3a0808" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
        <rect x="300" y="50" width="20" height="40" fill="none" stroke="#3a0808" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
        <text x="300" y="105" text-anchor="middle" fill="#1a0606" font-size="7" font-family="Georgia,serif" letter-spacing="4">FAMILIA OLMEDO · 1946</text>
      </svg>
    </div>
    <div class="puzzle-container" style="border-color:#4a1010;">
      <div class="puzzle-title"><span class="puzzle-icon">🪞</span>El Espejo Roto</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.88rem;margin-bottom:14px;">Arrastra los fragmentos para ordenar el espejo. El mensaje correcto aparecerá.</p>
      <div class="mirror-grid" id="mirrorGrid">
        ${mirrorOrder.map((pieceId,pos)=>`
          <div class="mirror-piece" id="mslot_${pos}" data-slot="${pos}" data-piece="${pieceId}"
            draggable="true"
            ondragstart="mirrorDragStart(event,${pos})"
            ondragover="mirrorDragOver(event)"
            ondrop="mirrorDrop(event,${pos})"
            onclick="mirrorTap(${pos})"
            style="font-size:1.6rem;text-align:center;">
            ${MIRROR_PIECES[pieceId].emoji}
          </div>`).join('')}
      </div>
      <div id="mirrorMsg" style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim);text-align:center;min-height:20px;margin-bottom:12px;"></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        <button class="action-btn primary-btn" onclick="checkMirror()">VALIDAR ESPEJO</button>
        <div class="feedback-msg" id="mirrorFeedback"></div>
        <div class="attempt-dots" data-dots="mirror2">${dotRow(5)}</div>
      </div>
    </div>
    <div class="document-card" style="border-color:#3a1010;">
      <div class="document-header">FOTOGRAFÍA FAMILIAR · REVERSO · 1946</div>
      <div class="document-body" style="font-style:italic;line-height:2.1;">
"La <span class="key-word">cuarta</span> nunca salió en las fotos.
Decía que la cámara la asustaba.
<span class="redacted">████████████████████████</span>
Siete éramos. Uno no debía existir."
      </div>
      <div class="document-stain" style="width:100px;height:80px;top:10px;right:20px;"></div>
    </div>`;
  setTimeout(()=>playWhisper(),2500);
}

// Drag & drop espejo
function mirrorDragStart(e,slot){ dragSrc=slot; e.dataTransfer.effectAllowed='move'; e.target.style.opacity='0.5'; }
function mirrorDragOver(e){ e.preventDefault(); e.currentTarget.classList.add('drag-over'); return false; }
function mirrorDrop(e,targetSlot){
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  if(dragSrc===null||dragSrc===targetSlot) return;
  // Intercambiar
  const tmp=mirrorOrder[dragSrc]; mirrorOrder[dragSrc]=mirrorOrder[targetSlot]; mirrorOrder[targetSlot]=tmp;
  playTone(400,0.1,'sine',0.04);
  refreshMirrorGrid();
  dragSrc=null;
}
let tapSelected=null;
function mirrorTap(slot){
  if(dragSrc!==null){ mirrorOrder[dragSrc]^=mirrorOrder[slot]; mirrorOrder[slot]^=mirrorOrder[dragSrc]; mirrorOrder[dragSrc]^=mirrorOrder[slot]; playTone(400,0.1,'sine',0.04); refreshMirrorGrid(); dragSrc=null; return; }
  if(tapSelected===null){ tapSelected=slot; document.getElementById(`mslot_${slot}`).style.border='2px solid var(--candle)'; }
  else if(tapSelected===slot){ tapSelected=null; document.getElementById(`mslot_${slot}`).style.border=''; }
  else{
    const tmp=mirrorOrder[tapSelected]; mirrorOrder[tapSelected]=mirrorOrder[slot]; mirrorOrder[slot]=tmp;
    document.getElementById(`mslot_${tapSelected}`).style.border='';
    playTone(400,0.1,'sine',0.04); refreshMirrorGrid(); tapSelected=null;
  }
}
function refreshMirrorGrid(){
  const grid=document.getElementById('mirrorGrid'); if(!grid) return;
  mirrorOrder.forEach((pieceId,pos)=>{
    const el=document.getElementById(`mslot_${pos}`);
    if(el){ el.dataset.piece=pieceId; el.innerHTML=MIRROR_PIECES[pieceId].emoji;
      el.draggable=true; el.ondragstart=(e)=>mirrorDragStart(e,pos);
      el.ondragover=mirrorDragOver; el.ondrop=(e)=>mirrorDrop(e,pos);
      el.onclick=()=>mirrorTap(pos);
    }
  });
  // Check parcial — si la pieza 4 (el "7") está en el centro (slot 4)
  if(mirrorOrder[4]===4){ const msg=document.getElementById('mirrorMsg'); if(msg) msg.textContent='El centro del espejo empieza a tomar forma...'; }
}
function checkMirror(){
  if(STATE.solved['mirror2']) return;
  if(!STATE.attempts['mirror2']) STATE.attempts['mirror2']=0; STATE.attempts['mirror2']++;
  const fb=document.getElementById('mirrorFeedback'); markDots('mirror2');
  const correct=mirrorOrder.every((pieceId,pos)=>MIRROR_PIECES[pieceId].correctPos===pos);
  if(correct){
    STATE.solved['mirror2']=true; fb.className='feedback-msg success show';
    fb.textContent='...el espejo revela su mensaje. El número grabado con el dedo: 7.';
    document.querySelectorAll('.mirror-piece').forEach(el=>el.classList.add('correct-pos'));
    playUnlock(); addItem('cirio_negro'); addItem('carta_oculta'); STATE.score+=15; updateScoreHUD();
    setTimeout(advancePhase,2000);
  } else {
    fb.className='feedback-msg error show'; fb.textContent='El espejo no refleja lo correcto todavía.'; playWrong();
    registerError(); if(STATE.attempts['mirror2']>=3) triggerHintByFailure(2);
    if(STATE.attempts['mirror2']>=4&&Math.random()<0.4) setTimeout(()=>triggerScreamer(),700);
  }
}

// ═══════════════════════════════════════════════════════════
// FASE 3: CAPILLA — Runas (mejorada con velas que se apagan)
// ═══════════════════════════════════════════════════════════
let candlesLit=4;
function renderPhase3(){
  STATE.ritualSlots=['','','',''];
  candlesLit=4;
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(3)}
    <div class="narrative-panel" data-room="CAPILLA PRIVADA · PLANTA BAJA" style="border-left-color:#3d1a00;background:rgba(14,7,2,0.85);">
      <p class="narrative-text">
        Los bancos volcados. Cuatro velas iluminan el altar de piedra.<br><br>
        Cuatro huecos tallados esperan algo. En el suelo, las piedras con runas elementales.<br><br>
        En la pared, grabado a sangre: el orden del ritual.
        <span class="disturbing">Cada error apagará una vela. Si se apagan todas...</span>
      </p>
    </div>
    <div style="display:flex;justify-content:center;gap:20px;padding:14px 0;background:rgba(8,4,1,0.85);border:1px solid #1a0e04;margin-bottom:12px;" id="candleRow">
      ${[0,1,2,3].map(i=>`
        <div id="candle_${i}" style="display:flex;flex-direction:column;align-items:center;animation:candle-sway ${2+i*0.3}s ease-in-out infinite ${i*0.5}s;">
          <div id="flame_${i}" style="width:6px;height:14px;background:radial-gradient(ellipse at 50% 0%,#fff8e0 0%,#ffaa22 50%,transparent 100%);border-radius:50% 50% 30% 30%;animation:flame-flicker ${0.4+i*0.08}s ease-in-out infinite alternate;transition:opacity 0.8s;"></div>
          <div style="width:9px;height:${30+i*5}px;background:linear-gradient(180deg,#1c1008,#0d0804);border:1px solid #2a1810;"></div>
        </div>`).join('')}
    </div>
    <div class="document-card" style="border-color:#3d1a00;">
      <div class="document-header">INSCRIPCIÓN EN LA PARED</div>
      <div class="document-body" style="font-style:italic;line-height:2.3;">
"<span class="key-word">Ignis</span> a septentrione incipit — El fuego empieza en el Norte
<span class="key-word">Aqua</span> in oriente sequitur — el agua sigue en el Este
<span class="key-word">Terra</span> in meridie ponetur — la tierra en el Sur
<span class="key-word">Ventus</span> in occidente claudit" — el viento cierra en el Oeste
      </div>
    </div>
    <div class="puzzle-container" style="border-color:#3d1a00;background:rgba(10,5,1,0.9);">
      <div class="puzzle-title"><span class="puzzle-icon">⛧</span>Círculo Ritual · <span id="candleCount" style="color:var(--candle);font-size:0.8rem;">🕯×4</span></div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.88rem;margin-bottom:14px;">Selecciona una runa, colócala en su posición. Cada error apagará una vela.</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:18px;flex-wrap:wrap;">
        ${[['🔥','Fuego'],['💧','Agua'],['🌿','Tierra'],['💨','Viento']].map(([e,n])=>`
          <div onclick="selectRune('${e}','${n}')" style="padding:9px 13px;border:1px solid #3a2d20;background:#0e0804;cursor:pointer;font-size:1.2rem;transition:all 0.2s;user-select:none;" onmouseover="this.style.borderColor='var(--blood)'" onmouseout="this.style.borderColor='#3a2d20'">${e} <span style="font-family:var(--font-mono);font-size:0.67rem;color:var(--text-dim);vertical-align:middle;">${n}</span></div>`).join('')}
      </div>
      <div style="position:relative;width:200px;height:200px;margin:0 auto 18px;">
        <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.2" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="#8b0000" stroke-width="1" stroke-dasharray="6,4"/>
          <circle cx="100" cy="100" r="65" fill="none" stroke="#3a2d20" stroke-width="1"/>
          <line x1="100" y1="10" x2="100" y2="190" stroke="#1a1010" stroke-width="0.5"/>
          <line x1="10" y1="100" x2="190" y2="100" stroke="#1a1010" stroke-width="0.5"/>
        </svg>
        <div style="position:absolute;top:5px;left:50%;transform:translateX(-50%);"><div id="slot_norte" class="rune-slot" onclick="placeRune('norte')" style="font-size:1.3rem;">${STATE.ritualSlots[0]||'<span style="color:#2a1e14;font-size:0.72rem;font-family:var(--font-mono)">N</span>'}</div></div>
        <div style="position:absolute;right:5px;top:50%;transform:translateY(-50%);"><div id="slot_este" class="rune-slot" onclick="placeRune('este')" style="font-size:1.3rem;">${STATE.ritualSlots[1]||'<span style="color:#2a1e14;font-size:0.72rem;font-family:var(--font-mono)">E</span>'}</div></div>
        <div style="position:absolute;bottom:5px;left:50%;transform:translateX(-50%);"><div id="slot_sur" class="rune-slot" onclick="placeRune('sur')" style="font-size:1.3rem;">${STATE.ritualSlots[2]||'<span style="color:#2a1e14;font-size:0.72rem;font-family:var(--font-mono)">S</span>'}</div></div>
        <div style="position:absolute;left:5px;top:50%;transform:translateY(-50%);"><div id="slot_oeste" class="rune-slot" onclick="placeRune('oeste')" style="font-size:1.3rem;">${STATE.ritualSlots[3]||'<span style="color:#2a1e14;font-size:0.72rem;font-family:var(--font-mono)">O</span>'}</div></div>
      </div>
      <p id="selectedRuneLabel" style="font-family:var(--font-mono);font-size:0.72rem;color:var(--candle);text-align:center;min-height:18px;"></p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
        <button class="action-btn primary-btn" onclick="checkRitual()">COMPLETAR RITUAL</button>
        <button class="action-btn" onclick="resetRitual()" style="font-size:0.7rem;padding:5px 16px;">Limpiar</button>
        <div class="feedback-msg" id="ritualFeedback"></div>
        <div class="attempt-dots" data-dots="ritual3">${dotRow(5)}</div>
      </div>
    </div>`;
  setTimeout(()=>playChurch(),3500);
}

let selectedRune=null;
function selectRune(e,n){ selectedRune=e; document.getElementById('selectedRuneLabel').textContent=`Seleccionado: ${e} ${n}`; playTone(440,0.1,'triangle',0.04); }
function placeRune(pos){ if(!selectedRune){ giveHint(3,0); return; } const map={norte:0,este:1,sur:2,oeste:3}; STATE.ritualSlots[map[pos]]=selectedRune; const el=document.getElementById(`slot_${pos}`); if(el){ el.textContent=selectedRune; el.classList.add('placed'); } playTone(300+map[pos]*80,0.15,'sine',0.05); selectedRune=null; document.getElementById('selectedRuneLabel').textContent=''; }
function resetRitual(){ STATE.ritualSlots=['','','','']; renderPhase3(); }

function extinguishCandle(){
  if(candlesLit<=0) return;
  candlesLit--;
  const fl=document.getElementById(`flame_${candlesLit}`);
  if(fl) fl.style.opacity='0';
  const cc=document.getElementById('candleCount');
  if(cc) cc.textContent=`🕯×${candlesLit}`;
  if(candlesLit===0){
    setTimeout(()=>{ triggerScreamer('OSCURIDAD TOTAL'); document.getElementById('brightnessOverlay').style.background='rgba(0,0,0,0.5)'; setTimeout(()=>{ document.getElementById('brightnessOverlay').style.background=`rgba(0,0,0,${STATE.totalErrors*0.04})`; renderPhase3(); },3000); },500);
  }
}

function checkRitual(){
  if(STATE.solved['ritual3']) return;
  const correct=['🔥','💧','🌿','💨'];
  if(!STATE.attempts['ritual3']) STATE.attempts['ritual3']=0; STATE.attempts['ritual3']++;
  markDots('ritual3'); const fb=document.getElementById('ritualFeedback');
  if(STATE.ritualSlots.every((r,i)=>r===correct[i])){
    STATE.solved['ritual3']=true; fb.className='feedback-msg success show';
    fb.textContent='...el sello de cera se derrite. Olor a azufre.';
    playUnlock(); STATE.score+=15; updateScoreHUD();
    setTimeout(()=>{ addItem('sello_olmedo'); advancePhase(); },2000);
  } else {
    fb.className='feedback-msg error show'; fb.textContent=getEMsg(STATE.attempts['ritual3']); playWrong();
    extinguishCandle(); registerError();
    if(STATE.attempts['ritual3']>=3) triggerHintByFailure(3);
  }
}

// ═══════════════════════════════════════════════════════════
// FASE 4: COCINA — Caldero interactivo (drag & drop)
// ═══════════════════════════════════════════════════════════
const ALL_INGREDIENTS=[
  {id:'agua',label:'💧 Agua de pozo',step:1,correct:true},
  {id:'huesos',label:'🦴 Huesos',step:1,correct:true},
  {id:'sal',label:'🧂 Sal gruesa',step:1,correct:true},
  {id:'belladona',label:'🌿 Belladona',step:2,correct:true},
  {id:'rosa',label:'🌹 Rosa negra',step:2,correct:true},
  {id:'tierra',label:'⬛ Tierra cementerio',step:2,correct:true},
  {id:'grasa',label:'🕯 Grasa de vela',step:2,correct:true},
  {id:'hilo',label:'🧵 Hilo rojo',step:2,correct:true},
  {id:'plumas',label:'🪶 Plumas cuervo×7',step:2,correct:true},
  {id:'moneda',label:'🪙 Moneda muertos',step:2,correct:true},
  {id:'sangre',label:'🩸 Gota de sangre',step:3,correct:true},
  {id:'oracion',label:'🙏 Oración silencio',step:3,correct:true},
  {id:'incienso',label:'🌫 Incienso mirra',step:3,correct:true},
  {id:'cenizas',label:'💨 Cenizas del nombre',step:3,correct:true},
  // Ingredientes trampa (no en la receta)
  {id:'azucar',label:'🍬 Azúcar',step:0,correct:false},
  {id:'hierba',label:'🌱 Hierba común',step:0,correct:false},
];
let cauldronAdded=[], currentStep=1, cauldronErrors=0;

function renderPhase4(){
  cauldronAdded=[]; currentStep=1; cauldronErrors=0;
  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(4)}
    <div class="narrative-panel" data-room="COCINA · PLANTA BAJA" style="border-left-color:#5a2a00;background:rgba(16,8,2,0.85);">
      <p class="narrative-text">
        Décadas sin usarse, pero <em>la hornilla central está caliente.</em><br><br>
        Un caldero humeante espera en el centro. El libro de recetas está abierto.
        Lo que se cocinaba aquí no era comida.<br><br>
        <span class="disturbing">Arrastra los ingredientes correctos al caldero</span> en el orden de la receta.
      </p>
    </div>
    <div class="puzzle-container" style="border-color:#3a1a00;">
      <div class="puzzle-title"><span class="puzzle-icon">🧪</span>La Receta Prohibida · Paso <span id="stepLabel">1/3</span></div>
      <div class="kitchen-scene">
        <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--candle);margin-bottom:8px;text-align:center;" id="stepInstruction">Paso 1: Ingredientes de preparación (3 elementos)</div>
        <div class="ingredients-shelf" id="ingredientShelf">
          ${ALL_INGREDIENTS.filter(i=>i.step===1||i.step===0).map(i=>`
            <div class="ingredient-item" id="ing_${i.id}" onclick="addToCauldron('${i.id}')">${i.label}</div>
          `).join('')}
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;position:relative;">
          <div class="cauldron-drop" id="cauldronDrop" onclick="checkCauldronStep()">
            <div class="cauldron-smoke"></div>
            <span style="font-size:2rem;">🫕</span>
          </div>
          <div class="cauldron-counter" id="cauldronCounter">0 / 3 ingredientes</div>
        </div>
        <button class="action-btn primary-btn" id="cauldronBtn" onclick="checkCauldronStep()" style="margin-top:8px;">VERTER PASO ${currentStep}</button>
      </div>
      <div class="feedback-msg" id="cauldronFeedback"></div>
      <div class="attempt-dots" data-dots="cauldron4">${dotRow(5)}</div>
    </div>
    ${hasItem('carta_oculta')?`<div class="document-card" style="border-color:rgba(139,0,0,0.4);background:rgba(14,3,3,0.8);"><div class="document-header">CARTA OCULTA</div><div class="document-body" style="font-style:italic;color:rgba(200,140,140,0.8);">"Si lees esto, ya es tarde. El sótano. El número es el año en que todo terminó. No te quedes. <span class='disturbing'>Ella todavía está ahí abajo.</span>"</div></div>`:''}`;
}

function addToCauldron(id){
  const ing=ALL_INGREDIENTS.find(i=>i.id===id); if(!ing||cauldronAdded.includes(id)) return;
  const el=document.getElementById(`ing_${id}`); if(el) el.classList.add('used');
  cauldronAdded.push(id);
  const step=ALL_INGREDIENTS.find(i=>i.id===id).step;
  const cauldron=document.getElementById('cauldronDrop');
  if(ing.correct&&ing.step===currentStep){
    cauldron?.classList.add('bubble'); setTimeout(()=>cauldron?.classList.remove('bubble'),600);
    playTone(400+Math.random()*100,0.2,'sine',0.05);
  } else if(!ing.correct){
    cauldron?.classList.add('wrong-item'); setTimeout(()=>cauldron?.classList.remove('wrong-item'),500);
    playWrong(); registerError(); cauldronErrors++;
    const fb=document.getElementById('cauldronFeedback'); if(fb){ fb.className='feedback-msg error show'; fb.textContent='Ese ingrediente no pertenece a esta receta. El caldero humea negro.'; }
    setTimeout(()=>{ if(el) el.classList.remove('used'); cauldronAdded=cauldronAdded.filter(i=>i!==id); },800);
    return;
  }
  const stepItems=cauldronAdded.filter(i=>{ const ing2=ALL_INGREDIENTS.find(x=>x.id===i); return ing2&&ing2.step===currentStep&&ing2.correct; });
  const stepTotal=[0,3,7,4][currentStep]||0;
  const counter=document.getElementById('cauldronCounter'); if(counter) counter.textContent=`${stepItems.length} / ${stepTotal} ingredientes`;
}

function checkCauldronStep(){
  if(STATE.solved['cauldron4']) return;
  const stepItems=cauldronAdded.filter(i=>{ const ing=ALL_INGREDIENTS.find(x=>x.id===i); return ing&&ing.step===currentStep&&ing.correct; });
  const stepTotal=[0,3,7,4][currentStep];
  const fb=document.getElementById('cauldronFeedback');
  if(!STATE.attempts['cauldron4']) STATE.attempts['cauldron4']=0;

  if(stepItems.length===stepTotal){
    if(currentStep<3){
      currentStep++;
      playTone(600,0.3,'triangle',0.06);
      fb.className='feedback-msg success show'; fb.textContent=`¡Paso ${currentStep-1} completado! El caldero burbujea. Siguiente paso...`;
      document.getElementById('stepLabel').textContent=`${currentStep}/3`;
      const inst=document.getElementById('stepInstruction');
      const instTexts=['','Paso 1: Ingredientes de preparación (3 elementos)','Paso 2: El cuerpo (7 elementos)','Paso 3: El sellado (4 elementos)'];
      if(inst) inst.textContent=instTexts[currentStep];
      // Cambiar ingredientes visibles
      const shelf=document.getElementById('ingredientShelf');
      if(shelf){
        shelf.innerHTML=ALL_INGREDIENTS.filter(i=>i.step===currentStep||(i.step===0&&!cauldronAdded.includes(i.id))).map(i=>`
          <div class="ingredient-item ${cauldronAdded.includes(i.id)?'used':''}" id="ing_${i.id}" onclick="addToCauldron('${i.id}')">${i.label}</div>
        `).join('');
      }
      const btn=document.getElementById('cauldronBtn'); if(btn) btn.textContent=`VERTER PASO ${currentStep}`;
      const counter=document.getElementById('cauldronCounter'); if(counter) counter.textContent=`0 / ${[0,3,7,4][currentStep]} ingredientes`;
    } else {
      STATE.solved['cauldron4']=true;
      fb.className='feedback-msg success show'; fb.textContent='...la receta está completa. El sótano aguarda.';
      playUnlock(); addItem('llave_sotano'); STATE.score+=15; updateScoreHUD();
      setTimeout(advancePhase,2000);
    }
  } else {
    STATE.attempts['cauldron4']++;
    fb.className='feedback-msg error show'; fb.textContent=`Faltan ${stepTotal-stepItems.length} ingredientes correctos para este paso.`;
    playWrong(); registerError(); markDots('cauldron4');
    if(STATE.attempts['cauldron4']>=3) triggerHintByFailure(4);
  }
}

// ═══════════════════════════════════════════════════════════
// FASE 5: SÓTANO — Puzzle final multi-paso con mini-timer
// ═══════════════════════════════════════════════════════════
let finalStep=0, finalMiniTimer=90, finalTimerInterval=null;

function renderPhase5(){
  STATE.lockDigits=[0,0,0,0]; finalStep=0; finalMiniTimer=90;
  clearInterval(finalTimerInterval);

  document.getElementById('gameCanvas').innerHTML=`
    ${phaseDots(5)}
    <div class="narrative-panel" data-room="SÓTANO SELLADO · BAJO TIERRA" style="border:1px solid rgba(139,0,0,0.4);border-left:3px solid #c0392b;background:rgba(18,2,2,0.95);">
      <p class="narrative-text" style="color:rgba(225,195,180,0.95);">
        Las escaleras descienden hacia la nada. El sótano es <em>demasiado grande.</em><br><br>
        <span class="disturbing">En las paredes: marcas de uñas. Largas. Recientes.</span><br><br>
        Al fondo: la puerta de hierro. La salida. Pero el cierre tiene 3 fases de seguridad.
        Tienes 90 segundos por fase. Si el tiempo se agota, vuelves al inicio.<br><br>
        <span style="color:#c0392b;">Hay algo detrás de ti. No te des la vuelta.</span>
      </p>
    </div>
    <div class="wall-scratches">SACADME · SACADME · SACADME · SACADME · SACADME</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin-bottom:14px;">
      <div class="document-card" style="border-color:#3a0606;">
        <div class="document-header">LA VOZ DEL PUEBLO · 12·XI·1947</div>
        <div class="document-body" style="font-size:0.84rem;line-height:1.95;">
<span class="key-word" style="font-size:0.93rem;">DESAPARECE FAMILIA OLMEDO</span>
Sin rastro. Sin explicación.

El año: <span class="key-word" style="font-size:1.3rem;font-weight:bold;">1947</span>
        </div>
      </div>
      <div class="diary-entry" style="font-size:0.85rem;background:rgba(14,2,2,0.95);">
        <div class="diary-date" style="color:#c0392b;">ÚLTIMA PÁGINA</div>
El código de salida
es el año.

<span class='key-word' style='font-size:1.3rem;'>1947.</span>

Escápate.
— R.O.
      </div>
    </div>
    <div class="puzzle-container" style="border:2px solid rgba(139,0,0,0.55);background:rgba(14,2,2,0.97);" id="finalPuzzleBox">
      <div class="puzzle-title" style="color:var(--blood-light);"><span class="puzzle-icon">🚪</span>Puerta de Hierro — Sistema de Seguridad Triple</div>
      <div class="final-puzzle-steps" id="finalStepDots">
        <div class="final-step-dot active" id="fstep0">1</div>
        <div class="final-step-dot" id="fstep1">2</div>
        <div class="final-step-dot" id="fstep2">3</div>
      </div>
      <div id="finalMiniTimerEl" class="final-mini-timer">01:30</div>
      <div id="finalStepContent"></div>
    </div>`;

  setTimeout(()=>triggerScreamer('ELLA TE VE'),4500);
  setTimeout(()=>{ playDoorSlam(); showMessage('ALGO','NO SALDRÁS. NADIE SALE JAMÁS.',400); },22000);

  renderFinalStep();
  startFinalTimer();
}

function startFinalTimer(){
  clearInterval(finalTimerInterval);
  finalMiniTimer=90;
  finalTimerInterval=setInterval(()=>{
    finalMiniTimer--;
    const m=Math.floor(finalMiniTimer/60), s=finalMiniTimer%60;
    const el=document.getElementById('finalMiniTimerEl');
    if(el) el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if(finalMiniTimer<=15){ playHeartbeat(true); }
    if(finalMiniTimer<=0){
      clearInterval(finalTimerInterval);
      // Fallo: screamer y reset
      triggerScreamer('¡TIEMPO AGOTADO!');
      STATE.score=Math.max(0,STATE.score-20); updateScoreHUD(); registerError();
      setTimeout(()=>{ finalStep=0; renderPhase5(); },2500);
    }
  },1000);
}

function renderFinalStep(){
  const content=document.getElementById('finalStepContent'); if(!content) return;
  // Actualizar dots
  [0,1,2].forEach(i=>{
    const d=document.getElementById(`fstep${i}`); if(!d) return;
    d.className='final-step-dot'+(i<finalStep?' done':i===finalStep?' active':'');
  });

  if(finalStep===0){
    // Paso 1: Encontrar las 4 letras en la pared (click en las correctas)
    content.innerHTML=`
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:14px;text-align:center;">
        Paso 1: Las paredes están cubiertas de letras grabadas. Encuentra las 4 que forman el año.
      </p>
      <div id="wallLetters" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:400px;margin:0 auto 16px;padding:16px;background:rgba(8,2,2,0.8);border:1px solid rgba(60,0,0,0.3);">
        ${shuffleLetters().map((l,i)=>`<div class="wall-letter" id="wl_${i}" onclick="selectWallLetter('${l}',${i})" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:1px solid #2a1010;background:rgba(15,5,5,0.9);font-family:var(--font-mono);font-size:1.1rem;color:var(--text-dim);cursor:pointer;transition:all 0.2s;">${l}</div>`).join('')}
      </div>
      <div id="selectedLetters" style="font-family:var(--font-mono);font-size:1.5rem;letter-spacing:0.5em;color:var(--candle);text-align:center;min-height:2rem;border-bottom:1px solid #3a2d20;padding-bottom:8px;margin-bottom:12px;">_ _ _ _</div>
      <div style="text-align:center;"><button class="action-btn primary-btn" onclick="checkWallLetters()" style="animation:final-btn-pulse 1.5s ease-in-out infinite;">CONFIRMAR</button></div>
      <div class="feedback-msg" id="finalFeedback1"></div>`;
    window._wallSelected=[];
  }
  else if(finalStep===1){
    // Paso 2: Ordenar los 4 dígitos del año (drag between slots)
    content.innerHTML=`
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:14px;text-align:center;">
        Paso 2: Los dígitos están mezclados. Colócalos en el orden correcto.
      </p>
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:16px;">
        ${[9,1,4,7].sort(()=>Math.random()-0.5).map((d,i)=>`<div class="lock-digit" id="dsort_${i}" onclick="cycleFinalSort(${i})" style="font-size:2rem;width:52px;height:68px;">${d}</div>`).join('')}
      </div>
      <p style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-dim);text-align:center;margin-bottom:12px;">← Haz clic para girar hasta el dígito correcto</p>
      <div style="text-align:center;"><button class="action-btn primary-btn" onclick="checkDigitOrder()" style="animation:final-btn-pulse 1.5s ease-in-out infinite;">CONFIRMAR ORDEN</button></div>
      <div class="feedback-msg" id="finalFeedback2"></div>`;
    window._digitSortVals=[9,1,4,7].sort(()=>Math.random()-0.5);
  }
  else if(finalStep===2){
    // Paso 3: Introducir el año completo
    STATE.lockDigits=[0,0,0,0];
    content.innerHTML=`
      <p style="font-family:var(--font-body);font-style:italic;color:rgba(180,100,100,0.9);font-size:0.9rem;margin-bottom:14px;text-align:center;">
        Paso final: Introduce el año. Escuchas pasos. Ahora.
      </p>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">
        ${STATE.lockDigits.map((d,i)=>`<div class="lock-digit" id="finalD${i}" onclick="cycleFinalDigit(${i})" style="width:60px;height:80px;font-size:2.3rem;border-color:rgba(139,0,0,0.5);">${d}</div>`).join('')}
      </div>
      <div style="text-align:center;"><button class="action-btn primary-btn" id="finalBtn3" onclick="checkFinalCode()" style="border-color:var(--blood-light);color:var(--blood-light);font-size:1rem;padding:12px 36px;animation:final-btn-pulse 1.5s ease-in-out infinite;">ABRIR LA PUERTA</button></div>
      <div class="feedback-msg" id="finalFeedback3"></div>`;
  }
}

function shuffleLetters(){
  const correct=['1','9','4','7'];
  const noise=['X','R','A','L','M','O','S','E','T','C','N','Z','P','K','B'];
  const all=[...correct,...noise.slice(0,12)].sort(()=>Math.random()-0.5);
  return all;
}

function selectWallLetter(letter, idx){
  if(!window._wallSelected) window._wallSelected=[];
  if(window._wallSelected.length>=4) return;
  const el=document.getElementById(`wl_${idx}`); if(!el||el.style.opacity==='0.3') return;
  el.style.opacity='0.3'; el.style.borderColor='var(--blood)';
  window._wallSelected.push(letter);
  const sel=document.getElementById('selectedLetters');
  const display=window._wallSelected.concat(Array(4-window._wallSelected.length).fill('_'));
  if(sel) sel.textContent=display.join(' ');
  playTone(400+window._wallSelected.length*50,0.1,'triangle',0.04);
}

function checkWallLetters(){
  const sel=window._wallSelected||[];
  const fb=document.getElementById('finalFeedback1');
  const sorted=[...sel].sort().join('');
  if(sorted==='1479'||sel.join('')==='1947'||sel.join('')==='1'+'9'+'4'+'7'){
    if(fb){ fb.className='feedback-msg success show'; fb.textContent='Las letras correctas. Paso 1 superado.'; }
    playTone(600,0.3,'triangle',0.06);
    setTimeout(()=>{ finalStep=1; clearInterval(finalTimerInterval); startFinalTimer(); renderFinalStep(); },1200);
  } else {
    if(fb){ fb.className='feedback-msg error show'; fb.textContent='No es la combinación correcta. Los pasos se acercan.'; }
    playWrong(); registerError();
    window._wallSelected=[]; document.querySelectorAll('.wall-letter').forEach(el=>{ el.style.opacity='1'; el.style.borderColor='#2a1010'; });
    const sel2=document.getElementById('selectedLetters'); if(sel2) sel2.textContent='_ _ _ _';
    if(STATE.totalErrors>=5) triggerScreamer();
  }
}

function cycleFinalSort(i){
  if(!window._digitSortVals) return;
  window._digitSortVals[i]=(window._digitSortVals[i]+1)%10;
  const el=document.getElementById(`dsort_${i}`); if(el) el.textContent=window._digitSortVals[i];
  playTone(300+i*50,0.08,'triangle',0.04);
}
function checkDigitOrder(){
  const fb=document.getElementById('finalFeedback2');
  const val=(window._digitSortVals||[]).join('');
  if(val==='1947'){
    if(fb){ fb.className='feedback-msg success show'; fb.textContent='El orden correcto. Paso 2 superado.'; }
    playTone(700,0.3,'triangle',0.06);
    setTimeout(()=>{ finalStep=2; clearInterval(finalTimerInterval); startFinalTimer(); renderFinalStep(); },1200);
  } else {
    if(fb){ fb.className='feedback-msg error show'; fb.textContent='Orden incorrecto. La respiración detrás se acerca.'; }
    playWrong(); registerError();
    if(STATE.totalErrors>=6) setTimeout(()=>triggerScreamer('¡AHORA!'),400);
  }
}
function cycleFinalDigit(i){ if(STATE.solved['final5']) return; STATE.lockDigits[i]=(STATE.lockDigits[i]+1)%10; const el=document.getElementById(`finalD${i}`); if(el) el.textContent=STATE.lockDigits[i]; playTone(260+i*40,0.08,'triangle',0.04); }
function checkFinalCode(){
  if(STATE.solved['final5']) return;
  clearInterval(finalTimerInterval);
  const code=STATE.lockDigits.join('');
  const fb=document.getElementById('finalFeedback3');
  if(code==='1947'){
    STATE.solved['final5']=true;
    document.getElementById('finalBtn3').disabled=true;
    STATE.lockDigits.forEach((_,i)=>document.getElementById(`finalD${i}`)?.classList.add('open'));
    if(fb){ fb.className='feedback-msg success show'; fb.textContent='...la puerta de hierro gime. Aire frío. Luz. Libertad.'; }
    playUnlock(); STATE.score+=25; updateScoreHUD();
    setTimeout(triggerVictory,2800);
  } else {
    if(fb){ fb.className='feedback-msg error show'; fb.textContent=getEMsg(STATE.totalErrors+1); }
    playWrong(); registerError();
    STATE.lockDigits.forEach((_,i)=>{ const el=document.getElementById(`finalD${i}`); el?.classList.add('locked'); setTimeout(()=>el?.classList.remove('locked'),500); });
    if(STATE.totalErrors>=3) triggerHintByFailure(5);
    if(STATE.totalErrors>=4) setTimeout(()=>triggerScreamer('¡CORRE!'),500);
  }
}

// ─── SISTEMA DE RANGOS ───
function getRank(score, timeLeft, hintsUsed){
  if(timeLeft<0) return {icon:'💀',name:'El Atrapado',desc:'El tiempo se agotó. La mansión te retuvo.',color:'#8b0000'};
  if(score>=85&&hintsUsed===0&&timeLeft>45*60) return {icon:'👁️',name:'El Vidente',desc:'Perfección. Nadie lo había logrado tan rápido.',color:'#d4821a'};
  if(score>=70&&hintsUsed<=1&&timeLeft>30*60) return {icon:'🗝️',name:'El Maestro',desc:'Excepcional. Pocos llegan a este nivel.',color:'#c8b89a'};
  if(score>=50&&timeLeft>0) return {icon:'🔍',name:'El Investigador',desc:'Buen trabajo. La verdad de Rosario está a salvo contigo.',color:'#c8b89a'};
  if(timeLeft>0) return {icon:'🚪',name:'El Superviviente',desc:'Escapaste. Eso ya es más que la mayoría.',color:'#6b8b6b'};
  return {icon:'💀',name:'El Atrapado',desc:'La mansión te retuvo para siempre.',color:'#8b0000'};
}

// ─── FIN DEL JUEGO ───
function triggerVictory(){
  clearInterval(STATE.timerInterval); clearInterval(STATE.ambientInterval); clearInterval(finalTimerInterval);
  const elapsed=Math.floor((Date.now()-STATE.startTime)/1000);
  const m=Math.floor(elapsed/60), s=elapsed%60;
  const hintsUsed=Object.values(STATE.hintsGiven).reduce((a,b)=>a+b,0);
  const bonusTime=STATE.timerSeconds>60*60?30:STATE.timerSeconds>30*60?15:0;
  const finalScore=Math.min(100,STATE.score+bonusTime);
  const rank=getRank(finalScore,STATE.timerSeconds,hintsUsed);

  showEndScreen(true, rank, finalScore, m, s, elapsed, hintsUsed);
}

function triggerGameOver(){
  clearInterval(STATE.timerInterval); clearInterval(STATE.ambientInterval); clearInterval(finalTimerInterval);
  triggerScreamer('FIN');
  const rank=getRank(-1,-1,0);
  const elapsed=Math.floor((Date.now()-STATE.startTime)/1000);
  const m=Math.floor(elapsed/60), s=elapsed%60;
  const hintsUsed=Object.values(STATE.hintsGiven).reduce((a,b)=>a+b,0);
  setTimeout(()=>showEndScreen(false,rank,STATE.score,m,s,elapsed,hintsUsed),2600);
}

function showEndScreen(won, rank, finalScore, m, s, elapsed, hintsUsed){
  const sc=document.getElementById('endgameScreen'); sc.style.display='flex';
  document.getElementById('endRankBadge').textContent=rank.icon;
  document.getElementById('endRankBadge').style.color=rank.color;
  const title=document.getElementById('endTitle');
  title.className='endgame-title '+(won?'escaped':'died');
  title.textContent=won?`${rank.name}`:'El tiempo se agotó.';

  document.getElementById('endStatsGrid').innerHTML=`
    <div class="end-stat"><span class="end-stat-num">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span><span class="end-stat-label">TIEMPO</span></div>
    <div class="end-stat"><span class="end-stat-num">${finalScore}</span><span class="end-stat-label">PUNTUACIÓN</span></div>
    <div class="end-stat"><span class="end-stat-num">${hintsUsed}</span><span class="end-stat-label">PISTAS USADAS</span></div>
  `;

  document.getElementById('endText').innerHTML=rank.desc+(won?`<br><br><em style="color:var(--text-dim)">Superaste La Casa Olmedo con ${finalScore} puntos y ${STATE.totalErrors} errores totales.</em>`:'');

  if(won){ const cc=document.getElementById('cartaCompleta'); if(cc) cc.style.display='block'; }

  // Prefill del nombre si ya lo tenemos
  const nameEl=document.getElementById('endName'), emailEl=document.getElementById('endEmail');
  if(nameEl&&STATE.playerName) nameEl.value=STATE.playerName;
  if(emailEl&&STATE.playerEmail) emailEl.value=STATE.playerEmail;

  // Partículas de fondo
  const pp=document.getElementById('endParticles'); if(pp){
    for(let i=0;i<20;i++){
      const p=document.createElement('div');
      p.style.cssText=`position:absolute;width:2px;height:2px;border-radius:50%;background:${won?'var(--candle)':'var(--blood)'};left:${Math.random()*100}%;top:${Math.random()*100}%;opacity:${Math.random()*0.4};animation:float-up ${8+Math.random()*12}s linear infinite ${Math.random()*5}s;`;
      pp.appendChild(p);
    }
  }

  playUnlock();
  try{ localStorage.setItem('olmedo_record',JSON.stringify({score:finalScore,rank:rank.name,time:`${m}:${s}`,date:new Date().toLocaleDateString()})); }catch(e){}
}

function submitScore(){
  const name=document.getElementById('endName')?.value||STATE.playerName||'Anónimo';
  const email=document.getElementById('endEmail')?.value||STATE.playerEmail||'';
  if(name) localStorage.setItem('olmedo_name',name);
  if(email) localStorage.setItem('olmedo_email',email);
  const cap=document.getElementById('endCapture');
  if(cap){ cap.innerHTML='<div style="font-family:var(--font-mono);font-size:0.8rem;color:#4ac060;letter-spacing:0.1em;">✓ RESULTADO GUARDADO</div>'; }
}

function shareResult(){
  const record=JSON.parse(localStorage.getItem('olmedo_record')||'{}');
  const text=`Acabo de jugar La Casa Olmedo 🕯️\n"${record.rank||'Desconocido'}" · ${record.score||0} pts · ${record.time||'?'}\n¿Puedes superarme? → https://jcaogarci.github.io/olmedo-escape-room`;
  if(navigator.share){ navigator.share({title:'La Casa Olmedo',text}); }
  else{ navigator.clipboard.writeText(text).then(()=>alert('¡Texto copiado! Pégalo donde quieras.')).catch(()=>alert(text)); }
}

// ─── EFECTOS VISUALES DE TERROR ALEATORIOS ───

function triggerScanLine(){
  const el=document.createElement('div'); el.className='scan-line-effect';
  document.body.appendChild(el); setTimeout(()=>el.remove(),2200);
}

function triggerVignettePulse(){
  const v=document.getElementById('vignetteEl'); if(!v) return;
  v.classList.add('pulse'); setTimeout(()=>v.classList.remove('pulse'),3100);
}

function triggerPageFlicker(){
  const canvas=document.getElementById('gameCanvas'); if(!canvas) return;
  canvas.classList.add('page-flicker'); setTimeout(()=>canvas.classList.remove('page-flicker'),250);
}

function triggerFogRise(){
  const el=document.createElement('div'); el.className='fog-rise';
  document.body.appendChild(el); setTimeout(()=>el.remove(),4200);
}

// Sistema de terror visual aleatorio — se ejecuta cada 20-40 segundos
function startVisualTerrorLoop(){
  const interval=()=>{
    if(document.getElementById('endgameScreen')?.style.display!=='none') return;
    const intensity=getIntensityLevel();
    const r=Math.random();
    if(r<0.3) triggerScanLine();
    else if(r<0.55) triggerVignettePulse();
    else if(r<0.7) triggerPageFlicker();
    else if(r<0.85) { triggerFogRise(); }
    else if(r<0.95) showHorrorText(
      ['el suelo cruje bajo tus pies','una sombra pasa por el pasillo','huele a algo quemado','las paredes sudan','el frío llega de repente','alguien susurra tu nombre'][Math.floor(Math.random()*6)],
      '#6b5a48', 2800
    );
    // A más intensidad, más frecuente
    const next=(20000+Math.random()*20000)*(1-intensity*0.4);
    setTimeout(interval, next);
  };
  setTimeout(interval, 15000);
}

// ─── INIT ───
window.addEventListener('load',()=>{
  // Estilos adicionales
  const style=document.createElement('style');
  style.textContent=`
    .glitch-body{animation:body-glitch 0.38s step-end forwards;}
    @keyframes body-glitch{0%{filter:none;transform:none;}15%{filter:hue-rotate(90deg) invert(0.07);transform:translateX(-3px);}30%{filter:none;transform:translateX(2px);}55%{filter:hue-rotate(-80deg) saturate(1.9);}75%{filter:brightness(1.4);}100%{filter:none;transform:none;}}
    @keyframes shadow-walk{0%{left:-6%;opacity:0;}10%{opacity:0.55;}48%{left:50%;opacity:0.35;}56%{left:52%;opacity:0;}57%{left:105%;}100%{left:105%;opacity:0;}}
    @keyframes fall-book{0%,100%{transform:translateY(-45px) rotate(-6deg);opacity:0;}15%,85%{opacity:0.35;}50%{transform:translateY(25px) rotate(6deg);opacity:0.25;}}
    @keyframes steam-rise{0%,100%{opacity:0;}20%,80%{opacity:0.9;}50%{transform:scaleX(1.6) translateY(-38px);opacity:0.25;}}
    @keyframes candle-sway{0%,100%{transform:rotate(-2.5deg);}50%{transform:rotate(2.5deg);}}
    @keyframes flame-flicker{from{transform:scaleY(1) scaleX(1);opacity:0.9;}to{transform:scaleY(1.35) scaleX(0.75);opacity:0.55;}}
    @keyframes blink-text{0%,100%{opacity:0.55;}50%{opacity:0.12;}}
    @keyframes final-btn-pulse{0%,100%{box-shadow:0 0 6px rgba(139,0,0,0.25);}50%{box-shadow:0 0 28px rgba(192,57,43,0.65);}}
    @keyframes wf{from{opacity:0.9}to{opacity:0}}
  `;
  document.head.appendChild(style);

  // Leer nombre/email guardados
  const nameEl=document.getElementById('endName'), emailEl=document.getElementById('endEmail');
  if(nameEl&&STATE.playerName) nameEl.value=STATE.playerName;
  if(emailEl&&STATE.playerEmail) emailEl.value=STATE.playerEmail;

  updateMap();
  startTimer();
  startAmbience();
  renderPhase0();
  updateScoreHUD();
  startVisualTerrorLoop(); // ← Loop de efectos visuales aleatorios

  // Mensajes de bienvenida perturbadores
  setTimeout(()=>showMessage('SISTEMA','Conexión activa. Buena suerte... la necesitarás.'),4500);
  setTimeout(()=>{ playBreathing(); showHorrorText('una respiración detrás de ti','#6b5a48',2500); },12000);
  setTimeout(()=>showMessage('DESCONOCIDO','Ya te tenemos.',38000),38000);
  setTimeout(()=>{ playMusicBox(); },20000);
  setTimeout(()=>{ showHorrorText('¿puedes sentir que no estás solo?','#8b0000',3000); },55000);
});
