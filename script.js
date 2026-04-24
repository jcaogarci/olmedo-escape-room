/* ================================================================
   LA CASA OLMEDO — ESCAPE ROOM DE TERROR
   Script principal · Lógica completa del juego
   ================================================================ */

'use strict';

// ──────────────────────────────────────────────
// ESTADO DEL JUEGO
// ──────────────────────────────────────────────
const STATE = {
  phase: 0,                    // Fase actual (0-5)
  totalPhases: 6,
  timerSeconds: 90 * 60,       // 90 minutos
  timerInterval: null,
  startTime: Date.now(),
  inventory: [],               // Items recogidos
  solved: {},                  // Puzzles resueltos
  attempts: {},                // Intentos por puzzle
  hintsGiven: {},              // Pistas ya dadas
  scaresCued: false,           // Ya se lanzaron eventos de miedo
  lastActivity: Date.now(),    // Para detectar inactividad
  ambientInterval: null,
  eventQueue: [],              // Cola de eventos dinámicos
  messagesSent: [],            // Mensajes ya enviados
  lockDigits: [0, 0, 0, 0],   // Cerradura
  ritualSlots: ['', '', '', ''], // Puzzle ritual
  score: 100,                  // Puntuación base
};

// ──────────────────────────────────────────────
// SONIDOS ATMOSFÉRICOS (Web Audio API)
// ──────────────────────────────────────────────
const AC = window.AudioContext ? new AudioContext() : null;

function playTone(freq, duration, type = 'sine', vol = 0.05) {
  if (!AC) return;
  try {
    AC.resume();
    const osc = AC.createOscillator();
    const gain = AC.createGain();
    osc.connect(gain);
    gain.connect(AC.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(0, AC.currentTime);
    gain.gain.linearRampToValueAtTime(vol, AC.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + duration);
    osc.start(AC.currentTime);
    osc.stop(AC.currentTime + duration);
  } catch(e) {}
}

function playCreak() {
  if (!AC) return;
  try {
    AC.resume();
    // Ruido de madera crujiendo
    const buf = AC.createBuffer(1, AC.sampleRate * 0.8, AC.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (AC.sampleRate * 0.3));
    }
    const src = AC.createBufferSource();
    src.buffer = buf;
    const filter = AC.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    filter.Q.value = 0.5;
    const gain = AC.createGain();
    gain.gain.value = 0.3;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(AC.destination);
    src.start();
  } catch(e) {}
}

function playDrip() {
  playTone(180, 0.3, 'sine', 0.06);
  setTimeout(() => playTone(160, 0.2, 'sine', 0.03), 100);
}

function playGlitch() {
  if (!AC) return;
  try {
    AC.resume();
    [440, 220, 880, 110].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.05, 'square', 0.04), i * 30);
    });
  } catch(e) {}
}

function playUnlock() {
  [523, 659, 784].forEach((f, i) => {
    setTimeout(() => playTone(f, 0.25, 'triangle', 0.08), i * 120);
  });
}

function playWrong() {
  playTone(180, 0.4, 'sawtooth', 0.06);
  setTimeout(() => playTone(160, 0.3, 'sawtooth', 0.04), 100);
}

function playHeartbeat() {
  if (!AC) return;
  try {
    AC.resume();
    const playBeat = (t) => {
      const osc = AC.createOscillator();
      const gain = AC.createGain();
      osc.connect(gain);
      gain.connect(AC.destination);
      osc.type = 'sine';
      osc.frequency.value = 60;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.2);
    };
    const now = AC.currentTime;
    playBeat(now);
    playBeat(now + 0.25);
  } catch(e) {}
}

// Ambiente continuo de viento bajo
function startAmbience() {
  if (!AC) return;
  STATE.ambientInterval = setInterval(() => {
    if (Math.random() < 0.3) {
      playTone(40 + Math.random() * 20, 3 + Math.random() * 4, 'sine', 0.015);
    }
    if (Math.random() < 0.1) playDrip();
    if (Math.random() < 0.05) playCreak();
  }, 4000);
}

// ──────────────────────────────────────────────
// TIMER
// ──────────────────────────────────────────────
function startTimer() {
  STATE.timerInterval = setInterval(() => {
    STATE.timerSeconds--;

    const h = Math.floor(STATE.timerSeconds / 3600);
    const m = Math.floor((STATE.timerSeconds % 3600) / 60);
    const s = STATE.timerSeconds % 60;
    const display = STATE.timerSeconds >= 3600
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    const el = document.getElementById('hudTimer');
    if (el) {
      el.textContent = display;
      if (STATE.timerSeconds <= 600) el.classList.add('urgent');
      if (STATE.timerSeconds <= 300) playHeartbeat();
    }

    // Pistas automáticas por tiempo
    checkAutoHints();
    checkDynamicEvents();

    if (STATE.timerSeconds <= 0) {
      clearInterval(STATE.timerInterval);
      triggerGameOver('tiempo');
    }
  }, 1000);
}

// ──────────────────────────────────────────────
// INVENTARIO
// ──────────────────────────────────────────────
const ITEM_NAMES = {
  'llave_maestra':   '🗝 Llave Maestra',
  'paginas_diario':  '📜 Páginas del Diario',
  'frasco_sangre':   '🩸 Frasco Extraño',
  'foto_familia':    '🖼 Fotografía Rasgada',
  'cirio_negro':     '🕯 Cirio Negro',
  'carta_oculta':    '✉ Carta Oculta',
  'sello_olmedo':    '⚜ Sello Olmedo',
  'llave_sotano':    '🗝 Llave Sótano',
};

function addItem(id) {
  if (STATE.inventory.includes(id)) return;
  STATE.inventory.push(id);
  renderInventory();
  showMessage('OBJETO ENCONTRADO', `Has recogido: ${ITEM_NAMES[id] || id}`);
  playUnlock();
}

function hasItem(id) { return STATE.inventory.includes(id); }

function renderInventory() {
  const container = document.getElementById('inventoryItems');
  if (!container) return;
  if (STATE.inventory.length === 0) {
    container.innerHTML = '<span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);font-style:italic;">vacío</span>';
    return;
  }
  container.innerHTML = STATE.inventory.map(id =>
    `<div class="inv-item" title="${ITEM_NAMES[id] || id}" onclick="inspectItem('${id}')">${ITEM_NAMES[id] || id}</div>`
  ).join('');
}

