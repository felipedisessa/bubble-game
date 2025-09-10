'use strict';

// ===== Seletores =====
const gameEl = document.getElementById('game');
const timeEl = document.getElementById('time');
const scoreEl = document.getElementById('score');
const startOverlay = document.getElementById('startOverlay');
const countOverlay = document.getElementById('countOverlay');
const endOverlay = document.getElementById('endOverlay');
const countNum = document.getElementById('countNum');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const finalScoreEl = document.getElementById('finalScore');
const highscoreTxt = document.getElementById('highscoreTxt');
const goalFill = document.getElementById('goalFill');
const goalKnob = document.getElementById('goalKnob');
const goalCountEl = document.getElementById('goalCount');
const goalTotalEl = document.getElementById('goalTotal');
const endTitle = document.querySelector('#endOverlay h2');

const GOAL = 110;

// ===== Helpers de visibilidade robustos =====
const show = (el) => { el.hidden = false; el.setAttribute('aria-hidden', 'false'); };
const hide = (el) => { el.hidden = true; el.setAttribute('aria-hidden', 'true'); };

// ===== Constantes de jogo =====
const DURATION_MS = 35_000;
const MAX_ACTIVE_BUBBLES = 40;
const MIN_SIZE = 56;
const MAX_SIZE = 130;

// ↓ Deixe a subida mais rápida
const MIN_RISE = 3.0;  // antes: 5.5s
const MAX_RISE = 6.0;

// ===== Estado =====
let rafId = 0, running = false, deadlineAt = 0, score = 0;
let spawnAccumulator = 0, lastTs = 0, countdownId = 0;
const bubbles = new Set(); // rastrear bolhas ativas

// ===== Utilitários =====
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const fmtSec = (msLeft) => Math.ceil(msLeft / 1000);

const getHighscore = () => { try { return Number(localStorage.getItem('bubble_highscore') || 0) || 0; } catch { return 0; } };
const setHighscore = (v) => { try { localStorage.setItem('bubble_highscore', String(v)); } catch {} };

// ===== Lógica de Spawn =====
const desiredSpawnDelay = (elapsedMs) => {
  const t = clamp(elapsedMs / DURATION_MS, 0, 1);
  return lerp(420, 170, t); // de ~420ms para ~170ms
};

function spawnBubble() {
  if (bubbles.size >= MAX_ACTIVE_BUBBLES) return;
  const size = Math.round(rand(MIN_SIZE, MAX_SIZE));
  const rise = rand(MIN_RISE, MAX_RISE); // segundos

  const b = document.createElement('div');
  b.className = 'bubble';
  b.setAttribute('role', 'button');
  b.setAttribute('aria-label', 'Bolha');
  b.style.width = b.style.height = size + 'px';
  b.style.left = Math.round(rand(0, gameEl.clientWidth - size)) + 'px';
  b.style.bottom = (-size - 10) + 'px';
  b.style.setProperty('--rise', rise + 's');

  const onEnd = () => {
    b.removeEventListener('animationend', onEnd);
    if (b.parentNode) b.parentNode.removeChild(b);
    bubbles.delete(b);
  };
  b.addEventListener('animationend', onEnd, { once: true });

  bubbles.add(b);
  gameEl.appendChild(b);
}

function popBubble(el) {
  if (!el || el.classList.contains('popped')) return;
  el.classList.add('popped');
  el.style.pointerEvents = 'none';
  if (navigator.vibrate) { try { navigator.vibrate(10); } catch {} }
  el.addEventListener('animationend', () => {
    if (el.parentNode) el.parentNode.removeChild(el);
    bubbles.delete(el);
  }, { once: true });
}
function updateProgress() {
  const p = Math.min(score / GOAL, 1); // 0..1
  // anima a largura da barra
  goalFill.style.transform = `scaleX(${p})`;
  // posiciona o "knob" na ponta da barra
  goalKnob.style.left = `${p * 100}%`;
  // contador visível
  goalCountEl.textContent = String(score);
}

// ===== Loop Principal =====
function loop(ts) {
  if (!running) return;
  if (!lastTs) lastTs = ts;
  const dt = ts - lastTs; // ms
  lastTs = ts;

  const now = performance.now();
  const left = clamp(deadlineAt - now, 0, DURATION_MS);
  const elapsed = DURATION_MS - left;
  timeEl.textContent = fmtSec(left);

  // Spawner progressivo
  spawnAccumulator += dt;
  const needDelay = desiredSpawnDelay(elapsed);
  while (spawnAccumulator >= needDelay) {
    spawnAccumulator -= needDelay;
    spawnBubble();
  }

  if (left <= 0) { endGame(); return; }
  rafId = requestAnimationFrame(loop);
}

// ===== Contagem 3-2-1 =====
function countdownThenStart() {
  hide(startOverlay); hide(endOverlay);
  show(countOverlay);
  const steps = ['3','2','1','Go!'];
  let i = 0;
  countNum.textContent = steps[i];
  clearInterval(countdownId);
  countdownId = setInterval(() => {
    i++;
    if (i < steps.length) {
      countNum.textContent = steps[i];
    } else {
      clearInterval(countdownId);
      hide(countOverlay);
      startGame();
    }
  }, 700);
}

// ===== Controle de jogo =====
function startGame() {
  // limpar estado
  bubbles.forEach(b => b.remove());
  bubbles.clear();
  score = 0; scoreEl.textContent = '0';
  spawnAccumulator = 0; lastTs = 0;

  deadlineAt = performance.now() + DURATION_MS;
  running = true;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

    goalTotalEl.textContent = String(GOAL);
  score = 0;
  scoreEl.textContent = '0';
  updateProgress(); // zera barra
}

function endGame() {
  running = false;
  cancelAnimationFrame(rafId);
  bubbles.forEach(b => { if (b.isConnected) b.remove(); });
  bubbles.clear();

  finalScoreEl.textContent = String(score);

  const hs = getHighscore();
  if (score > hs) { setHighscore(score); }
  const best = Math.max(score, hs);
  highscoreTxt.textContent = `Recorde: ${best}`;

  if (score >= GOAL) {
    endTitle.textContent = "Parabéns! Você atingiu a meta! 🎉";
  } else {
    endTitle.textContent = "Tempo esgotado! Tente novamente...";
  }

  show(endOverlay);
}

// ===== Eventos =====
startBtn.addEventListener('click', countdownThenStart, { passive: true });
restartBtn.addEventListener('click', countdownThenStart, { passive: true });

// Multitouch (Pointer Events) com delegação
gameEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const t = e.target;
  if (t && t.classList && t.classList.contains('bubble')) {
    if (running) {
      score++;
      scoreEl.textContent = String(score);
       updateProgress();
    }
    popBubble(t);
  }
}, { passive: false });

// Segurança: se a aba perder foco, não penaliza o tempo
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) {
    const now = performance.now();
    const left = Math.max(0, deadlineAt - now);
    deadlineAt = Infinity; // congela
    const onBack = () => {
      deadlineAt = performance.now() + left;
      document.removeEventListener('visibilitychange', onBackOnce);
    };
    const onBackOnce = () => { if (!document.hidden) onBack(); };
    document.addEventListener('visibilitychange', onBackOnce, { once: true });
  }
}, { passive: true });

// Exibir highscore na tela inicial se existir
const hsInit = getHighscore();
if (hsInit > 0) {
  const hint = document.createElement('div');
  hint.className = 'foot';
  hint.textContent = `Recorde atual neste dispositivo: ${hsInit}`;
  startOverlay.querySelector('.card').appendChild(hint);
}
