'use strict';

// ================================================================
// DATA
// ================================================================
let Q = null;

// ================================================================
// STATE
// ================================================================
const state = {
  phase1: {
    davidAnswers: [],
    julietteAnswers: [],
    julietteScoreVsDavid: 0,
    davidScoreVsJuliette: 0,
  },
  qcm: {
    mode: null, guesser: null, answerer: null,
    qIndex: 0, selected: null, revealed: false,
    wasChecked: [false, false, false], onComplete: null,
  },
  finale: {
    juliette: newFinaleState(),
    david:    newFinaleState(),
  },
};

function newFinaleState() {
  return { questionIdx: 0, successCount: 0, failureCount: 0,
           hearts: new Array(15).fill('idle'), result: null };
}

// ================================================================
// AUDIO
// ================================================================
const sfx = {};
['questionSuccess','questionFailure','questionSkip','finaleSuccess','finaleFailure','gong','questionPause'].forEach(name => {
  sfx[name] = new Audio(`/public/audio/${name}.mp3`);
});

const countdownMusic = new Audio('/public/audio/countdown.mp3');
countdownMusic.loop = true;

function startCountdown()  { countdownMusic.currentTime = 0; countdownMusic.play().catch(() => {}); }
function stopCountdown()   { countdownMusic.pause(); countdownMusic.currentTime = 0; }

function playSfx(name) {
  const s = sfx[name]; if (!s) return;
  s.currentTime = 0; s.play().catch(() => {});
}

// ================================================================
// PER-QUESTION TIMER (10s)
// ================================================================
let questionTimerInterval = null;
let questionTimeLeft = 10;

function startQuestionTimer(participant) {
  stopQuestionTimer();
  questionTimeLeft = 10;
  updateTimerDisplay(questionTimeLeft);
  questionTimerInterval = setInterval(() => {
    questionTimeLeft--;
    updateTimerDisplay(questionTimeLeft);
    if (questionTimeLeft <= 0) {
      stopQuestionTimer();
      playSfx('gong');
      finaleAction(participant, 'failure');
    }
  }, 1000);
}

function stopQuestionTimer() {
  if (questionTimerInterval) { clearInterval(questionTimerInterval); questionTimerInterval = null; }
}

function updateTimerDisplay(t) {
  const el = document.getElementById('finale-timer');
  if (!el) return;
  el.textContent = t;
  el.classList.toggle('urgent', t <= 3);
}

// ================================================================
// PERSISTENCE
// ================================================================
function saveState(step) {
  try {
    localStorage.setItem('zamours_state', JSON.stringify({
      step,
      phase1: state.phase1,
      qcm: { mode: state.qcm.mode, guesser: state.qcm.guesser,
             answerer: state.qcm.answerer, qIndex: state.qcm.qIndex },
      finale: { juliette: { ...state.finale.juliette },
                david:    { ...state.finale.david } },
    }));
  } catch(e) {}
}

function loadSavedState() {
  try { const r = localStorage.getItem('zamours_state'); return r ? JSON.parse(r) : null; }
  catch(e) { return null; }
}
function hasSavedState()   { return !!loadSavedState(); }
function clearSavedState() { localStorage.removeItem('zamours_state'); }

// ================================================================
// SCALE
// ================================================================
function scaleApp() {
  const app = document.getElementById('app');
  const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  app.style.transform = `scale(${s})`;
  app.style.left = `${(window.innerWidth  - 1920 * s) / 2}px`;
  app.style.top  = `${(window.innerHeight - 1080 * s) / 2}px`;
}

// ================================================================
// SCREENS
// ================================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ================================================================
// SPLASH
// ================================================================
function initSplash() {
  document.getElementById('btn-splash').onclick = () => {
    clearSavedState();
    showScreen('screen-generique');
    startGenerique();
  };
  const resumeBtn = document.getElementById('btn-resume');
  if (hasSavedState()) {
    resumeBtn.style.display = 'block';
    resumeBtn.onclick = () => resumeGame();
  } else {
    resumeBtn.style.display = 'none';
  }
}

// ================================================================
// GENERIQUE
// ================================================================
function startGenerique() {
  const video   = document.getElementById('generique-video');
  const btnWrap = document.getElementById('generique-btn-wrap');
  video.currentTime = 0;
  video.onended = () => { btnWrap.style.display = 'flex'; };

  document.getElementById('screen-generique').onclick = () => { btnWrap.style.display = 'flex'; };

  const p = video.play();
  if (p !== undefined) {
    p.catch(() => {
      const fb = document.getElementById('generique-fallback-btn');
      fb.style.display = 'block';
      fb.onclick = (e) => { e.stopPropagation(); fb.style.display = 'none'; video.play(); };
    });
  }

  document.getElementById('btn-generique').onclick = (e) => {
    e.stopPropagation();
    video.pause();
    gameStart();
  };
}

