'use strict';

// ================================================================
// DATA
// ================================================================
let Q = null; // questions loaded from JSON

// ================================================================
// GAME STATE
// ================================================================
const state = {
  phase1: {
    davidAnswers: [],    // chosen answer indices for David's 3 QCMs
    julietteAnswers: [], // chosen answer indices for Juliette's 3 QCMs
    julietteScoreVsDavid: 0,
    davidScoreVsJuliette: 0,
  },
  qcm: {
    mode: null,       // 'answer' | 'guess'
    guesser: null,    // 'david' | 'juliette' (who is guessing)
    answerer: null,   // 'david' | 'juliette' (whose questions are shown)
    qIndex: 0,        // 0-2
    selected: null,   // selected answer index
    revealed: false,
    wasChecked: [false, false, false], // track which box was checked (for checkbox on success)
    onComplete: null, // callback when all 3 done
  },
  finale: {
    juliette: newFinaleState(),
    david: newFinaleState(),
  },
};

function newFinaleState() {
  return {
    hearts: new Array(9).fill('idle'),
    heartIdx: 0,
    mainQueue: [],
    passedQueue: [],
    curQIdx: null,
    successCount: 0,
    failureCount: 0,
    result: null,
  };
}

// ================================================================
// AUDIO
// ================================================================
const bgMusic = new Audio('/public/audio/background.mp3');
bgMusic.loop = true;

const sfx = {};
['questionSuccess', 'questionFailure', 'questionSkip', 'finaleSuccess', 'finaleFailure', 'gong'].forEach(name => {
  sfx[name] = new Audio(`/public/audio/${name}.mp3`);
});

