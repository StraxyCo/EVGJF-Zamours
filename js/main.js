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
['questionSuccess', 'questionFailure', 'questionSkip', 'finaleSuccess', 'finaleFailure'].forEach(name => {
  sfx[name] = new Audio(`/public/audio/${name}.mp3`);
});

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
    playBg();
    showScreen('screen-generique');
    startGenerique();
  };
}

// ================================================================
// SCREEN: GENERIQUE (00b)
// ================================================================
function startGenerique() {
  const video = document.getElementById('generique-video');
  const btnWrap = document.getElementById('generique-btn-wrap');

  video.currentTime = 0;
  video.onended = () => { btnWrap.style.display = 'flex'; };

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked — show tap-to-play fallback
      document.getElementById('generique-fallback-btn').style.display = 'block';
      document.getElementById('generique-fallback-btn').onclick = () => {
        document.getElementById('generique-fallback-btn').style.display = 'none';
        video.play();
      };
    });
  }

  document.getElementById('btn-generique').onclick = () => {
    launchTitleScreen({
      numero: 'PREMIÈRE MANCHE',
      intitule: 'DAVID RÉPOND AUX QUESTIONS',
      sticker: 'david',
      btnLabel: "C'EST PARTI",
      onNext: () => launchQCMAnswer('david', () => {
        launchTitleScreen({
          numero: 'DEUXIÈME MANCHE',
          intitule: 'JULIETTE RÉPOND AUX QUESTIONS',
          sticker: 'juliette',
          btnLabel: "C'EST PARTI",
          onNext: () => launchQCMAnswer('juliette', () => {
            launchTitleScreen({
              numero: 'TROISIÈME MANCHE',
              intitule: 'JULIETTE DEVINE LES RÉPONSES',
              sticker: 'juliette',
              btnLabel: "C'EST PARTI",
              onNext: () => launchQCMGuess('juliette', 'david', () => {
                showScoreScreen('juliette', 'david', () => {
                  launchTitleScreen({
                    numero: 'QUATRIÈME MANCHE',
                    intitule: 'DAVID DEVINE LES RÉPONSES',
                    sticker: 'david',
                    btnLabel: "C'EST PARTI",
                    onNext: () => launchQCMGuess('david', 'juliette', () => {
                      showScoreScreen('david', 'juliette', () => {
                        launchPhase2();
                      });
                    }),
                  });
                });
              }),
            });
          }),
        });
      }),
    });
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
  if (state.qcm.qIndex >= 3) {
    state.qcm.onComplete();
  } else {
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
    `${gName} a deviné <span class="score-number">${score}/3</span>`;
  document.getElementById('score-line2').textContent =
    `réponses de ${aName} !`;

  document.getElementById('btn-score').onclick = onNext;
  showScreen('screen-score');
}

// ================================================================
// PHASE 2 — LAUNCH
// ================================================================
function launchPhase2() {
  launchTitleScreen({
    numero: 'CINQUIÈME MANCHE',
    intitule: 'JULIETTE EN FINALE',
    sticker: 'juliette',
    btnLabel: "C'EST PARTI",
    onNext: () => launchFinale('juliette'),
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
    renderHearts(participant);
    playSfx('finaleSuccess');
    setTimeout(() => showEndScreen(participant), 800);
    return;
  }
  if (fs.failureCount >= 3) {
    fs.hearts[fs.heartIdx] = 'failure';
    fs.result = 'lost';
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
        onNext: () => launchFinale('david'),
      });
    };
  } else {
    btnEl.textContent = 'FIN DU JEU';
    btnEl.onclick = () => showScreen('screen-splash');
  }

  showScreen('screen-endscreen');
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