// ================================================================
// TITLE SCREEN
// ================================================================
function launchTitleScreen({ numero, intitule, sticker, btnLabel, onNext }) {
  document.getElementById('ts-numero').textContent   = numero;
  document.getElementById('ts-intitule').textContent = intitule;
  const src = `/public/images/sticker${sticker === 'david' ? 'David' : 'Ju'}.png`;
  document.getElementById('ts-sticker-l').src = src;
  document.getElementById('ts-sticker-r').src = src;
  document.getElementById('btn-titlescreen').textContent = btnLabel;
  document.getElementById('btn-titlescreen').onclick = onNext;
  showScreen('screen-titlescreen');
}

// ================================================================
// RULES SCREEN
// ================================================================
function showRulesScreen({ minorText, majorText, btnLabel, onNext }) {
  const minorEl = document.getElementById('rules-minor');
  minorEl.textContent = minorText || '';
  minorEl.style.display = minorText ? 'block' : 'none';
  document.getElementById('rules-major').textContent = majorText || '';
  document.getElementById('btn-rules').textContent   = btnLabel || "C'EST PARTI";
  document.getElementById('btn-rules').onclick = onNext;
  showScreen('screen-rules');
}

// ================================================================
// QCM — answer mode
// ================================================================
function launchQCMAnswer(participant, onComplete) {
  state.qcm.mode = 'answer'; state.qcm.answerer = participant;
  state.qcm.qIndex = 0; state.qcm.onComplete = onComplete;
  renderQCM();
}

// ================================================================
// QCM — guess mode
// ================================================================
function launchQCMGuess(guesser, answerer, onComplete) {
  state.qcm.mode = 'guess'; state.qcm.guesser = guesser;
  state.qcm.answerer = answerer; state.qcm.qIndex = 0;
  state.qcm.onComplete = onComplete; renderQCM();
}

function renderQCM() {
  const { answerer, qIndex } = state.qcm;
  const q = Q.phase1[answerer][qIndex];
  state.qcm.selected = null; state.qcm.revealed = false;
  state.qcm.wasChecked = [false, false, false];
  document.getElementById('qcm-numero').textContent = `QUESTION ${qIndex + 1}`;
  document.getElementById('qcm-text').textContent   = q.questionText;
  document.querySelectorAll('.qcm-box').forEach((box, i) => {
    box.querySelector('.qcm-answer-text').textContent = q.answers[i];
    setBoxState(box, i, 'idle');
    box.onclick = () => onQCMSelect(i);
  });
  document.getElementById('qcm-next-wrap').style.display = 'none';
  document.getElementById('btn-qcm-next').onclick = onQCMNext;
  showScreen('screen-qcm');
}

function onQCMSelect(idx) {
  if (state.qcm.revealed) return;
  document.querySelectorAll('.qcm-box').forEach((box, i) => {
    setBoxState(box, i, 'idle'); state.qcm.wasChecked[i] = false;
  });
  setBoxState(document.querySelectorAll('.qcm-box')[idx], idx, 'checked');
  state.qcm.wasChecked[idx] = true; state.qcm.selected = idx;
  document.getElementById('qcm-next-wrap').style.display = 'flex';
}