// ================================================================
// PERSISTENCE — localStorage
// ================================================================
function saveState(step) {
  try {
    localStorage.setItem('zamours_state', JSON.stringify({
      step,
      phase1: state.phase1,
      qcm: {
        mode:     state.qcm.mode,
        guesser:  state.qcm.guesser,
        answerer: state.qcm.answerer,
        qIndex:   state.qcm.qIndex,
      },
      finale: {
        juliette: { ...state.finale.juliette },
        david:    { ...state.finale.david },
      },
    }));
  } catch(e) {}
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem('zamours_state');
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function hasSavedState()  { return !!loadSavedState(); }
function clearSavedState() { localStorage.removeItem('zamours_state'); }

// ================================================================
// FINALE COUNTDOWN
// ================================================================
let finaleTimerInterval = null;
let finaleTimeLeft      = 60;
let finalePaused        = false;

function startFinaleTimer(participant, fromTime = 60) {
  stopFinaleTimer();
  finaleTimeLeft = fromTime;
  updateTimerDisplay(finaleTimeLeft);

  finaleTimerInterval = setInterval(() => {
    finaleTimeLeft--;
    updateTimerDisplay(finaleTimeLeft);

    if (finaleTimeLeft <= 0) {
      stopFinaleTimer();
      playSfx('gong');
      const fs = state.finale[participant];
      fs.result = 'lost';
      renderHearts(participant);
      setTimeout(() => showEndScreen(participant), 1400);
    }
  }, 1000);
}

function setupPauseButton(participant) {
  finalePaused = false;
  renderPauseButton();
  document.getElementById('btn-finale-pause').onclick = () => {
    finalePaused = !finalePaused;
    const actionIds = ['btn-finale-success', 'btn-finale-failure', 'btn-finale-skip'];
    if (finalePaused) {
      stopFinaleTimer();
      actionIds.forEach(id => { document.getElementById(id).disabled = true; });
    } else {
      actionIds.forEach(id => { document.getElementById(id).disabled = false; });
      startFinaleTimer(participant, finaleTimeLeft);
    }
    renderPauseButton();
  };
}

function renderPauseButton() {
  const btn = document.getElementById('btn-finale-pause');
  if (finalePaused) {
    btn.innerHTML = 'PLAY <span class="btn-icon btn-icon-play"></span>';
  } else {
    btn.innerHTML = 'PAUSE <span class="btn-icon btn-icon-pause"></span>';
  }
}

function stopFinaleTimer() {
  if (finaleTimerInterval) {
    clearInterval(finaleTimerInterval);
    finaleTimerInterval = null;
  }
}

function updateTimerDisplay(timeLeft) {
  const el = document.getElementById('finale-timer');
  el.textContent = timeLeft;
  el.classList.toggle('urgent', timeLeft <= 10);
}

function playBg() { bgMusic.play().catch(() => {}); }
function playSfx(name) {
  const s = sfx[name];
  if (!s) return;
  s.currentTime = 0;
  s.play().catch(() => {});
}

// ================================================================
// SCALE TO VIEWPORT
// ================================================================
function scaleApp() {
  const app = document.getElementById('app');
  const sx = window.innerWidth  / 1920;
  const sy = window.innerHeight / 1080;
  const s  = Math.min(sx, sy);
  app.style.transform = `scale(${s})`;
  app.style.left = `${(window.innerWidth  - 1920 * s) / 2}px`;
  app.style.top  = `${(window.innerHeight - 1080 * s) / 2}px`;
}

// ================================================================
// SCREEN MANAGEMENT
// ================================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ================================================================
// SCREEN: SPLASH (00a)
// ================================================================
function initSplash() {
  document.getElementById('btn-splash').onclick = () => {
    clearSavedState();
    playBg();
    showScreen('screen-generique');
    startGenerique();
  };

  const resumeBtn = document.getElementById('btn-resume');
  if (hasSavedState()) {
    resumeBtn.style.display = 'block';
    resumeBtn.onclick = () => { playBg(); resumeGame(); };
  } else {
    resumeBtn.style.display = 'none';
  }
}

// ================================================================
// SCREEN: GENERIQUE (00b)
// ================================================================
function startGenerique() {
  const video = document.getElementById('generique-video');
  const btnWrap = document.getElementById('generique-btn-wrap');

  video.currentTime = 0;
  video.onended = () => { btnWrap.style.display = 'flex'; };

  // Any click on the generique screen reveals the COMMENCER button
  document.getElementById('screen-generique').onclick = () => {
    btnWrap.style.display = 'flex';
  };

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked — show tap-to-play fallback
      document.getElementById('generique-fallback-btn').style.display = 'block';
      document.getElementById('generique-fallback-btn').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('generique-fallback-btn').style.display = 'none';
        video.play();
      };
    });
  }

  document.getElementById('btn-generique').onclick = (e) => {
    e.stopPropagation();
    video.pause();
    gameStart();
  };
}

// ================================================================
// TEMPLATE 01 — TITLE SCREEN
// ================================================================
function launchTitleScreen({ numero, intitule, sticker, btnLabel, onNext }) {
  document.getElementById('ts-numero').textContent   = numero;
  document.getElementById('ts-intitule').textContent = intitule;

  const stickerSrc = `/public/images/sticker${sticker === 'david' ? 'David' : 'Ju'}.png`;
  document.getElementById('ts-sticker-l').src = stickerSrc;
  document.getElementById('ts-sticker-r').src = stickerSrc;

  document.getElementById('btn-titlescreen').textContent = btnLabel;
  document.getElementById('btn-titlescreen').onclick = onNext;

  showScreen('screen-titlescreen');
}

// ================================================================
// TEMPLATE 02 — QCM (answer mode)
// ================================================================
function launchQCMAnswer(participant, onComplete) {
  state.qcm.mode = 'answer';
  state.qcm.answerer = participant;
  state.qcm.qIndex = 0;
  state.qcm.onComplete = onComplete;
  renderQCM();
}

// ================================================================
// TEMPLATE 02 — QCM (guess mode)
// ================================================================
function launchQCMGuess(guesser, answerer, onComplete) {
  state.qcm.mode = 'guess';
  state.qcm.guesser = guesser;
  state.qcm.answerer = answerer;
  state.qcm.qIndex = 0;
  state.qcm.onComplete = onComplete;
  renderQCM();
}