function inspectItem(id) {
  const descriptions = {
    'llave_maestra':  'Una llave de hierro oxidado. En el mango hay grabadas las iniciales "R.O." Las nervaduras de la llave forman un patrón extraño.',
    'paginas_diario': 'Páginas arrancadas del diario de Rosario Olmedo. La tinta está diluida, como si hubiera llorado al escribirlas. Algunas palabras están rodeadas en rojo.',
    'frasco_sangre':  'Un frasco de cristal marrón. Dentro hay un líquido oscuro y espeso. Una etiqueta dice: "Para cuando llegue la hora. No antes."',
    'foto_familia':   'Una fotografía familiar de 1946. El padre, la madre, y tres niños. En el reverso hay escrito: "La cuarta nunca salió en las fotos."',
    'cirio_negro':    'Un cirio completamente negro, nunca encendido. En la cera están grabados números: aparecen y desaparecen según la luz.',
    'carta_oculta':   'Una carta doblada en cuatro. La letra es temblorosa: "Si lees esto, ya es tarde para mí. El sótano. El número es el año en que todo terminó."',
    'sello_olmedo':   'Un sello de lacre con el escudo de los Olmedo: un cuervo sobre una torre. Hay algo grabado en el metal que solo se ve con la luz correcta.',
    'llave_sotano':   'Una llave pequeña y negra. Tiene marcada la letra "S". El metal está frío, incluso después de sostenerla durante varios minutos.',
  };
  const desc = descriptions[id] || 'Un objeto misterioso.';

  const canvas = document.getElementById('gameCanvas');
  const existing = document.getElementById('itemInspect');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'itemInspect';
  div.className = 'incoming-message';
  div.style.cssText = 'position:fixed;bottom:80px;right:0;top:auto;width:320px;';
  div.innerHTML = `
    <div class="msg-header">
      <span>INSPECCIÓN</span>
      <button class="msg-close" onclick="document.getElementById('itemInspect').remove()">✕</button>
    </div>
    <div class="msg-body" style="font-style:italic;">${desc}</div>
  `;
  document.body.appendChild(div);
  setTimeout(() => div.classList.add('show'), 50);
}

// ──────────────────────────────────────────────
// MENSAJES DINÁMICOS
// ──────────────────────────────────────────────
function showMessage(from, body, delay = 0) {
  setTimeout(() => {
    const panel = document.getElementById('incomingMsg');
    document.getElementById('msgFrom').textContent = from;
    document.getElementById('msgBody').textContent = body;
    panel.classList.add('show');
    playGlitch();
  }, delay);
}

function closeMessage() {
  document.getElementById('incomingMsg').classList.remove('show');
}

// ──────────────────────────────────────────────
// PISTAS AUTOMÁTICAS
// ──────────────────────────────────────────────
const HINTS = {
  0: [ // Fase 0: Hall de entrada
    'El reloj de pie lleva décadas parado. ¿En qué hora?',
    'Los cuatro dígitos están grabados en el tiempo que marcaba el reloj cuando la familia desapareció.',
    'Respuesta: el reloj marca las 11:47. El código es 1147.',
  ],
  1: [ // Fase 1: Biblioteca
    'Las palabras en rojo del diario no son aleatorias.',
    'Las letras iniciales de esas palabras forman algo cuando se leen en orden.',
    'Las palabras son: Rojo, Oscuro, Seis, Anciano, Río, Iglesia, Otoño. Las iniciales: R-O-S-A-R-I-O.',
  ],
  2: [ // Fase 2: Dormitorio
    'El cifrado César usa un desplazamiento relacionado con la familia.',
    'Eran siete miembros en la familia. El desplazamiento es 7.',
    'Desplaza cada letra 7 posiciones hacia atrás en el alfabeto.',
  ],
  3: [ // Fase 3: Capilla
    'Las runas deben colocarse en el orden del ritual de invocación.',
    'El ritual siempre empieza por el Norte y sigue las agujas del reloj: Fuego, Agua, Tierra, Viento.',
    'Coloca las runas: 🔥 arriba, 💧 derecha, 🌿 abajo, 💨 izquierda.',
  ],
  4: [ // Fase 4: Cocina
    'La receta de Rosario oculta más de lo que parece.',
    'El número de ingredientes de cada paso es la clave.',
    'Cuenta los ingredientes: 3 en el primero, 7 en el segundo, 4 en el tercero. El código es 374.',
  ],
  5: [ // Fase 5: Sótano
    'El símbolo del sello Olmedo es la llave. Búscalo en la pared.',
    'El orden correcto es el que aparece en la fotografía familiar: padre, madre, hijos de mayor a menor.',
    'El código final: 1-9-4-7. El año en que la familia desapareció.',
  ],
};

function checkAutoHints() {
  const phase = STATE.phase;
  if (!STATE.attempts[phase]) STATE.attempts[phase] = 0;
  if (!STATE.hintsGiven[phase]) STATE.hintsGiven[phase] = 0;

  // Dar pista si llevan más de 8 minutos en la misma fase
  const timeInPhase = (Date.now() - STATE.lastActivity) / 1000 / 60;
  const hintIndex = STATE.hintsGiven[phase];

  if (timeInPhase > 8 && hintIndex < HINTS[phase]?.length) {
    giveHint(phase, hintIndex);
    STATE.hintsGiven[phase]++;
    STATE.lastActivity = Date.now(); // Reiniciar para siguiente pista
  }
}

function giveHint(phase, index) {
  const hints = HINTS[phase];
  if (!hints || !hints[index]) return;
  const panel = document.getElementById('hintPanel');
  document.getElementById('hintText').textContent = hints[index];
  panel.classList.add('show');
  setTimeout(() => panel.classList.remove('show'), 12000);
}

// Dar pista manualmente (por fallos)
function triggerHintByFailure(phase) {
  const hintIndex = Math.min(STATE.hintsGiven[phase] || 0, (HINTS[phase]?.length || 1) - 1);
  giveHint(phase, hintIndex);
  if (!(STATE.hintsGiven[phase] >= (HINTS[phase]?.length - 1))) {
    STATE.hintsGiven[phase] = (STATE.hintsGiven[phase] || 0) + 1;
  }
  STATE.score = Math.max(0, STATE.score - 5);
}

// ──────────────────────────────────────────────
// EVENTOS DINÁMICOS ATMOSFÉRICOS
// ──────────────────────────────────────────────
const DYNAMIC_EVENTS = [
  { time: 80 * 60, sent: false, fn: () => showMessage('SISTEMA', 'Conexión establecida. Te observamos.', 500) },
  { time: 70 * 60, sent: false, fn: () => showMessage('DESCONOCIDO', '¿Por qué has vuelto? No debías volver.', 800) },
  { time: 60 * 60, sent: false, fn: () => { triggerScreenGlitch(); showMessage('R.O.', 'Ayúdame. Aún estoy aquí. En el sótano.', 1500); }},
  { time: 50 * 60, sent: false, fn: () => showMessage('SISTEMA', 'ALERTA: Actividad paranormal detectada en sector B.', 300) },
  { time: 40 * 60, sent: false, fn: () => showMessage('PADRE OLMEDO', 'La niña nunca debió nacer. Eso fue el principio.', 600) },
  { time: 30 * 60, sent: false, fn: () => { triggerScreenGlitch(); showMessage('DESCONOCIDO', 'YA FALTA POCO. ¿O CREÍAS QUE IBAS A SALIR?', 0); }},
  { time: 20 * 60, sent: false, fn: () => showMessage('ROSARIO OLMEDO', 'El código del sótano... 1947. Ese fue el año. Corre.', 200) },
  { time: 10 * 60, sent: false, fn: () => { showMessage('SISTEMA', '⚠ ALERTA CRÍTICA: 10 minutos restantes.', 0); triggerHeartbeatEffect(); }},
  { time: 5 * 60,  sent: false, fn: () => showMessage('ALGO', 'QUEDATE. QUEDATE. QUEDATE.', 0) },
];

function checkDynamicEvents() {
  DYNAMIC_EVENTS.forEach(event => {
    if (!event.sent && STATE.timerSeconds <= event.time) {
      event.sent = true;
      event.fn();
    }
  });
}