function onQCMNext() {
  const { mode, answerer, qIndex, selected, revealed } = state.qcm;
  if (mode === 'answer') {
    state.phase1[`${answerer}Answers`][qIndex] = selected;
    advanceQCM(); return;
  }
  if (!revealed) {
    state.qcm.revealed = true;
    const guesser    = state.qcm.guesser;
    const correctIdx = state.phase1[`${answerer}Answers`][qIndex];
    const boxes = document.querySelectorAll('.qcm-box');
    if (selected === correctIdx) {
      state.phase1[`${guesser}ScoreVs${capitalize(answerer)}`] =
        (state.phase1[`${guesser}ScoreVs${capitalize(answerer)}`] || 0) + 1;
      boxes.forEach((box, i) => {
        if (i === correctIdx) setBoxState(box, i, 'success', state.qcm.wasChecked[i]);
        else                  setBoxState(box, i, 'faded');
      });
    } else {
      boxes.forEach((box, i) => {
        if (i === selected)        setBoxState(box, i, 'error', true);
        else if (i === correctIdx) setBoxState(box, i, 'success', false);
        else                       setBoxState(box, i, 'faded');
      });
    }
    return;
  }
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
  box.classList.remove('state-idle','state-checked','state-success','state-error','state-faded');
  box.classList.add(`state-${newState}`);
  const checkbox  = box.closest('.qcm-box-wrapper').querySelector('.qcm-checkbox');
  const checkIcon = checkbox.querySelector('.qcm-checkbox-icon');
  const posColors = ['#FFCE30','#8D30FF','#30CBFF'];
  box.style.backgroundColor = ''; box.style.opacity = '';
  if (newState === 'faded') {
    box.style.opacity = '0.5'; checkbox.style.display = 'none';
  } else if (newState === 'success') {
    box.style.backgroundColor = '#71FF30';
    if (wasChecked) { checkbox.style.display = 'flex'; checkIcon.style.backgroundColor = '#71FF30'; }
    else            { checkbox.style.display = 'none'; }
  } else if (newState === 'error') {
    box.style.backgroundColor = '#FF3030';
    checkbox.style.display = 'flex'; checkIcon.style.backgroundColor = '#FF3030';
  } else if (newState === 'checked') {
    box.style.backgroundColor = posColors[posIdx];
    checkbox.style.display = 'flex'; checkIcon.style.backgroundColor = '#D4AF37';
  } else {
    box.style.backgroundColor = posColors[posIdx]; checkbox.style.display = 'none';
  }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ================================================================
// COMBINED QCM SCORE SCREEN
// ================================================================
function showCombinedQCMScore(onNext) {
  const dScore = state.phase1.davidScoreVsJuliette  || 0;
  const jScore = state.phase1.julietteScoreVsDavid  || 0;
  document.getElementById('qcm-score-david-val').textContent    = dScore;
  document.getElementById('qcm-score-juliette-val').textContent = jScore;

  const dCard = document.getElementById('qcm-score-david-card');
  const jCard = document.getElementById('qcm-score-juliette-card');
  const dBadge = document.getElementById('qcm-score-david-leader');
  const jBadge = document.getElementById('qcm-score-juliette-leader');
  dCard.classList.remove('score-card--winner'); jCard.classList.remove('score-card--winner');
  dBadge.style.display = 'none'; jBadge.style.display = 'none';
  if (dScore > jScore) { dCard.classList.add('score-card--winner'); dBadge.style.display = 'block'; }
  if (jScore > dScore) { jCard.classList.add('score-card--winner'); jBadge.style.display = 'block'; }

  document.getElementById('btn-qcm-score-next').onclick = onNext;
  showScreen('screen-qcm-score');
}

// ================================================================
// GAME FLOW
// ================================================================
function gameStart() {
  showRulesScreen({
    minorText: null,
    majorText: 'Pariez : Qui sera le grand vainqueur de Zamours ?',
    btnLabel:  'LANCER LA PREMIÈRE MANCHE',
    onNext: () => showRulesScreen({
      minorText: "David & Ju vont répondre tour à tour à des questions — ensuite ils essayeront de deviner les réponses que l'autre a donné.",
      majorText: 'Écoutez bien ! Après le tour des premières réponses, vous allez pouvoir parier à nouveau !',
      btnLabel:  "C'EST PARTI",
      onNext: () => launchTitleScreen({
        numero: 'PREMIÈRE MANCHE', intitule: 'DAVID RÉPOND AUX QUESTIONS',
        sticker: 'david', btnLabel: "C'EST PARTI",
        onNext: () => { saveState('qcm-david-answer'); launchQCMAnswer('david', afterDavidAnswers); },
      }),
    }),
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
  showRulesScreen({
    minorText: "David & Ju vont essayer de deviner ce que l'autre a répondu.",
    majorText: 'Pariez ! Combien de bonnes réponses va donner Juliette ? Si vous avez tort, vous buvez !',
    btnLabel:  "C'EST PARTI",
    onNext: () => launchTitleScreen({
      numero: 'TROISIÈME MANCHE', intitule: 'JULIETTE DEVINE LES RÉPONSES',
      sticker: 'juliette', btnLabel: "C'EST PARTI",
      onNext: () => { saveState('qcm-juliette-guess-david'); launchQCMGuess('juliette', 'david', afterJulietteGuess); },
    }),
  });
}

function afterJulietteGuess() {
  showRulesScreen({
    minorText: null,
    majorText: 'Pariez : combien de bonnes réponses va donner David ? Si vous avez tort, vous buvez !',
    btnLabel:  "C'EST PARTI",
    onNext: () => launchTitleScreen({
      numero: 'QUATRIÈME MANCHE', intitule: 'DAVID DEVINE LES RÉPONSES',
      sticker: 'david', btnLabel: "C'EST PARTI",
      onNext: () => { saveState('qcm-david-guess-juliette'); launchQCMGuess('david', 'juliette', afterDavidGuess); },
    }),
  });
}

function afterDavidGuess() {
  saveState('score-combined');
  showCombinedQCMScore(launchPhase2);
}

function launchPhase2() {
  showRulesScreen({
    minorText: "David & Juliette vont répondre à 15 questions pour savoir s'ils se connaissent vraiment.",
    majorText: 'Pariez sur le score de Juliette (de 1 à 20). Si vous avez tort, vous buvez !',
    btnLabel:  "C'EST PARTI",
    onNext: () => launchTitleScreen({
      numero: 'CINQUIÈME MANCHE', intitule: 'JULIETTE EN FINALE',
      sticker: 'juliette', btnLabel: "C'EST PARTI",
      onNext: () => { saveState('finale-juliette'); launchFinale('juliette'); },
    }),
  });
}

function launchDavidFinale() {
  showRulesScreen({
    minorText: null,
    majorText: 'Pariez sur le score de David (de 1 à 15). Si vous avez tort, vous buvez !',
    btnLabel:  "C'EST PARTI",
    onNext: () => launchTitleScreen({
      numero: 'SIXIÈME MANCHE', intitule: 'DAVID EN FINALE',
      sticker: 'david', btnLabel: "C'EST PARTI",
      onNext: () => { saveState('finale-david'); launchFinale('david'); },
    }),
  });
}

// ================================================================
// FINALE
// ================================================================
function launchFinale(participant) {
  const fs = state.finale[participant];
  fs.hearts       = new Array(15).fill('idle');
  fs.questionIdx  = 0;
  fs.successCount = 0;
  fs.failureCount = 0;
  fs.result       = null;
  initFinaleButtons(participant);
  renderFinaleQuestion(participant);
  showScreen('screen-finale');
  startCountdown();
  startQuestionTimer(participant);
}

function initFinaleButtons(participant) {
  document.getElementById('btn-finale-success').disabled = false;
  document.getElementById('btn-finale-failure').disabled = false;
  document.getElementById('btn-finale-next').style.display = 'none';
  document.getElementById('btn-finale-success').onclick = () => finaleAction(participant, 'success');
  document.getElementById('btn-finale-failure').onclick = () => finaleAction(participant, 'failure');
  document.getElementById('btn-finale-next').onclick    = () => advanceFinaleQuestion(participant);
}

function renderFinaleQuestion(participant) {
  const fs = state.finale[participant];
  const q  = Q.phase2[participant][fs.questionIdx];
  document.getElementById('finale-question').textContent = q.questionLabel;
  document.getElementById('finale-answer').textContent   = q.expectedAnswer;
  document.getElementById('finale-counter').textContent  = `${fs.questionIdx + 1} / 15`;
  renderHearts(participant);
}

function finaleAction(participant, action) {
  stopQuestionTimer();
  const fs = state.finale[participant];
  if (action === 'success') {
    fs.successCount++; fs.hearts[fs.questionIdx] = 'success'; playSfx('questionSuccess');
  } else {
    fs.failureCount++; fs.hearts[fs.questionIdx] = 'failure'; playSfx('questionFailure');
  }
  renderHearts(participant);
  document.getElementById('btn-finale-success').disabled = true;
  document.getElementById('btn-finale-failure').disabled = true;
  const nextBtn = document.getElementById('btn-finale-next');
  nextBtn.textContent = fs.questionIdx >= 14 ? 'VOIR LES RÉSULTATS' : 'QUESTION SUIVANTE';
  nextBtn.style.display = 'flex';
  saveState(`finale-${participant}`);
}

function advanceFinaleQuestion(participant) {
  const fs = state.finale[participant];
  document.getElementById('btn-finale-next').style.display = 'none';
  document.getElementById('btn-finale-success').disabled = false;
  document.getElementById('btn-finale-failure').disabled = false;
  fs.questionIdx++;
  if (fs.questionIdx >= 15) {
    stopCountdown();
    afterFinale(participant);
    return;
  }
  renderFinaleQuestion(participant);
  startQuestionTimer(participant);
}

function afterFinale(participant) {
  if (participant === 'juliette') {
    saveState('end-juliette');
    launchDavidFinale();
  } else {
    saveState('end-david');
    showFinalScoreScreen();
  }
}

function renderHearts(participant) {
  const fs = state.finale[participant];
  [0, 1, 2].forEach(col => {
    const colEl = document.getElementById(`hearts-col-${col}`);
    colEl.querySelectorAll('.heart-icon').forEach((icon, row) => {
      icon.className = `heart-icon state-${fs.hearts[col * 5 + row] || 'idle'}`;
    });
  });
}

// ================================================================
// FINAL SCORE SCREEN
// ================================================================
function showFinalScoreScreen() {
  const dQCM   = state.phase1.davidScoreVsJuliette  || 0;
  const jQCM   = state.phase1.julietteScoreVsDavid  || 0;
  const dFin   = state.finale.david.successCount    || 0;
  const jFin   = state.finale.juliette.successCount || 0;
  const dTotal = dQCM + dFin;
  const jTotal = jQCM + jFin;

  document.getElementById('final-david-qcm').textContent       = dQCM;
  document.getElementById('final-juliette-qcm').textContent    = jQCM;
  document.getElementById('final-david-finale').textContent    = dFin;
  document.getElementById('final-juliette-finale').textContent = jFin;
  document.getElementById('final-david-total').textContent     = dTotal;
  document.getElementById('final-juliette-total').textContent  = jTotal;

  const dCard = document.getElementById('final-david-card');
  const jCard = document.getElementById('final-juliette-card');
  const dBadge = document.getElementById('final-david-leader');
  const jBadge = document.getElementById('final-juliette-leader');
  dCard.classList.remove('score-card--winner'); jCard.classList.remove('score-card--winner');
  dBadge.style.display = 'none'; jBadge.style.display = 'none';

  let winnerText;
  if (dTotal > jTotal) {
    dCard.classList.add('score-card--winner'); dBadge.style.display = 'block';
    winnerText = 'DAVID REMPORTE LE DUEL !';
  } else if (jTotal > dTotal) {
    jCard.classList.add('score-card--winner'); jBadge.style.display = 'block';
    winnerText = 'JULIETTE REMPORTE LE DUEL !';
  } else {
    winnerText = 'ÉGALITÉ !';
  }
  document.getElementById('final-winner-text').textContent = winnerText;
  document.getElementById('btn-finalscore-replay').onclick = () => {
    clearSavedState(); showScreen('screen-splash'); initSplash();
  };
  showScreen('screen-finalscore');
}

// ================================================================
// RESUME
// ================================================================
function resumeGame() {
  const save = loadSavedState();
  if (!save) { showScreen('screen-splash'); return; }
  Object.assign(state.phase1, save.phase1 || {});
  if (save.qcm) {
    Object.assign(state.qcm, { mode: save.qcm.mode, guesser: save.qcm.guesser,
      answerer: save.qcm.answerer, qIndex: save.qcm.qIndex || 0,
      selected: null, revealed: false, wasChecked: [false,false,false] });
  }
  if (save.finale) {
    ['juliette','david'].forEach(p => {
      if (save.finale[p]) Object.assign(state.finale[p], save.finale[p]);
    });
  }
  const map = {
    'qcm-david-answer':         afterDavidAnswers,
    'qcm-juliette-answer':      afterJulietteAnswers,
    'qcm-juliette-guess-david': afterJulietteGuess,
    'qcm-david-guess-juliette': afterDavidGuess,
  };
  const step = save.step;
  if (map[step])                        { state.qcm.onComplete = map[step]; renderQCM(); }
  else if (step === 'score-combined')   { showCombinedQCMScore(launchPhase2); }
  else if (step === 'finale-juliette')  { restoreFinale('juliette'); }
  else if (step === 'end-juliette')     { launchDavidFinale(); }
  else if (step === 'finale-david')     { restoreFinale('david'); }
  else if (step === 'end-david')        { showFinalScoreScreen(); }
  else { clearSavedState(); showScreen('screen-splash'); }
}

function restoreFinale(participant) {
  initFinaleButtons(participant);
  renderFinaleQuestion(participant);
  showScreen('screen-finale');
  startCountdown();
  startQuestionTimer(participant);
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
  } catch(e) { console.error('Failed to load questions.json', e); }
  initSplash();
  showScreen('screen-splash');
}

document.addEventListener('DOMContentLoaded', init);