function renderQCM() {
  const { mode, answerer, qIndex } = state.qcm;
  const question = Q.phase1[answerer][qIndex];

  state.qcm.selected  = null;
  state.qcm.revealed  = false;
  state.qcm.wasChecked = [false, false, false];

  document.getElementById('qcm-numero').textContent = `QUESTION ${qIndex + 1}`;
  document.getElementById('qcm-text').textContent   = question.questionText;

  const boxes = document.querySelectorAll('.qcm-box');
  boxes.forEach((box, i) => {
    box.querySelector('.qcm-answer-text').textContent = question.answers[i];
    setBoxState(box, i, 'idle');
    box.onclick = () => onQCMSelect(i);
  });

  const nextWrap = document.getElementById('qcm-next-wrap');
  nextWrap.style.display = 'none';
  document.getElementById('btn-qcm-next').onclick = onQCMNext;

  showScreen('screen-qcm');
}

function onQCMSelect(idx) {
  const { revealed } = state.qcm;
  if (revealed) return;

  // Reset all to idle, then set selected to checked
  document.querySelectorAll('.qcm-box').forEach((box, i) => {
    setBoxState(box, i, 'idle');
    state.qcm.wasChecked[i] = false;
  });

  const box = document.querySelectorAll('.qcm-box')[idx];
  setBoxState(box, idx, 'checked');
  state.qcm.wasChecked[idx] = true;
  state.qcm.selected = idx;

  document.getElementById('qcm-next-wrap').style.display = 'flex';
}

function onQCMNext() {
  const { mode, answerer, qIndex, selected, revealed } = state.qcm;

  if (mode === 'answer') {
    // Save answer
    state.phase1[`${answerer}Answers`][qIndex] = selected;
    advanceQCM();
    return;
  }

  // Guess mode
  if (!revealed) {
    // First click: reveal result
    state.qcm.revealed = true;
    const guesser  = state.qcm.guesser;
    const correctIdx = state.phase1[`${answerer}Answers`][qIndex];

    const boxes = document.querySelectorAll('.qcm-box');
    if (selected === correctIdx) {
      // Correct guess
      state.phase1[`${guesser}ScoreVs${capitalize(answerer)}`] =
        (state.phase1[`${guesser}ScoreVs${capitalize(answerer)}`] || 0) + 1;
      boxes.forEach((box, i) => {
        if (i === correctIdx) setBoxState(box, i, 'success', state.qcm.wasChecked[i]);
        else                  setBoxState(box, i, 'faded');
      });
    } else {
      // Wrong guess
      boxes.forEach((box, i) => {
        if (i === selected)   setBoxState(box, i, 'error', true);
        else if (i === correctIdx) setBoxState(box, i, 'success', false);
        else                  setBoxState(box, i, 'faded');
      });
    }
    // Button stays as SUIVANT to advance to next question
    return;
  }

  // Second click: advance
  advanceQCM();
}

function advanceQCM() {
  state.qcm.qIndex++;
  if (state.qcm.qIndex >= 5) {
    state.qcm.onComplete();
  } else {
    const step = state.qcm.mode === 'answer'
      ? `qcm-${state.qcm.answerer}-answer`
      : `qcm-${state.qcm.guesser}-guess-${state.qcm.answerer}`;
    saveState(step);
    renderQCM();
  }
}