function triggerScreenGlitch() {
  const body = document.body;
  body.classList.add('glitch-body');
  playGlitch();
  setTimeout(() => body.classList.remove('glitch-body'), 300);
}

function triggerHeartbeatEffect() {
  let count = 0;
  const interval = setInterval(() => {
    playHeartbeat();
    count++;
    if (count >= 5) clearInterval(interval);
  }, 800);
}

// ──────────────────────────────────────────────
// SISTEMA DE FASES
// ──────────────────────────────────────────────
const PHASES = [
  { id: 0, name: 'LA ENTRADA',   label: 'HALL DE ENTRADA',  render: renderPhase0 },
  { id: 1, name: 'LA BIBLIOTECA',label: 'BIBLIOTECA',        render: renderPhase1 },
  { id: 2, name: 'EL DORMITORIO',label: 'DORMITORIO MAYOR',  render: renderPhase2 },
  { id: 3, name: 'LA CAPILLA',   label: 'CAPILLA PRIVADA',   render: renderPhase3 },
  { id: 4, name: 'LA COCINA',    label: 'COCINA',             render: renderPhase4 },
  { id: 5, name: 'EL SÓTANO',    label: 'SÓTANO SELLADO',    render: renderPhase5 },
];

function advancePhase() {
  STATE.phase++;
  STATE.lastActivity = Date.now();
  STATE.score = Math.max(0, STATE.score - 2); // Pequeña penalización por tiempo

  if (STATE.phase >= PHASES.length) {
    triggerVictory();
    return;
  }

  // Actualizar HUD
  const fill = (STATE.phase / PHASES.length) * 100;
  document.getElementById('hudPhaseFill').style.width = fill + '%';
  document.getElementById('hudPhaseLabel').textContent = PHASES[STATE.phase].label;

  // Transición de escena
  const transition = document.getElementById('sceneTransition');
  transition.classList.add('active');
  playCreak();

  setTimeout(() => {
    PHASES[STATE.phase].render();
    transition.classList.remove('active');
  }, 1000);
}

// ──────────────────────────────────────────────
// UTILIDAD: Validación con feedback
// ──────────────────────────────────────────────
function checkAnswer(inputId, feedbackId, correctAnswer, onCorrect, puzzleKey) {
  const input = document.getElementById(inputId);
  const feedback = document.getElementById(feedbackId);
  if (!input || !feedback) return;

  const value = input.value.trim().toUpperCase().replace(/\s+/g, '');
  const correct = correctAnswer.toUpperCase().replace(/\s+/g, '');

  if (!STATE.attempts[puzzleKey]) STATE.attempts[puzzleKey] = 0;
  STATE.attempts[puzzleKey]++;

  if (value === correct) {
    input.classList.remove('wrong');
    input.classList.add('correct');
    input.disabled = true;
    feedback.className = 'feedback-msg success show';
    feedback.textContent = getSuccessMessage();
    STATE.solved[puzzleKey] = true;
    playUnlock();
    markAttemptDots(puzzleKey);
    setTimeout(() => onCorrect(), 1500);
  } else {
    input.classList.add('wrong');
    input.classList.remove('correct');
    feedback.className = 'feedback-msg error show';
    feedback.textContent = getErrorMessage(STATE.attempts[puzzleKey]);
    playWrong();
    setTimeout(() => input.classList.remove('wrong'), 500);

    // Dar pista si falla mucho
    if (STATE.attempts[puzzleKey] >= 3) {
      triggerHintByFailure(STATE.phase);
    }
    markAttemptDots(puzzleKey);
    STATE.score = Math.max(0, STATE.score - 3);
  }
}

const SUCCESS_MESSAGES = [
  '...la cerradura cede con un sonido húmedo.',
  '...algo se mueve en las paredes.',
  '...un crujido largo recorre el suelo.',
  '...el frío desaparece por un momento.',
  '...escuchas un susurro que dice "sí".',
];
const ERROR_MESSAGES = [
  'Incorrecto. Vuelves a intentarlo.',
  'No es eso. Algo en la habitación cambia de posición.',
  'El ambiente se vuelve más pesado.',
  'Escuchas una risa lejana.',
  'La vela parpadea. Tres veces.',
];

function getSuccessMessage() { return SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]; }
function getErrorMessage(n) { return ERROR_MESSAGES[Math.min(n - 1, ERROR_MESSAGES.length - 1)]; }

function markAttemptDots(key) {
  const dots = document.querySelectorAll(`[data-dots="${key}"] .attempt-dot`);
  const count = STATE.attempts[key] || 0;
  dots.forEach((d, i) => { if (i < count) d.classList.add('used'); });
}

// ──────────────────────────────────────────────
// FASE 0: HALL DE ENTRADA
// Puzzle: Cerradura de 4 dígitos (código del reloj parado)
// ──────────────────────────────────────────────
function renderPhase0() {
  const canvas = document.getElementById('gameCanvas');
  canvas.innerHTML = `
    <div class="phase-indicator" id="phaseIndicator">
      ${Array.from({length: 6}, (_,i) =>
        `<div class="phase-dot ${i < STATE.phase ? 'done' : i === STATE.phase ? 'active' : ''}"></div>`
      ).join('')}
    </div>

    <div class="narrative-panel candle-effect" data-room="HALL DE ENTRADA · NOCHE">
      <p class="narrative-text">
        La puerta se cierra detrás de ti con un golpe sordo. El olor es lo primero:
        <em>madera podrida, cera vieja, y algo más.</em> Algo orgánico.<br><br>
        El hall se extiende ante ti en penumbra. Un <em>reloj de pie</em> domina la pared del fondo,
        sus agujas detenidas para siempre. Frente a ti, una <span class="disturbing">puerta de hierro
        con una cerradura de cuatro dígitos</span> bloquea el paso a las habitaciones interiores.<br><br>
        En el suelo hay marcas de arrastre. Recientes.
      </p>
    </div>

    <!-- Imagen SVG del reloj -->
    <div class="puzzle-container">
      <div class="puzzle-title"><span class="puzzle-icon">🕰</span>El Reloj Olmedo</div>
      <div style="display:flex;justify-content:center;margin-bottom:20px;">
        ${generateClockSVG()}
      </div>
      <p style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim);text-align:center;margin-bottom:20px;letter-spacing:0.1em;">
        "El tiempo se detuvo cuando todo acabó."<br>— Inscripción en la base del reloj
      </p>

      <div class="puzzle-title" style="margin-top:24px;"><span class="puzzle-icon">🔒</span>Cerradura de la Puerta Interior</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">
        Los cuatro dígitos que marcan las agujas del reloj. Primero la hora, luego los minutos.
      </p>

      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div id="lockDots" style="display:flex;gap:6px;margin-bottom:8px;">
          ${STATE.lockDigits.map((d,i) =>
            `<div class="lock-digit" id="lockD${i}" onclick="cycleDigit(${i})">${d}</div>`
          ).join('')}
        </div>
        <p style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);">← Haz clic en los dígitos para cambiarlos</p>
        <button class="action-btn primary-btn" onclick="checkLock()">ABRIR CERRADURA</button>
        <div class="feedback-msg" id="lockFeedback"></div>
        <div class="attempt-dots" data-dots="lock0">
          ${Array.from({length:5},()=>'<div class="attempt-dot"></div>').join('')}
        </div>
      </div>
    </div>

    <div class="document-card">
      <div class="document-header">NOTA ENCONTRADA · EN EL SUELO</div>
      <div class="document-body">
Ha venido otra vez. Anoche lo escuché en el pasillo.
No dormí. No puedo dormir ya.

El código de la puerta es la hora en que
<span class="redacted">████████████████</span>
Papá dice que lo <span class="key-word">recuerdo</span> todo.
Tiene razón. No puedo olvidarlo.

        — R
      </div>
      <div class="document-stain" style="width:80px;height:60px;top:20px;right:30px;"></div>
    </div>
  `;
}

function generateClockSVG() {
  // Reloj SVG que marca las 11:47
  return `
  <svg viewBox="0 0 200 220" width="180" style="filter:drop-shadow(0 0 20px rgba(139,0,0,0.3))">
    <!-- Cuerpo del reloj -->
    <rect x="60" y="10" width="80" height="200" rx="6" fill="#1a1008" stroke="#3a2d20" stroke-width="2"/>
    <rect x="65" y="60" width="70" height="70" rx="35" fill="#0a0806" stroke="#2a1e14" stroke-width="1"/>

    <!-- Esfera -->
    <circle cx="100" cy="95" r="32" fill="#0e0a06" stroke="#3a2d20" stroke-width="1.5"/>

    <!-- Números de la esfera -->
    <text x="100" y="68" text-anchor="middle" fill="#5a4530" font-size="7" font-family="serif">12</text>
    <text x="129" y="99" text-anchor="middle" fill="#5a4530" font-size="7" font-family="serif">3</text>
    <text x="100" y="129" text-anchor="middle" fill="#5a4530" font-size="7" font-family="serif">6</text>
    <text x="71" y="99" text-anchor="middle" fill="#5a4530" font-size="7" font-family="serif">9</text>

    <!-- Manecilla de horas — 11 (330°) -->
    <line x1="100" y1="95"
          x2="${100 + 18*Math.sin((11*30-90)*Math.PI/180)}"
          y2="${95 + 18*Math.cos((11*30-90)*Math.PI/180+Math.PI)}"
          stroke="#c8b89a" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Manecilla de minutos — 47 (282°) -->
    <line x1="100" y1="95"
          x2="${100 + 25*Math.sin((47*6-90)*Math.PI/180)}"
          y2="${95 + 25*Math.cos((47*6-90)*Math.PI/180+Math.PI)}"
          stroke="#8b0000" stroke-width="1.5" stroke-linecap="round"/>

    <!-- Centro -->
    <circle cx="100" cy="95" r="3" fill="#8b0000"/>

    <!-- Péndulo (decorativo) -->
    <line x1="100" y1="130" x2="100" y2="185" stroke="#2a1e14" stroke-width="1.5"/>
    <circle cx="100" cy="190" r="10" fill="#1a1008" stroke="#3a2d20" stroke-width="1.5"/>

    <!-- Texto inferior -->
    <text x="100" y="210" text-anchor="middle" fill="#2a1e14" font-size="6" font-family="serif" letter-spacing="3">OLMEDO 1920</text>
  </svg>`;
}

function cycleDigit(index) {
  STATE.lockDigits[index] = (STATE.lockDigits[index] + 1) % 10;
  const el = document.getElementById(`lockD${index}`);
  if (el) el.textContent = STATE.lockDigits[index];
  playTone(300 + index * 50, 0.1, 'triangle', 0.04);
}

function checkLock() {
  const code = STATE.lockDigits.join('');
  if (!STATE.attempts['lock0']) STATE.attempts['lock0'] = 0;
  STATE.attempts['lock0']++;
  const feedback = document.getElementById('lockFeedback');

  if (code === '1147') {
    STATE.solved['lock0'] = true;
    STATE.lockDigits.forEach((_,i) => {
      document.getElementById(`lockD${i}`)?.classList.add('open');
    });
    feedback.className = 'feedback-msg success show';
    feedback.textContent = '...un clic sordo. La cerradura cede. La puerta se abre hacia la oscuridad.';
    playUnlock();
    addItem('paginas_diario');
    setTimeout(() => advancePhase(), 2500);
  } else {
    feedback.className = 'feedback-msg error show';
    feedback.textContent = getErrorMessage(STATE.attempts['lock0']);
    playWrong();
    if (STATE.attempts['lock0'] >= 3) triggerHintByFailure(0);
    STATE.lockDigits.forEach((_,i) => {
      const el = document.getElementById(`lockD${i}`);
      el?.classList.add('locked');
      setTimeout(() => el?.classList.remove('locked'), 500);
    });
    STATE.score = Math.max(0, STATE.score - 3);
    markAttemptDots('lock0');
  }
}

// ──────────────────────────────────────────────
// FASE 1: BIBLIOTECA
// Puzzle: Descifrar las palabras en rojo del diario → ROSARIO
// ──────────────────────────────────────────────
function renderPhase1() {
  const canvas = document.getElementById('gameCanvas');
  canvas.innerHTML = `
    <div class="phase-indicator">
      ${Array.from({length:6}, (_,i) =>
        `<div class="phase-dot ${i < STATE.phase ? 'done' : i === STATE.phase ? 'active' : ''}"></div>`
      ).join('')}
    </div>

    <div class="narrative-panel candle-effect" data-room="BIBLIOTECA · PLANTA BAJA">
      <p class="narrative-text">
        Miles de libros en estantes que llegan al techo. La mayoría con los lomos quemados.
        En el centro, <em>un escritorio con las páginas del diario</em> que encontraste en la entrada.<br><br>
        La letra es femenina, temblorosa. Algunas palabras están <span class="disturbing">rodeadas en tinta roja</span>,
        como si alguien las hubiera señalado después. O algo.<br><br>
        Una vitrina al fondo tiene un candado con combinación de letras. Dentro, una llave brillante.
      </p>
    </div>

    <div class="diary-entry">
      <div class="diary-date">14 DE OCTUBRE, 1947</div>
      <div class="document-body" style="white-space:pre-line;font-style:italic;line-height:2.1;font-size:0.95rem;">
Hoy el padre vino otra vez.
El <mark style="background:rgba(139,0,0,0.25);color:#c0392b;padding:0 3px;">Rojo</mark> de sus ojos cuando me mira.
Todo está <mark style="background:rgba(139,0,0,0.25);color:#c0392b;padding:0 3px;">Oscuro</mark> en esta casa.
<mark style="background:rgba(139,0,0,0.25);color:#c0392b;padding:0 3px;">Seis</mark> meses llevamos encerrados.
El viejo <mark style="background:rgba(139,0,0,0.25);color:#c0392b;padding:0 3px;">Anciano</mark> del pueblo tenía razón.
El <mark style="background:rgba(139,0,0,0.25);color:#c0392b;padding:0 3px;">Río</mark> se llevó a los que intentaron huir.
La <mark style="background:rgba(139,0,0,0.25);color:#c0392b;padding:0 3px;">Iglesia</mark> no puede ayudarnos.
Ese <mark style="background:rgba(139,0,0,0.25);color:#c0392b;padding:0 3px;">Otoño</mark> fue el último.

Que alguien lea esto. Por favor.
      </div>
    </div>

    <div class="puzzle-container">
      <div class="puzzle-title"><span class="puzzle-icon">🔤</span>Candado de la Vitrina</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">
        Las palabras marcadas en rojo esconden un nombre. Las iniciales de cada una, en orden, forman la combinación del candado.
      </p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <input type="text"
               class="game-input"
               id="diaryInput"
               placeholder="_ _ _ _ _ _ _"
               maxlength="10"
               autocomplete="off"
               onkeyup="if(event.key==='Enter')checkDiaryPuzzle()" />
        <button class="action-btn primary-btn" onclick="checkDiaryPuzzle()">ABRIR VITRINA</button>
        <div class="feedback-msg" id="diaryFeedback"></div>
        <div class="attempt-dots" data-dots="diary1">
          ${Array.from({length:5},()=>'<div class="attempt-dot"></div>').join('')}
        </div>
      </div>
    </div>
  `;
}