function setBoxState(box, posIdx, newState, wasChecked = false) {
  // posIdx is 0-based position (0=yellow, 1=purple, 2=cyan)
  box.classList.remove('state-idle', 'state-checked', 'state-success', 'state-error', 'state-faded');
  box.classList.add(`state-${newState}`);

  const checkbox = box.closest('.qcm-box-wrapper').querySelector('.qcm-checkbox');
  const checkIcon = checkbox.querySelector('.qcm-checkbox-icon');

  // Reset box background to position color unless overridden
  const posColors = ['#FFCE30', '#8D30FF', '#30CBFF'];
  box.style.backgroundColor = '';
  box.style.opacity = '';

  if (newState === 'faded') {
    box.style.opacity = '0.5';
    checkbox.style.display = 'none';
  } else if (newState === 'success') {
    box.style.backgroundColor = '#71FF30';
    if (wasChecked) {
      checkbox.style.display = 'flex';
      checkIcon.style.backgroundColor = '#71FF30';
    } else {
      checkbox.style.display = 'none';
    }
  } else if (newState === 'error') {
    box.style.backgroundColor = '#FF3030';
    checkbox.style.display = 'flex';
    checkIcon.style.backgroundColor = '#FF3030';
  } else if (newState === 'checked') {
    box.style.backgroundColor = posColors[posIdx];
    checkbox.style.display = 'flex';
    checkIcon.style.backgroundColor = '#D4AF37'; // YellowMain
  } else {
    // idle
    box.style.backgroundColor = posColors[posIdx];
    checkbox.style.display = 'none';
  }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ================================================================
// SCORE SCREEN
// ================================================================
function showScoreScreen(guesser, answerer, onNext) {
  const scoreKey = `${guesser}ScoreVs${capitalize(answerer)}`;
  const score = state.phase1[scoreKey] || 0;

  const gName = guesser === 'david' ? 'David' : 'Juliette';
  const aName = answerer === 'david' ? 'David' : 'Juliette';

  document.getElementById('score-line1').innerHTML =
    `${gName} a deviné <span class="score-number">${score}/5</span>`;
  document.getElementById('score-line2').textContent =
    `réponses de ${aName} !`;

  document.getElementById('btn-score').onclick = onNext;
  showScreen('screen-score');
}

// ================================================================
// GAME FLOW — named step functions (replaces nested callbacks)
// ================================================================
function gameStart() {
  launchTitleScreen({
    numero: 'PREMIÈRE MANCHE', intitule: 'DAVID RÉPOND AUX QUESTIONS',
    sticker: 'david', btnLabel: "C'EST PARTI",
    onNext: () => { saveState('qcm-david-answer'); launchQCMAnswer('david', afterDavidAnswers); },
  });
}
function afterDavidAnswers() {
  launchTitleScreen({
    numero: 'DEUXIÈME MANCHE', intitule: 'JULIETTE RÉPOND AUX QUESTIONS',
    sticker: 'juliette', btnLabel: "C'EST PARTI",
    onNext: () => { saveState('qcm-juliette-answer'); launchQCMAnswer('juliette', afterJulietteAnswers); },
  });
}
function afterJulietteAnswers() {
  launchTitleScreen({
    numero: 'TROISIÈME MANCHE', intitule: 'JULIETTE DEVINE LES RÉPONSES',
    sticker: 'juliette', btnLabel: "C'EST PARTI",
    onNext: () => { saveState('qcm-juliette-guess-david'); launchQCMGuess('juliette', 'david', afterJulietteGuess); },
  });
}
function afterJulietteGuess() {
  saveState('score-juliette');
  showScoreScreen('juliette', 'david', afterScoreJuliette);
}
function afterScoreJuliette() {
  launchTitleScreen({
    numero: 'QUATRIÈME MANCHE', intitule: 'DAVID DEVINE LES RÉPONSES',
    sticker: 'david', btnLabel: "C'EST PARTI",
    onNext: () => { saveState('qcm-david-guess-juliette'); launchQCMGuess('david', 'juliette', afterDavidGuess); },
  });
}
function afterDavidGuess() {
  saveState('score-david');
  showScoreScreen('david', 'juliette', afterScoreDavid);
}
function afterScoreDavid() { launchPhase2(); }

// ================================================================
// PHASE 2 — LAUNCH
// ================================================================
function launchPhase2() {
  launchTitleScreen({
    numero: 'CINQUIÈME MANCHE',
    intitule: 'JULIETTE EN FINALE',
    sticker: 'juliette',
    btnLabel: "C'EST PARTI",
    onNext: () => { saveState('finale-juliette'); launchFinale('juliette'); },
  });
}

// ================================================================
// TEMPLATE 03 — FINALE
// ================================================================
function launchFinale(participant) {
  const fs = state.finale[participant];
  // Init queue
  fs.hearts = new Array(9).fill('idle');
  fs.hearts[0] = 'current';
  fs.heartIdx = 0;
  fs.mainQueue   = Q.phase2[participant].map((_, i) => i);
  fs.passedQueue = [];
  fs.curQIdx = null;
  fs.successCount = 0;
  fs.failureCount = 0;
  fs.result = null;

  // Wire up action buttons
  document.getElementById('btn-finale-success').onclick = () => finaleAction(participant, 'success');
  document.getElementById('btn-finale-failure').onclick = () => finaleAction(participant, 'failure');
  document.getElementById('btn-finale-skip').onclick    = () => finaleAction(participant, 'skip');

  renderFinale(participant);
  showScreen('screen-finale');
  setupPauseButton(participant);
  startFinaleTimer(participant);
}

function renderFinale(participant) {
  const fs = state.finale[participant];

  // Get next question
  let nextIdx;
  if (fs.mainQueue.length > 0) {
    nextIdx = fs.mainQueue.shift();
  } else {
    nextIdx = fs.passedQueue.shift();
  }
  fs.curQIdx = nextIdx;

  const q = Q.phase2[participant][nextIdx];
  document.getElementById('finale-question').textContent = q.questionLabel;
  document.getElementById('finale-answer').textContent   = q.expectedAnswer;

  renderHearts(participant);
}

function finaleAction(participant, action) {
  const fs = state.finale[participant];
  playSfx(action === 'success' ? 'questionSuccess'
         : action === 'failure' ? 'questionFailure'
         : 'questionSkip');

  if (action === 'skip') {
    fs.passedQueue.push(fs.curQIdx);
    renderFinale(participant);
    saveState(`finale-${participant}`);
    return;
  }

  // success or failure — advance heart
  fs.hearts[fs.heartIdx] = action === 'success' ? 'success' : 'failure';
  if (action === 'success') fs.successCount++;
  else                      fs.failureCount++;

  // Check win/lose
  if (fs.successCount >= 7) {
    fs.hearts[fs.heartIdx] = 'success';
    fs.result = 'won';
    stopFinaleTimer();
    finalePaused = false;
    renderHearts(participant);
    playSfx('finaleSuccess');
    setTimeout(() => showEndScreen(participant), 800);
    return;
  }
  if (fs.failureCount >= 3) {
    fs.hearts[fs.heartIdx] = 'failure';
    fs.result = 'lost';
    stopFinaleTimer();
    finalePaused = false;
    renderHearts(participant);
    playSfx('finaleFailure');
    setTimeout(() => showEndScreen(participant), 800);
    return;
  }

  // Advance to next heart
  fs.heartIdx++;
  fs.hearts[fs.heartIdx] = 'current';
  renderHearts(participant);
  renderFinale(participant);
  saveState(`finale-${participant}`);
}

function renderHearts(participant) {
  const fs = state.finale[participant];
  // Hearts are in 3 columns: col0=[0,1,2], col1=[3,4,5], col2=[6,7,8]
  [0, 1, 2].forEach(col => {
    const colEl = document.getElementById(`hearts-col-${col}`);
    const icons = colEl.querySelectorAll('.heart-icon');
    icons.forEach((icon, row) => {
      const heartIdx = col * 3 + row;
      icon.className = `heart-icon state-${fs.hearts[heartIdx]}`;
    });
  });
}

// ================================================================
// TEMPLATE 04 — END SCREEN
// ================================================================
function showEndScreen(participant) {
  const fs = state.finale[participant];
  const name = participant === 'david' ? 'David' : 'Juliette';
  const won  = fs.result === 'won';

  document.getElementById('end-label').textContent = won ? "C'EST GAGNÉ !" : "C'EST PERDU !";

  const stickerSrc = `/public/images/sticker${name === 'David' ? 'David' : 'Ju'}.png`;
  document.getElementById('end-sticker-l').src = stickerSrc;
  document.getElementById('end-sticker-r').src = stickerSrc;

  const btnEl = document.getElementById('btn-endscreen');

  if (participant === 'juliette') {
    btnEl.textContent = 'SUIVANT';
    btnEl.onclick = () => {
      launchTitleScreen({
        numero: 'SIXIÈME MANCHE',
        intitule: 'DAVID EN FINALE',
        sticker: 'david',
        btnLabel: "C'EST PARTI",
        onNext: () => { saveState('finale-david'); launchFinale('david'); },
      });
    };
  } else {
    btnEl.textContent = 'FIN DU JEU';
    btnEl.onclick = () => {
      clearSavedState();
      showScreen('screen-splash');
      initSplash();
    };
  }

  showScreen('screen-endscreen');
}

// ================================================================
// RESUME FROM SAVE
// ================================================================
function resumeGame() {
  const save = loadSavedState();
  if (!save) { showScreen('screen-splash'); return; }

  Object.assign(state.phase1, save.phase1 || {});

  if (save.qcm) {
    state.qcm.mode      = save.qcm.mode;
    state.qcm.guesser   = save.qcm.guesser;
    state.qcm.answerer  = save.qcm.answerer;
    state.qcm.qIndex    = save.qcm.qIndex || 0;
    state.qcm.selected  = null;
    state.qcm.revealed  = false;
    state.qcm.wasChecked = [false, false, false];
  }

  if (save.finale) {
    ['juliette', 'david'].forEach(p => {
      const fs = save.finale[p];
      if (!fs) return;
      // Put the currently-displayed question back at the head of the queue
      if (fs.curQIdx !== null && fs.curQIdx !== undefined) {
        fs.mainQueue.unshift(fs.curQIdx);
        fs.curQIdx = null;
      }
      Object.assign(state.finale[p], fs);
    });
  }

  const onCompleteMap = {
    'qcm-david-answer':         afterDavidAnswers,
    'qcm-juliette-answer':      afterJulietteAnswers,
    'qcm-juliette-guess-david': afterJulietteGuess,
    'qcm-david-guess-juliette': afterDavidGuess,
  };

  const step = save.step;

  if (onCompleteMap[step]) {
    state.qcm.onComplete = onCompleteMap[step];
    renderQCM();
  } else if (step === 'score-juliette') {
    showScoreScreen('juliette', 'david', afterScoreJuliette);
  } else if (step === 'score-david') {
    showScoreScreen('david', 'juliette', afterScoreDavid);
  } else if (step === 'finale-juliette') {
    restoreFinale('juliette');
  } else if (step === 'end-juliette') {
    showEndScreen('juliette');
  } else if (step === 'finale-david') {
    restoreFinale('david');
  } else if (step === 'end-david') {
    showEndScreen('david');
  } else {
    clearSavedState();
    showScreen('screen-splash');
  }
}

function restoreFinale(participant) {
  document.getElementById('btn-finale-success').onclick = () => finaleAction(participant, 'success');
  document.getElementById('btn-finale-failure').onclick = () => finaleAction(participant, 'failure');
  document.getElementById('btn-finale-skip').onclick    = () => finaleAction(participant, 'skip');
  renderHearts(participant);
  renderFinale(participant);
  showScreen('screen-finale');
  setupPauseButton(participant);
  startFinaleTimer(participant);
}

// ================================================================
// INIT
// ================================================================
async function init() {
  window.addEventListener('resize', scaleApp);
  scaleApp();

  try {
    const res = await fetch('/public/data/questions.json');
    Q = await res.json();
  } catch (e) {
    console.error('Failed to load questions.json', e);
  }

  initSplash();
  showScreen('screen-splash');
}

document.addEventListener('DOMContentLoaded', init);