function checkDiaryPuzzle() {
  checkAnswer('diaryInput', 'diaryFeedback', 'ROSARIO', () => {
    addItem('llave_maestra');
    addItem('foto_familia');
    setTimeout(() => advancePhase(), 1500);
  }, 'diary1');
}

// ──────────────────────────────────────────────
// FASE 2: DORMITORIO
// Puzzle: Cifrado César con desplazamiento 7 → CUARTA
// ──────────────────────────────────────────────
function renderPhase2() {
  const canvas = document.getElementById('gameCanvas');
  // Texto cifrado con César+7: "JBHYA" = "CUARTA" (C+7=J, U+7=B, A+7=H, R+7=Y, T+7=A, A+7=H)
  // Verificar: CUARTA con César desplazamiento +7
  // C(2) +7 = J(9), U(20)+7=B(1), A(0)+7=H(7), R(17)+7=Y(24), T(19)+7=A(0), A(0)+7=H(7)
  // Cifrado: JBHYAH

  canvas.innerHTML = `
    <div class="phase-indicator">
      ${Array.from({length:6}, (_,i) =>
        `<div class="phase-dot ${i < STATE.phase ? 'done' : i === STATE.phase ? 'active' : ''}"></div>`
      ).join('')}
    </div>

    <div class="narrative-panel candle-effect" data-room="DORMITORIO MAYOR · PRIMERA PLANTA">
      <p class="narrative-text">
        La cama está hecha. Perfectamente hecha. Como si alguien esperara volver.<br><br>
        En la mesilla, un <em>papel doblado</em> con caracteres extraños. En la pared,
        una pintura al óleo de la familia Olmedo.<br><br>
        Contas uno, dos, tres... <span class="disturbing">cinco figuras en la pintura.</span>
        Pero la fotografía que encontraste mostraba seis. Falta alguien.<br><br>
        El armario está bloqueado con un cerrojo. En la puerta, una nota pide una palabra.
      </p>
    </div>

    <div class="puzzle-container">
      <div class="puzzle-title"><span class="puzzle-icon">📜</span>El Mensaje Cifrado</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:4px;">
        Encontrado bajo el colchón, escrito en tinta invisible revelada por el calor de una vela:
      </p>
      <div class="cipher-display">J B H Y A H</div>
      <p class="cipher-key-hint">Cifrado Romano · Familia numerosa · Cada letra desplazada</p>

      <div class="document-card" style="margin-top:16px;">
        <div class="document-header">FOTOGRAFÍA FAMILIAR · REVERSO</div>
        <div class="document-body" style="font-style:italic;">
"La <span class="key-word">cuarta</span> nunca salió en las fotos. Decía que la cámara la asustaba.
Nosotros sabíamos la verdad.
<span class="redacted">████████████████████</span>
Siete éramos. Uno de nosotros no debía existir."

          — R. Olmedo, 1946
        </div>
      </div>
    </div>

    <div class="puzzle-container">
      <div class="puzzle-title"><span class="puzzle-icon">🚪</span>Cerrojo del Armario</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">
        Descifra el mensaje y escribe la palabra oculta. ¿Qué es lo que la familia escondía?
      </p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <input type="text"
               class="game-input"
               id="cipherInput"
               placeholder="_ _ _ _ _ _"
               maxlength="10"
               autocomplete="off"
               onkeyup="if(event.key==='Enter')checkCipherPuzzle()" />
        <button class="action-btn primary-btn" onclick="checkCipherPuzzle()">ABRIR ARMARIO</button>
        <div class="feedback-msg" id="cipherFeedback"></div>
        <div class="attempt-dots" data-dots="cipher2">
          ${Array.from({length:5},()=>'<div class="attempt-dot"></div>').join('')}
        </div>
      </div>
    </div>
  `;
}

function checkCipherPuzzle() {
  checkAnswer('cipherInput', 'cipherFeedback', 'CUARTA', () => {
    addItem('cirio_negro');
    addItem('carta_oculta');
    setTimeout(() => advancePhase(), 1500);
  }, 'cipher2');
}

// ──────────────────────────────────────────────
// FASE 3: CAPILLA PRIVADA
// Puzzle: Ritual de las runas — orden correcto (N,E,S,O → 🔥💧🌿💨)
// ──────────────────────────────────────────────
function renderPhase3() {
  STATE.ritualSlots = ['', '', '', ''];
  const canvas = document.getElementById('gameCanvas');
  canvas.innerHTML = `
    <div class="phase-indicator">
      ${Array.from({length:6}, (_,i) =>
        `<div class="phase-dot ${i < STATE.phase ? 'done' : i === STATE.phase ? 'active' : ''}"></div>`
      ).join('')}
    </div>

    <div class="narrative-panel candle-effect" data-room="CAPILLA PRIVADA · PLANTA BAJA">
      <p class="narrative-text">
        Una capilla personal. Los bancos están volcados. En el altar,
        <em>cuatro símbolos grabados</em> en piedra, con huecos para colocar algo.<br><br>
        En el suelo, cuatro piedras con runas dispersas. En la pared, un texto en latín antiguo
        describe el <span class="disturbing">orden del ritual de los cuatro elementos.</span><br><br>
        La puerta trasera de la capilla lleva al siguiente pasillo. Está sellada con cera negra.
        Completa el ritual y el sello se romperá.
      </p>
    </div>

    <div class="document-card">
      <div class="document-header">INSCRIPCIÓN EN LA PARED · LATÍN ANTIGUO</div>
      <div class="document-body" style="font-style:italic;line-height:2.2;">
"<span class="key-word">Ignis</span> a septentrione incipit,
<span class="key-word">Aqua</span> in oriente sequitur,
<span class="key-word">Terra</span> in meridie ponetur,
<span class="key-word">Ventus</span> in occidente claudit."

— <em>El fuego comienza en el Norte,
el agua le sigue en el Este,
la tierra se pone en el Sur,
el viento cierra en el Oeste.</em>
      </div>
    </div>

    <div class="puzzle-container">
      <div class="puzzle-title"><span class="puzzle-icon">⛧</span>Círculo Ritual</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">
        Arrastra las runas a las posiciones correctas del círculo según el ritual.
      </p>

      <!-- Runas disponibles -->
      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:20px;flex-wrap:wrap;">
        <div class="rune-stone" id="rune_fire" draggable="true" onclick="selectRune('🔥','Fuego')"
          style="padding:10px 16px;border:1px solid #3a2d20;background:#100806;cursor:pointer;font-size:1.4rem;transition:all 0.2s;"
          onmouseover="this.style.borderColor='var(--blood)'" onmouseout="this.style.borderColor='#3a2d20'">
          🔥 <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);vertical-align:middle;">Fuego</span>
        </div>
        <div class="rune-stone" id="rune_water" draggable="true" onclick="selectRune('💧','Agua')"
          style="padding:10px 16px;border:1px solid #3a2d20;background:#060810;cursor:pointer;font-size:1.4rem;transition:all 0.2s;"
          onmouseover="this.style.borderColor='var(--blood)'" onmouseout="this.style.borderColor='#3a2d20'">
          💧 <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);vertical-align:middle;">Agua</span>
        </div>
        <div class="rune-stone" id="rune_earth" draggable="true" onclick="selectRune('🌿','Tierra')"
          style="padding:10px 16px;border:1px solid #3a2d20;background:#060a06;cursor:pointer;font-size:1.4rem;transition:all 0.2s;"
          onmouseover="this.style.borderColor='var(--blood)'" onmouseout="this.style.borderColor='#3a2d20'">
          🌿 <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);vertical-align:middle;">Tierra</span>
        </div>
        <div class="rune-stone" id="rune_wind" draggable="true" onclick="selectRune('💨','Viento')"
          style="padding:10px 16px;border:1px solid #3a2d20;background:#08080a;cursor:pointer;font-size:1.4rem;transition:all 0.2s;"
          onmouseover="this.style.borderColor='var(--blood)'" onmouseout="this.style.borderColor='#3a2d20'">
          💨 <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);vertical-align:middle;">Viento</span>
        </div>
      </div>

      <!-- Círculo de posiciones (N, E, S, O) -->
      <div style="position:relative;width:220px;height:220px;margin:0 auto 20px;">
        <!-- Círculo decorativo -->
        <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.3" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="100" fill="none" stroke="#8b0000" stroke-width="1" stroke-dasharray="4,4"/>
          <circle cx="110" cy="110" r="70" fill="none" stroke="#3a2d20" stroke-width="1"/>
          <line x1="110" y1="10" x2="110" y2="210" stroke="#2a1e14" stroke-width="0.5"/>
          <line x1="10" y1="110" x2="210" y2="110" stroke="#2a1e14" stroke-width="0.5"/>
        </svg>
        <!-- Norte (arriba) = Fuego -->
        <div style="position:absolute;top:5px;left:50%;transform:translateX(-50%);">
          <div id="slot_norte" class="rune-slot" onclick="placeSelectedRune('norte')" style="font-size:1.5rem;">
            ${STATE.ritualSlots[0] || '<span style="color:#2a1e14;font-size:0.8rem;">N</span>'}
          </div>
        </div>
        <!-- Este (derecha) = Agua -->
        <div style="position:absolute;right:5px;top:50%;transform:translateY(-50%);">
          <div id="slot_este" class="rune-slot" onclick="placeSelectedRune('este')" style="font-size:1.5rem;">
            ${STATE.ritualSlots[1] || '<span style="color:#2a1e14;font-size:0.8rem;">E</span>'}
          </div>
        </div>
        <!-- Sur (abajo) = Tierra -->
        <div style="position:absolute;bottom:5px;left:50%;transform:translateX(-50%);">
          <div id="slot_sur" class="rune-slot" onclick="placeSelectedRune('sur')" style="font-size:1.5rem;">
            ${STATE.ritualSlots[2] || '<span style="color:#2a1e14;font-size:0.8rem;">S</span>'}
          </div>
        </div>
        <!-- Oeste (izquierda) = Viento -->
        <div style="position:absolute;left:5px;top:50%;transform:translateY(-50%);">
          <div id="slot_oeste" class="rune-slot" onclick="placeSelectedRune('oeste')" style="font-size:1.5rem;">
            ${STATE.ritualSlots[3] || '<span style="color:#2a1e14;font-size:0.8rem;">O</span>'}
          </div>
        </div>
      </div>

      <p id="selectedRune" style="font-family:var(--font-mono);font-size:0.75rem;color:var(--candle);text-align:center;min-height:20px;"></p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
        <button class="action-btn primary-btn" onclick="checkRitual()">COMPLETAR RITUAL</button>
        <button class="action-btn" onclick="resetRitual()" style="font-size:0.75rem;padding:6px 20px;">Limpiar círculo</button>
        <div class="feedback-msg" id="ritualFeedback"></div>
        <div class="attempt-dots" data-dots="ritual3">
          ${Array.from({length:5},()=>'<div class="attempt-dot"></div>').join('')}
        </div>
      </div>
    </div>
  `;
}

let selectedRune = null;
function selectRune(emoji, name) {
  selectedRune = emoji;
  const el = document.getElementById('selectedRune');
  if (el) el.textContent = `Seleccionado: ${emoji} ${name}`;
  playTone(440, 0.1, 'triangle', 0.04);
}

function placeSelectedRune(position) {
  if (!selectedRune) { giveHint(3, 0); return; }
  const posMap = { norte: 0, este: 1, sur: 2, oeste: 3 };
  const slotId = `slot_${position}`;
  const idx = posMap[position];
  STATE.ritualSlots[idx] = selectedRune;
  const el = document.getElementById(slotId);
  if (el) {
    el.textContent = selectedRune;
    el.classList.add('placed');
  }
  playTone(300 + idx * 80, 0.15, 'sine', 0.05);
  selectedRune = null;
  document.getElementById('selectedRune').textContent = '';
}

function resetRitual() {
  STATE.ritualSlots = ['', '', '', ''];
  renderPhase3();
}

function checkRitual() {
  // Correcto: Norte=🔥, Este=💧, Sur=🌿, Oeste=💨
  const correct = ['🔥', '💧', '🌿', '💨'];
  if (!STATE.attempts['ritual3']) STATE.attempts['ritual3'] = 0;
  STATE.attempts['ritual3']++;

  const isCorrect = STATE.ritualSlots.every((r, i) => r === correct[i]);
  const feedback = document.getElementById('ritualFeedback');
  markAttemptDots('ritual3');

  if (isCorrect) {
    feedback.className = 'feedback-msg success show';
    feedback.textContent = '...el sello de cera se derrite. Un olor a azufre llena la capilla.';
    STATE.solved['ritual3'] = true;
    playUnlock();
    // Efecto visual
    setTimeout(() => {
      addItem('sello_olmedo');
      advancePhase();
    }, 2000);
  } else {
    feedback.className = 'feedback-msg error show';
    feedback.textContent = getErrorMessage(STATE.attempts['ritual3']);
    playWrong();
    if (STATE.attempts['ritual3'] >= 3) triggerHintByFailure(3);
    STATE.score = Math.max(0, STATE.score - 3);
  }
}

// ──────────────────────────────────────────────
// FASE 4: COCINA
// Puzzle: Contar ingredientes en receta → 374
// ──────────────────────────────────────────────
function renderPhase4() {
  const canvas = document.getElementById('gameCanvas');
  canvas.innerHTML = `
    <div class="phase-indicator">
      ${Array.from({length:6}, (_,i) =>
        `<div class="phase-dot ${i < STATE.phase ? 'done' : i === STATE.phase ? 'active' : ''}"></div>`
      ).join('')}
    </div>

    <div class="narrative-panel candle-effect" data-room="COCINA · PLANTA BAJA">
      <p class="narrative-text">
        La cocina huele a algo quemado. Hace décadas que no se cocina aquí, pero
        <em>la hornilla del centro está caliente.</em><br><br>
        Sobre la mesa de madera, un <em>libro de recetas</em> abierto. La página está manchada,
        pero legible. Algo se ha cocido en esta cocina que no era comida.<br><br>
        Una <span class="disturbing">puerta de madera reforzada</span> lleva al sótano.
        Hay una rueda con números. La combinación correcta la guarda la receta.
      </p>
    </div>

    <div class="document-card">
      <div class="document-header">LIBRO DE RECETAS DE ROSARIO OLMEDO · 1945</div>
      <div class="document-body" style="line-height:2.3;">
<span style="color:var(--bone);font-size:1rem;font-family:var(--font-title);">Estofado para los que no duermen</span>

<strong style="color:var(--candle);">Paso 1 — Preparación:</strong>
Agua de pozo (sin tocar luz solar),
huesos de animal (no preguntes cuáles),
sal gruesa de mar.
<em style="color:var(--text-dim);">— 3 ingredientes</em>

<strong style="color:var(--candle);">Paso 2 — El cuerpo:</strong>
Raíz de belladona fresca,
pétalos de rosa negra,
tierra del cementerio viejo,
grasa de vela negra,
hilo rojo sin tejer,
plumas de cuervo (exactamente 7),
una moneda de los muertos.
<em style="color:var(--text-dim);">— 7 ingredientes</em>

<strong style="color:var(--candle);">Paso 3 — El sellado:</strong>
Una gota de sangre del que invoca,
tres vueltas de oración en silencio,
incienso de mirra,
cenizas del nombre.
<em style="color:var(--text-dim);">— 4 ingredientes</em>

<span style="color:var(--text-dim);font-size:0.85rem;font-style:italic;">
"Cocinar siguiendo cada paso en orden.
El número de ingredientes de cada paso, en ese orden,
abre lo que no debe abrirse."
</span>
      </div>
    </div>

    <div class="puzzle-container">
      <div class="puzzle-title"><span class="puzzle-icon">🚪</span>Rueda de Combinación — Puerta al Sótano</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">
        Tres dígitos. El número de ingredientes de cada paso, en orden.
      </p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <input type="text"
               class="game-input"
               id="recipeInput"
               placeholder="_ _ _"
               maxlength="5"
               autocomplete="off"
               onkeyup="if(event.key==='Enter')checkRecipePuzzle()" />
        <button class="action-btn primary-btn" onclick="checkRecipePuzzle()">ABRIR PUERTA</button>
        <div class="feedback-msg" id="recipeFeedback"></div>
        <div class="attempt-dots" data-dots="recipe4">
          ${Array.from({length:5},()=>'<div class="attempt-dot"></div>').join('')}
        </div>
      </div>
    </div>

    ${hasItem('carta_oculta') ? `
    <div class="document-card" style="border-color:rgba(139,0,0,0.4);">
      <div class="document-header">CARTA OCULTA — RELEÍDA</div>
      <div class="document-body" style="font-style:italic;">
"Si lees esto, ya es tarde para mí.
El sótano. El número es el año en que todo terminó.
No te quedes después de medianoche.
<span class='disturbing'>Ella todavía está ahí abajo.</span>"
      </div>
    </div>` : ''}
  `;
}

function checkRecipePuzzle() {
  checkAnswer('recipeInput', 'recipeFeedback', '374', () => {
    addItem('llave_sotano');
    setTimeout(() => advancePhase(), 1500);
  }, 'recipe4');
}

// ──────────────────────────────────────────────
// FASE 5: EL SÓTANO
// Puzzle final: Código 1947 en 4 dígitos
// ──────────────────────────────────────────────
function renderPhase5() {
  STATE.lockDigits = [0, 0, 0, 0];
  const canvas = document.getElementById('gameCanvas');

  // Evento especial: susto narrativo
  setTimeout(() => {
    const overlay = document.getElementById('scareOverlay');
    overlay.classList.add('active');
    document.getElementById('scareText').textContent = 'ELLA TE ESTÁ MIRANDO';
    setTimeout(() => overlay.classList.remove('active'), 2000);
    playTone(80, 1.5, 'sawtooth', 0.08);
  }, 3000);

  canvas.innerHTML = `
    <div class="phase-indicator">
      ${Array.from({length:6}, (_,i) =>
        `<div class="phase-dot ${i < STATE.phase ? 'done' : i === STATE.phase ? 'active' : ''}"></div>`
      ).join('')}
    </div>

    <div class="narrative-panel" data-room="SÓTANO SELLADO · BAJO TIERRA" style="border-left-color:var(--blood-light);animation:none;">
      <p class="narrative-text" style="color:rgba(200,184,154,0.9);">
        Las escaleras bajan hacia una oscuridad total. El único foco de luz eres tú.<br><br>
        El sótano es grande. Mucho más grande de lo que debería ser.<br><br>
        <span class="disturbing">En las paredes hay marcas. Marcas de uñas.</span>
        En el centro, una silla con correas de cuero. La silla mira hacia la pared.<br><br>
        Y en la pared, grabado en la piedra con dedos humanos, una y otra vez:<br>
        <span class="disturbing" style="font-size:1.1rem;letter-spacing:0.1em;">
          SACADME · SACADME · SACADME · SACADME · SACADME
        </span><br><br>
        Al fondo: una <em>puerta de hierro</em>. La salida. Con un panel de 4 dígitos.<br><br>
        Hay algo detrás de ti. No te des la vuelta.
      </p>
    </div>

    <!-- Documentos que ayudan a descifrar 1947 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;">
      <div class="document-card">
        <div class="document-header">TITULARES DE PRENSA · 1947</div>
        <div class="document-body" style="font-size:0.85rem;line-height:1.9;">
<span class="key-word">LA VOZ DEL PUEBLO</span>
12 de noviembre, <span class="key-word">1947</span>

"DESAPARECE FAMILIA OLMEDO
 — SIN RASTRO, SIN EXPLICACIÓN"

Las autoridades cierran el caso.
La mansión, abandonada.
El año: <span class="key-word" style="font-size:1.1rem;">1947</span>.
        </div>
      </div>
      <div class="diary-entry" style="font-size:0.85rem;">
        <div class="diary-date">ÚLTIMA PÁGINA DEL DIARIO</div>
"Esta es mi última nota.
Si alguien la encuentra, escucha:

El código de salida es el año.
El año en que todo terminó.
En que yo terminé.

No olvides: <span class='key-word'>1947</span>.
Escápate. Por favor."

— R.O.
      </div>
    </div>

    <div class="puzzle-container" style="border-color:rgba(139,0,0,0.5);">
      <div class="puzzle-title" style="color:var(--blood-light);"><span class="puzzle-icon">🚪</span>Puerta de Hierro — La Salida</div>
      <p style="font-family:var(--font-body);font-style:italic;color:var(--text-dim);font-size:0.9rem;margin-bottom:16px;">
        El año en que la familia Olmedo desapareció. Cuatro dígitos.
        Sientes pasos detrás de ti. Rápido.
      </p>

      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          ${STATE.lockDigits.map((d,i) =>
            `<div class="lock-digit" id="finalD${i}" onclick="cycleFinalDigit(${i})" style="width:60px;height:80px;font-size:2.2rem;">${d}</div>`
          ).join('')}
        </div>
        <p style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-dim);">← Haz clic para cambiar · Pulsa rápido</p>
        <button class="action-btn primary-btn" onclick="checkFinalCode()" style="border-color:var(--blood-light);color:var(--blood-light);font-size:1rem;padding:14px 40px;">
          ABRIR LA PUERTA
        </button>
        <div class="feedback-msg" id="finalFeedback"></div>
        <div class="attempt-dots" data-dots="final5">
          ${Array.from({length:5},()=>'<div class="attempt-dot"></div>').join('')}
        </div>
      </div>
    </div>
  `;
}

function cycleFinalDigit(index) {
  STATE.lockDigits[index] = (STATE.lockDigits[index] + 1) % 10;
  const el = document.getElementById(`finalD${index}`);
  if (el) el.textContent = STATE.lockDigits[index];
  playTone(300 + index * 50, 0.08, 'triangle', 0.04);
}

function checkFinalCode() {
  const code = STATE.lockDigits.join('');
  if (!STATE.attempts['final5']) STATE.attempts['final5'] = 0;
  STATE.attempts['final5']++;
  const feedback = document.getElementById('finalFeedback');
  markAttemptDots('final5');

  if (code === '1947') {
    STATE.solved['final5'] = true;
    STATE.lockDigits.forEach((_,i) => {
      document.getElementById(`finalD${i}`)?.classList.add('open');
    });
    feedback.className = 'feedback-msg success show';
    feedback.textContent = '...la puerta se abre con un gemido metálico. Aire frío. Libertad.';
    playUnlock();
    setTimeout(() => triggerVictory(), 2500);
  } else {
    feedback.className = 'feedback-msg error show';
    const msgs = [
      'Incorrecto. Algo se mueve en la oscuridad.',
      'No es eso. Los pasos se acercan.',
      'Fallo. La vela se apaga un momento.',
      'Incorrecto. La respiración detrás de ti es más cercana.',
      'ERROR. YA NO HAY TIEMPO.',
    ];
    feedback.textContent = msgs[Math.min(STATE.attempts['final5']-1, msgs.length-1)];
    playWrong();
    if (STATE.attempts['final5'] >= 2) triggerHintByFailure(5);
    STATE.lockDigits.forEach((_,i) => {
      const el = document.getElementById(`finalD${i}`);
      el?.classList.add('locked');
      setTimeout(() => el?.classList.remove('locked'), 500);
    });
    STATE.score = Math.max(0, STATE.score - 5);

    // Susto en el último intento fallido
    if (STATE.attempts['final5'] >= 4) {
      setTimeout(() => {
        const overlay = document.getElementById('scareOverlay');
        overlay.classList.add('active');
        document.getElementById('scareText').textContent = '¡CORRE!';
        setTimeout(() => overlay.classList.remove('active'), 1500);
        playTone(60, 0.8, 'sawtooth', 0.1);
      }, 300);
    }
  }
}

// ──────────────────────────────────────────────
// FIN DEL JUEGO
// ──────────────────────────────────────────────
function triggerVictory() {
  clearInterval(STATE.timerInterval);
  clearInterval(STATE.ambientInterval);

  const elapsed = Math.floor((Date.now() - STATE.startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  // Calcular puntuación final
  let finalScore = STATE.score;
  if (STATE.timerSeconds > 60 * 60) finalScore += 30;      // Bonus tiempo rápido
  else if (STATE.timerSeconds > 30 * 60) finalScore += 15; // Buen tiempo

  const screen = document.getElementById('endgameScreen');
  screen.style.display = 'flex';
  document.getElementById('endTitle').className = 'endgame-title escaped';
  document.getElementById('endTitle').textContent = 'Escapaste';
  document.getElementById('endText').innerHTML = `
    Saliste de la Mansión Olmedo.<br><br>
    Ahora sabes la verdad: Rosario Olmedo fue encerrada por su propia familia.
    La llamaban "la cuarta". Decían que era diferente.<br><br>
    Lo que hizo su padre en ese sótano nunca debería repetirse.<br><br>
    <em style="color:var(--text-dim);">Gracias a ti, al menos alguien lo sabe.</em>
  `;
  document.getElementById('endScore').innerHTML = `
    TIEMPO: ${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')} &nbsp;·&nbsp;
    PUNTUACIÓN: ${finalScore}/100 &nbsp;·&nbsp;
    PISTAS USADAS: ${Object.values(STATE.hintsGiven).reduce((a,b)=>a+b,0)} &nbsp;·&nbsp;
    INTENTOS TOTALES: ${Object.values(STATE.attempts).reduce((a,b)=>a+b,0)}
  `;

  // Guardar en localStorage
  const record = { score: finalScore, time: `${minutes}:${seconds}`, date: new Date().toLocaleDateString() };
  try { localStorage.setItem('olmedo_record', JSON.stringify(record)); } catch(e){}

  playUnlock();
  setTimeout(() => { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f,0.5,'triangle',0.06), i*200)); }, 500);
}

function triggerGameOver(reason) {
  clearInterval(STATE.timerInterval);
  clearInterval(STATE.ambientInterval);

  const screen = document.getElementById('endgameScreen');
  screen.style.display = 'flex';
  document.getElementById('endTitle').className = 'endgame-title died';

  if (reason === 'tiempo') {
    document.getElementById('endTitle').textContent = 'El tiempo se agotó';
    document.getElementById('endText').innerHTML = `
      La oscuridad se cerró sobre ti.<br><br>
      Llevas demasiado tiempo en la Mansión Olmedo.
      Lo sabías desde el principio: no todos los que entran salen.<br><br>
      <em style="color:var(--text-dim);">Ahora formas parte de la casa.</em>
    `;
  }

  document.getElementById('endScore').innerHTML = `
    TIEMPO AGOTADO &nbsp;·&nbsp;
    FASES COMPLETADAS: ${STATE.phase}/${PHASES.length} &nbsp;·&nbsp;
    PUNTUACIÓN: ${STATE.score}/100
  `;

  playTone(100, 3, 'sawtooth', 0.08);
}

// ──────────────────────────────────────────────
// INICIALIZACIÓN
// ──────────────────────────────────────────────
window.addEventListener('load', () => {
  // Añadir estilo de glitch al body
  const style = document.createElement('style');
  style.textContent = `
    .glitch-body { animation: body-glitch 0.3s step-end; }
    @keyframes body-glitch {
      0%   { filter: none; }
      20%  { filter: hue-rotate(90deg) invert(0.1); }
      40%  { filter: none; }
      60%  { filter: hue-rotate(-90deg) saturate(2); }
      80%  { filter: none; }
      100% { filter: none; }
    }
  `;
  document.head.appendChild(style);

  // Iniciar sistemas
  startTimer();
  startAmbience();
  renderPhase0();

  // Mensaje de bienvenida retrasado
  setTimeout(() => {
    showMessage('SISTEMA', 'Conexión activa. Buena suerte... la necesitarás.');
  }, 5000);
});
