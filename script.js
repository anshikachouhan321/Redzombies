/**
 * Laalpari — Jeet Ke Dikhao (Spider-Man Edition)
 * 
 * Main Game Engine:
 * - Red & Black Spider-Man theme with glowing crimson hazards and electric blue player dot
 * - Strict 2.0-second round duration with live visible countdown bar and digital timer
 * - 3x3 Grid: 7 blocks randomly turn into "Red Zone" (danger), 2 blocks turn into "Safe Black Zone"
 * - Instant scan at t=0.00s: Safe Black Zone = +1 Level & +1 Score; Red Zone = -1 Lifeline
 * - 3 Spider Lifelines (🕷️) with Spider-Sense Prediction Round event when dropping to 1 life
 * - Game Over screen featuring: "you cannot crack the developer mind"
 * - College ID Authentication with persistent localStorage and Supabase Real-Time Leaderboard
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. PROCEDURAL SOUND SYNTHESIZER (Web Audio API)
     No external audio dependencies; synthesizes custom arcade tones.
     ========================================================================== */
  class SoundManager {
    constructor() {
      this.audioCtx = null;
      this.muted = false;
    }

    ensureContext() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    playTone(frequency, waveType, durationSec, volume = 0.15, endFrequency = null) {
      if (this.muted) return;
      this.ensureContext();
      if (!this.audioCtx) return;

      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = waveType;
        osc.frequency.setValueAtTime(frequency, now);

        if (endFrequency !== null) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFrequency), now + durationSec);
        }

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + durationSec + 0.05);
      } catch (err) {}
    }

    // Quick sine blip when player moves
    playMoveSound() {
      this.playTone(620, 'sine', 0.06, 0.12);
    }

    // Urgent tick as the 2-second timer counts down
    playWarningTick(highPitch = false) {
      this.playTone(highPitch ? 880 : 540, 'triangle', 0.04, 0.08, highPitch ? 660 : 380);
    }

    // Crystalline chime when successfully surviving in a safe black zone
    playSafeZoneChime() {
      const notes = [587.33, 739.99, 880.00]; // D5, F#5, A5
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.12, 0.18), i * 65);
      });
    }

    // Impact crunch when struck by a Red Zone
    playHitSound() {
      if (this.muted) return;
      this.ensureContext();
      if (!this.audioCtx) return;

      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.32);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.33);
      } catch (err) {}
    }

    // Descending interval when losing a Spider lifeline
    playLifelineLost() {
      this.playTone(620, 'sine', 0.12, 0.2);
      setTimeout(() => this.playTone(460, 'sine', 0.22, 0.2), 110);
    }

    // Ascending arpeggio when prediction round succeeds and restores a life
    playLifelineGained() {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.15, 0.22), i * 75);
      });
    }

    // Melancholy descending cadence on game over
    playGameOver() {
      const notes = [440, 392, 349.23, 293.66];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.35, 0.22, freq * 0.9), i * 180);
      });
    }

    // Fanfare when setting a new college personal best
    playHighScoreFanfare() {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.22), i * 100);
      });
    }
  }

  /* ==========================================================================
     2. 2D CANVAS PARTICLE SYSTEM (Sparks & Confetti)
     ========================================================================== */
  class ParticleManager {
    constructor(canvasElement) {
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d');
      this.particles = [];
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    }

    spawnSafeSparks(x, y, count = 16, color = '#38bdf8') {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        this.particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: Math.random() * 0.04 + 0.02,
          radius: Math.random() * 3 + 2,
          color: color
        });
      }
    }

    spawnHighScoreConfetti() {
      const palette = ['#ff0038', '#00d2ff', '#38bdf8', '#ffffff', '#eab308'];
      for (let i = 0; i < 65; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: -10,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 4 + 3,
          life: 1.0,
          decay: Math.random() * 0.012 + 0.008,
          radius: Math.random() * 5 + 4,
          color: palette[Math.floor(Math.random() * palette.length)]
        });
      }
    }

    render() {
      if (this.particles.length === 0) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  /* ==========================================================================
     3. LOCAL STORAGE DATA PERSISTENCE (College ID Binding)
     ========================================================================== */
  const SAVE_KEY = 'laalpari.save.v3';
  let isFirstVisit = false;

  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  let gameSaveData = {
    schemaVersion: 3,
    deviceId: generateUUID(),
    lastActiveCollegeId: 'STUDENT_01',
    currentAvatar: '🕷️',
    muted: false,
    profiles: {
      'STUDENT_01': {
        collegeId: 'STUDENT_01',
        avatarIcon: '🕷️',
        highScore: 0,
        highestLevel: 1,
        gamesPlayed: 0,
        longestStreak: 0,
        createdAt: new Date().toISOString()
      }
    }
  };

  function loadSavedData() {
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.profiles) {
          gameSaveData = parsed;
          if (!gameSaveData.deviceId) {
            gameSaveData.deviceId = generateUUID();
          }
        }
      } else {
        isFirstVisit = true;
        gameSaveData.deviceId = generateUUID();
      }
    } catch (err) {
      console.warn('LocalStorage not accessible, using in-memory state.');
    }
  }

  function commitSavedData() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(gameSaveData));
    } catch (err) {}
  }

  /* ==========================================================================
     4. GAME ENGINE CONSTANTS & STATE MACHINE
     ========================================================================== */
  const ROUND_DURATION_MS = 2000; // Strict 2.0-second round duration
  const PREDICTION_DURATION_MS = 10000; // 10-second bonus prediction window

  const GamePhase = {
    PROFILE_SELECT: 'PROFILE_SELECT',
    ACTIVE: 'ACTIVE',
    SCANNING: 'SCANNING',
    PREDICTION: 'PREDICTION',
    GAME_OVER: 'GAME_OVER'
  };

  const sound = new SoundManager();
  let particles = null;

  // 9 Coordinates in the 3x3 Grid
  const ALL_CELLS = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }
  ];

  const gameState = {
    phase: GamePhase.PROFILE_SELECT,
    paused: false,
    round: 1, // Level
    score: 0,
    personalBest: 0,
    lifelines: 3, // Starts with 3 Spider Lifelines (🕷️)
    streak: 0,
    maxStreakThisRun: 0,

    // Timer tracking for current round
    roundRemainingMs: ROUND_DURATION_MS,
    lastTickHalfSec: 0,

    // Grid allocation: 7 Red Danger Zones, 2 Safe Black Zones
    safeZones: [],
    dangerZones: [],
    preRolledSafeZones: null,

    // Spider-Sense prediction round flag (triggers when dropping to 1 life)
    hasTriggeredPredictionThisDrop: false,
    predictionRemainingMs: PREDICTION_DURATION_MS,
    predictionAnswered: false,

    // Player coordinate (Electric Blue Dot 🔵)
    player: { x: 1, y: 1 },
    activeCollegeId: 'STUDENT_01'
  };

  let lastFrameTimestamp = null;
  let rafLoopId = null;

  /* ==========================================================================
     5. CACHED DOM REFERENCES
     ========================================================================== */
  const dom = {
    shell: document.getElementById('device-shell'),
    deviceViewBtn: document.getElementById('btn-device-view'),
    deviceViewLabel: document.getElementById('device-view-label'),
    soundToggleBtn: document.getElementById('btn-sound-toggle'),
    iconSoundOn: document.getElementById('icon-sound-on'),
    iconSoundOff: document.getElementById('icon-sound-off'),
    pauseBtn: document.getElementById('btn-pause'),
    helpBtn: document.getElementById('btn-help'),

    // HUD Elements
    hudProfileBtn: document.getElementById('btn-profile-switch'),
    hudAvatar: document.getElementById('hud-avatar'),
    hudProfileName: document.getElementById('hud-profile-name'),
    hudRound: document.getElementById('hud-round'),
    hudScore: document.getElementById('hud-score'),
    hudBest: document.getElementById('hud-best'),
    spiderCapsules: document.querySelectorAll('.spider-capsule'),
    streakBadge: document.getElementById('streak-badge'),
    streakCount: document.getElementById('streak-count'),

    // 2.0-Second Live Timer Elements
    roundTimerDigits: document.getElementById('round-timer-digits'),
    roundTimerBar: document.getElementById('round-timer-bar'),

    // Arena 3x3 Grid
    grid3x3: document.getElementById('grid-3x3'),
    gridCells: document.querySelectorAll('.grid-cell'),
    playerToken: document.getElementById('player-token'),
    playerDisc: document.getElementById('player-disc'),
    playerAura: document.getElementById('player-aura'),
    hitVignette: document.getElementById('hit-vignette'),
    canvas: document.getElementById('fx-canvas'),

    // Modals
    modalPrediction: document.getElementById('modal-prediction'),
    predictionTimerBar: document.getElementById('prediction-timer-bar'),
    predictionFeedback: document.getElementById('prediction-feedback'),
    predCells: document.querySelectorAll('.pred-cell'),

    modalGameOver: document.getElementById('modal-gameover'),
    gameoverDevQuote: document.getElementById('gameover-dev-quote'),
    gameoverScore: document.getElementById('gameover-score'),
    gameoverBest: document.getElementById('gameover-best'),
    gameoverRounds: document.getElementById('gameover-rounds'),
    gameoverStreak: document.getElementById('gameover-streak'),
    gameoverCollegeId: document.getElementById('gameover-college-id'),
    gameoverNewBest: document.getElementById('gameover-newbest'),
    btnRestart: document.getElementById('btn-restart'),
    btnSwitchUser: document.getElementById('btn-switch-user'),
    btnGameoverLeaderboard: document.getElementById('btn-gameover-leaderboard'),

    modalProfile: document.getElementById('modal-profile'),
    profileDropdown: document.getElementById('profile-select-dropdown'),
    profileUsernameInput: document.getElementById('profile-username-input'),
    profileCharCounter: document.getElementById('profile-char-counter'),
    profileInputFeedback: document.getElementById('profile-input-feedback'),
    btnProfileStart: document.getElementById('btn-profile-start'),
    btnProfileLeaderboard: document.getElementById('btn-profile-leaderboard'),

    modalHelp: document.getElementById('modal-help'),
    btnHelpClose: document.getElementById('btn-help-close'),
    modalPause: document.getElementById('modal-pause'),
    btnResume: document.getElementById('btn-resume'),
    btnPauseRestart: document.getElementById('btn-pause-restart'),

    // College Real-Time Leaderboard
    leaderboardToggleBtn: document.getElementById('btn-leaderboard-toggle'),
    modalLeaderboard: document.getElementById('modal-leaderboard'),
    globalLeaderboardBody: document.getElementById('global-leaderboard-body'),
    leaderboardStatusBadge: document.getElementById('leaderboard-status-badge'),
    leaderboardStatusText: document.getElementById('leaderboard-status-text'),
    btnLeaderboardClose: document.getElementById('btn-leaderboard-close')
  };

  particles = new ParticleManager(dom.canvas);

  /* ==========================================================================
     6. GRID RANDOMIZATION: 7 RED ZONES & 2 SAFE BLACK ZONES
     ========================================================================== */
  function randomizeGridZones() {
    // If pre-rolled by Spider-Sense prediction round, honor it
    if (gameState.preRolledSafeZones && gameState.preRolledSafeZones.length === 2) {
      gameState.safeZones = gameState.preRolledSafeZones;
      gameState.preRolledSafeZones = null;
    } else {
      // Shuffle 9 cells
      const shuffled = [...ALL_CELLS].sort(() => Math.random() - 0.5);
      // Pick 2 as Safe Black Zones
      gameState.safeZones = shuffled.slice(0, 2);
    }

    // The other 7 are Red Zones
    gameState.dangerZones = ALL_CELLS.filter(cell => 
      !gameState.safeZones.some(safe => safe.x === cell.x && safe.y === cell.y)
    );

    renderGridZones();
  }

  function renderGridZones() {
    dom.gridCells.forEach(cell => {
      const cellX = parseInt(cell.getAttribute('data-x'), 10);
      const cellY = parseInt(cell.getAttribute('data-y'), 10);
      const tag = cell.querySelector('.cell-status-tag');

      cell.classList.remove('zone-red', 'zone-black', 'scan-safe-flash', 'scan-danger-flash');

      const isSafe = gameState.safeZones.some(s => s.x === cellX && s.y === cellY);
      if (isSafe) {
        cell.classList.add('zone-black');
        if (tag) tag.textContent = 'SAFE';
      } else {
        cell.classList.add('zone-red');
        if (tag) tag.textContent = 'RED';
      }
    });
  }

  function clearGridHighlights() {
    dom.gridCells.forEach(cell => {
      cell.classList.remove('scan-safe-flash', 'scan-danger-flash');
    });
  }

  /* ==========================================================================
     7. PLAYER INPUT & MOVEMENT HANDLING
     ========================================================================== */
  function isMovementPermitted() {
    return (
      gameState.phase === GamePhase.ACTIVE &&
      !gameState.paused
    );
  }

  function movePlayer(deltaX, deltaY) {
    if (!isMovementPermitted()) return;

    const nextX = Math.max(0, Math.min(2, gameState.player.x + deltaX));
    const nextY = Math.max(0, Math.min(2, gameState.player.y + deltaY));

    if (nextX !== gameState.player.x || nextY !== gameState.player.y) {
      gameState.player.x = nextX;
      gameState.player.y = nextY;
      sound.playMoveSound();
      updatePlayerVisuals(true);
    }
  }

  function moveToCell(targetX, targetY) {
    if (!isMovementPermitted()) return;

    const nextX = Math.max(0, Math.min(2, targetX));
    const nextY = Math.max(0, Math.min(2, targetY));

    if (nextX !== gameState.player.x || nextY !== gameState.player.y) {
      gameState.player.x = nextX;
      gameState.player.y = nextY;
      sound.playMoveSound();
      updatePlayerVisuals(true);
    }
  }

  function handleKeyboardInput(evt) {
    const activeElementTag = evt.target ? evt.target.tagName : '';
    if (activeElementTag === 'INPUT' || activeElementTag === 'TEXTAREA' || activeElementTag === 'SELECT') {
      return; // Do NOT preventDefault while typing in input fields!
    }

    const key = evt.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D', ' '].includes(key)) {
      evt.preventDefault();
    }
    if (evt.repeat) return;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        movePlayer(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        movePlayer(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        movePlayer(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        movePlayer(1, 0);
        break;
      case 'Escape':
      case 'p':
      case 'P':
        togglePauseState();
        break;
    }
  }

  function attachTouchControls() {
    const bindDpadButton = (elementId, deltaX, deltaY) => {
      const btn = document.getElementById(elementId);
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        sound.ensureContext();
        btn.classList.add('pressed');
        movePlayer(deltaX, deltaY);
      });
      const releaseButton = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', releaseButton);
      btn.addEventListener('pointercancel', releaseButton);
      btn.addEventListener('pointerleave', releaseButton);
    };

    bindDpadButton('dpad-up', 0, -1);
    bindDpadButton('dpad-down', 0, 1);
    bindDpadButton('dpad-left', -1, 0);
    bindDpadButton('dpad-right', 1, 0);
  }

  /* ==========================================================================
     8. UI RENDERING & VISUAL FEEDBACK
     ========================================================================== */
  function updatePlayerVisuals(isMoving = false) {
    const targetCell = document.getElementById(`cell-${gameState.player.x}-${gameState.player.y}`);
    if (!targetCell) return;

    const cellLeft = targetCell.offsetLeft;
    const cellTop = targetCell.offsetTop;
    dom.playerToken.style.transform = `translate3d(${cellLeft}px, ${cellTop}px, 0)`;

    if (isMoving) {
      dom.playerDisc.style.transform = 'scale(1.15)';
      setTimeout(() => {
        dom.playerDisc.style.transform = 'scale(1)';
      }, 140);
    }
  }

  function updateHUD() {
    dom.hudRound.textContent = gameState.round;
    dom.hudScore.textContent = gameState.score;
    dom.hudBest.textContent = gameState.personalBest;
    dom.hudProfileName.textContent = gameState.activeCollegeId;

    const activeProf = gameSaveData.profiles[gameState.activeCollegeId];
    const avatar = (activeProf && activeProf.avatarIcon) || gameSaveData.currentAvatar || '🕷️';
    dom.hudAvatar.textContent = avatar;

    // 3 Spider Lifelines Capsule Icons
    dom.spiderCapsules.forEach((capsule, index) => {
      if (index < gameState.lifelines) {
        capsule.classList.remove('lost');
      } else {
        capsule.classList.add('lost');
      }
    });

    // Streak badge indicator
    if (gameState.streak >= 2) {
      dom.streakBadge.classList.add('active');
      dom.streakCount.textContent = `${gameState.streak} STREAK`;
    } else {
      dom.streakBadge.classList.remove('active');
    }

    // Emerald aura around player for 4+ streak
    if (gameState.streak >= 4) {
      dom.playerAura.classList.add('active');
    } else {
      dom.playerAura.classList.remove('active');
    }
  }

  function showDamageFeedback() {
    sound.playHitSound();
    sound.playLifelineLost();
    dom.shell.classList.add('shaking');
    dom.playerDisc.classList.add('hit');
    dom.hitVignette.classList.add('active');

    if (navigator.vibrate) {
      try { navigator.vibrate(140); } catch (e) {}
    }

    setTimeout(() => {
      dom.shell.classList.remove('shaking');
      dom.playerDisc.classList.remove('hit');
      dom.hitVignette.classList.remove('active');
    }, 240);
  }

  /* ==========================================================================
     9. ROUND CYCLING & 0.00s SCANNING LOGIC
     ========================================================================== */
  function startNewGame() {
    gameState.round = 1;
    gameState.score = 0;
    gameState.lifelines = 3; // Exactly 3 Spider Lifelines
    gameState.streak = 0;
    gameState.maxStreakThisRun = 0;
    gameState.hasTriggeredPredictionThisDrop = false;
    gameState.paused = false;
    gameState.player = { x: 1, y: 1 };
    gameState.preRolledSafeZones = null;

    dismissAllModals();
    clearGridHighlights();
    updatePlayerVisuals();
    updateHUD();

    startRound();
  }

  function startRound() {
    gameState.phase = GamePhase.ACTIVE;
    gameState.roundRemainingMs = ROUND_DURATION_MS;
    gameState.lastTickHalfSec = 4;

    randomizeGridZones();
    updateHUD();
    updateTimerVisuals();
  }

  function updateTimerVisuals() {
    const remainingSec = Math.max(0, gameState.roundRemainingMs / 1000);
    dom.roundTimerDigits.textContent = `${remainingSec.toFixed(2)}s`;

    const progressFraction = Math.max(0, Math.min(1, gameState.roundRemainingMs / ROUND_DURATION_MS));
    dom.roundTimerBar.style.width = `${(progressFraction * 100).toFixed(1)}%`;

    // Critical pulse when less than 0.60 seconds remain
    if (gameState.roundRemainingMs <= 600) {
      dom.roundTimerDigits.classList.add('critical');
      dom.roundTimerBar.classList.add('critical');
    } else {
      dom.roundTimerDigits.classList.remove('critical');
      dom.roundTimerBar.classList.remove('critical');
    }
  }

  function scanGridAtZero() {
    gameState.phase = GamePhase.SCANNING;
    gameState.roundRemainingMs = 0;
    updateTimerVisuals();

    const playerX = gameState.player.x;
    const playerY = gameState.player.y;
    const playerCell = document.getElementById(`cell-${playerX}-${playerY}`);

    const isSafe = gameState.safeZones.some(s => s.x === playerX && s.y === playerY);

    if (isSafe) {
      // ================= SAFE SANCTUARY =================
      gameState.score++;
      gameState.round++;
      gameState.streak++;
      if (gameState.streak > gameState.maxStreakThisRun) {
        gameState.maxStreakThisRun = gameState.streak;
      }
      if (gameState.score > gameState.personalBest) {
        gameState.personalBest = gameState.score;
      }

      sound.playSafeZoneChime();

      if (playerCell) {
        playerCell.classList.add('scan-safe-flash');
        const rect = playerCell.getBoundingClientRect();
        const canvasRect = dom.canvas.getBoundingClientRect();
        particles.spawnSafeSparks(
          rect.left - canvasRect.left + rect.width / 2,
          rect.top - canvasRect.top + rect.height / 2,
          18,
          '#38bdf8'
        );
      }

      updateHUD();

      // Brief 200ms victory flash before next round starts
      setTimeout(() => {
        if (gameState.phase === GamePhase.SCANNING) {
          clearGridHighlights();
          startRound();
        }
      }, 200);

    } else {
      // ================= CAUGHT IN RED ZONE =================
      gameState.lifelines--;
      gameState.streak = 0;

      if (playerCell) {
        playerCell.classList.add('scan-danger-flash');
      }

      showDamageFeedback();
      updateHUD();

      // Check if dropped to 0 lifelines -> Game Over
      if (gameState.lifelines <= 0) {
        setTimeout(() => {
          triggerGameOver();
        }, 300);
        return;
      }

      // Check if dropped from 2 to 1 lifeline -> Trigger Spider-Sense Prediction Round
      if (gameState.lifelines === 1 && !gameState.hasTriggeredPredictionThisDrop) {
        gameState.hasTriggeredPredictionThisDrop = true;
        setTimeout(() => {
          clearGridHighlights();
          startPredictionRound();
        }, 320);
        return;
      }

      // Otherwise proceed to next round after short hit cooldown
      setTimeout(() => {
        if (gameState.phase === GamePhase.SCANNING) {
          clearGridHighlights();
          startRound();
        }
      }, 300);
    }
  }

  /* ==========================================================================
     10. SPIDER-SENSE PREDICTION ROUND MINI-GAME (Triggered at 1 Lifeline)
     ========================================================================== */
  function startPredictionRound() {
    gameState.phase = GamePhase.PREDICTION;
    gameState.paused = true;
    gameState.predictionRemainingMs = PREDICTION_DURATION_MS;
    gameState.predictionAnswered = false;

    // Pre-roll the next round's 2 safe zones
    const shuffled = [...ALL_CELLS].sort(() => Math.random() - 0.5);
    gameState.preRolledSafeZones = shuffled.slice(0, 2);

    // Reset prediction UI
    dom.predictionTimerBar.style.width = '100%';
    dom.predictionTimerBar.style.backgroundColor = 'var(--accent-emerald)';
    dom.predictionFeedback.textContent = 'Tap 1 of the 9 blocks to scan with your Spider-Sense!';
    dom.predictionFeedback.className = 'prediction-feedback';

    dom.predCells.forEach(cell => {
      cell.classList.remove('revealed-safe', 'revealed-red');
      const inner = cell.querySelector('.pred-inner');
      if (inner) inner.textContent = '?';
      cell.disabled = false;
    });

    dom.modalPrediction.classList.add('open');
  }

  function handlePredictionChoice(cellX, cellY, clickedBtn) {
    if (gameState.predictionAnswered) return;
    gameState.predictionAnswered = true;

    // Disable all prediction buttons
    dom.predCells.forEach(c => c.disabled = true);

    const isMatch = gameState.preRolledSafeZones.some(s => s.x === cellX && s.y === cellY);
    const inner = clickedBtn.querySelector('.pred-inner');

    if (isMatch) {
      // PREDICTION SUCCESS! RECOVER +1 LIFELINE (1 -> 2)
      gameState.lifelines = 2;
      clickedBtn.classList.add('revealed-safe');
      if (inner) inner.textContent = '✓';
      dom.predictionFeedback.textContent = '🎯 SPIDER-SENSE ACTIVATED! Recovered +1 Lifeline! (Lifelines: 2)';
      dom.predictionFeedback.className = 'prediction-feedback success';

      sound.playLifelineGained();
      const rect = dom.modalPrediction.getBoundingClientRect();
      particles.spawnSafeSparks(rect.width / 2, rect.height / 2, 28, '#10b981');
    } else {
      // PREDICTION FAILED
      clickedBtn.classList.add('revealed-red');
      if (inner) inner.textContent = '✕';
      dom.predictionFeedback.textContent = '✕ MISSED! Spider-Sense clouded. Continuing with 1 life!';
      dom.predictionFeedback.className = 'prediction-feedback failure';

      sound.playWarningTick();
    }

    updateHUD();

    // After 900ms reveal, close modal and resume game with the pre-rolled safe blocks!
    setTimeout(() => {
      dom.modalPrediction.classList.remove('open');
      gameState.paused = false;
      startRound();
    }, 950);
  }

  /* ==========================================================================
     11. GAME OVER: "YOU CANNOT CRACK THE DEVELOPER MIND" & SUPABASE SYNC
     ========================================================================== */
  function triggerGameOver() {
    gameState.phase = GamePhase.GAME_OVER;
    sound.playGameOver();

    const currentProfile = gameSaveData.profiles[gameState.activeCollegeId];
    const isNewRecord = currentProfile && gameState.score > currentProfile.highScore;

    if (currentProfile) {
      if (isNewRecord) {
        currentProfile.highScore = gameState.score;
        sound.playHighScoreFanfare();
        setTimeout(() => particles.spawnHighScoreConfetti(), 250);
        submitScoreToSupabase(gameState.score);
      } else if (currentProfile.highScore > 0) {
        submitScoreToSupabase(currentProfile.highScore);
      }

      currentProfile.gamesPlayed++;
      if (gameState.round > (currentProfile.highestLevel || 1)) {
        currentProfile.highestLevel = gameState.round;
      }
      if (gameState.maxStreakThisRun > currentProfile.longestStreak) {
        currentProfile.longestStreak = gameState.maxStreakThisRun;
      }
      commitSavedData();
    }

    // Populate Game Over Modal
    dom.gameoverScore.textContent = gameState.score;
    dom.gameoverBest.textContent = currentProfile ? currentProfile.highScore : gameState.score;
    dom.gameoverRounds.textContent = gameState.round;
    dom.gameoverStreak.textContent = gameState.maxStreakThisRun;
    dom.gameoverCollegeId.textContent = gameState.activeCollegeId;
    dom.gameoverNewBest.style.display = isNewRecord ? 'block' : 'none';

    // Verify Developer Mind banner is displayed
    if (dom.gameoverDevQuote) {
      dom.gameoverDevQuote.textContent = '"you cannot crack the developer mind"';
    }

    dom.modalGameOver.classList.add('open');
  }

  /* ==========================================================================
     12. MAIN SINGLE-CLOCK RAF LOOP (2.0s Round Clock)
     ========================================================================== */
  function mainGameLoop(currentTimestamp) {
    rafLoopId = requestAnimationFrame(mainGameLoop);

    if (lastFrameTimestamp === null) lastFrameTimestamp = currentTimestamp;
    const deltaTime = currentTimestamp - lastFrameTimestamp;
    lastFrameTimestamp = currentTimestamp;

    // Render 2D particles
    particles.render();

    // Handle Paused state
    if (gameState.paused) {
      // In Prediction Mode, drain the 10-second bar
      if (gameState.phase === GamePhase.PREDICTION && !gameState.predictionAnswered) {
        gameState.predictionRemainingMs -= deltaTime;
        const progressFraction = Math.max(0, gameState.predictionRemainingMs / PREDICTION_DURATION_MS);
        dom.predictionTimerBar.style.width = `${(progressFraction * 100).toFixed(1)}%`;

        if (gameState.predictionRemainingMs <= 3000) {
          dom.predictionTimerBar.style.backgroundColor = 'var(--spidey-crimson)';
        }

        if (gameState.predictionRemainingMs <= 0) {
          // Timeout: auto-pick first cell
          const firstCell = dom.predCells[0];
          handlePredictionChoice(0, 0, firstCell);
        }
      }
      return;
    }

    if (gameState.phase !== GamePhase.ACTIVE) {
      return;
    }

    // Decrement round remaining time
    gameState.roundRemainingMs -= deltaTime;

    // Sound ticks at 1.5s, 1.0s, 0.5s
    const halfSecondsRemaining = Math.floor(gameState.roundRemainingMs / 500);
    if (halfSecondsRemaining < gameState.lastTickHalfSec) {
      gameState.lastTickHalfSec = halfSecondsRemaining;
      sound.playWarningTick(halfSecondsRemaining <= 1);
    }

    // When 2-second timer reaches 0.00s -> trigger scan
    if (gameState.roundRemainingMs <= 0) {
      scanGridAtZero();
    } else {
      updateTimerVisuals();
    }
  }

  /* ==========================================================================
     13. SUPABASE REAL-TIME LEADERBOARD & COLLEGE ID SYSTEM
     ========================================================================== */
  let supabaseClient = null;
  let realtimeChannel = null;
  let selectedAvatar = '🕷️';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function sanitizeCollegeId(raw) {
    if (!raw) return 'STUDENT';
    // Allow alphanumeric, underscore, hyphen, length 2–15
    return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 15).toUpperCase();
  }

  function initSupabase() {
    try {
      if (typeof window.isSupabaseConfigured === 'function' && window.isSupabaseConfigured() && window.supabase) {
        supabaseClient = window.supabase.createClient(
          window.SUPABASE_CONFIG.url,
          window.SUPABASE_CONFIG.anonKey
        );

        if (dom.leaderboardStatusBadge) {
          dom.leaderboardStatusBadge.classList.remove('offline');
          dom.leaderboardStatusText.textContent = 'LIVE SYNC';
        }

        subscribeToLeaderboard();
        console.log('Supabase Realtime connected for Laalpari College Leaderboard.');
      } else {
        if (dom.leaderboardStatusBadge) {
          dom.leaderboardStatusBadge.classList.add('offline');
          dom.leaderboardStatusText.textContent = 'LOCAL MODE';
        }
      }
    } catch (err) {
      console.warn('Supabase initialization failed:', err);
      if (dom.leaderboardStatusBadge) {
        dom.leaderboardStatusBadge.classList.add('offline');
        dom.leaderboardStatusText.textContent = 'OFFLINE';
      }
    }
  }

  function subscribeToLeaderboard() {
    if (!supabaseClient) return;

    try {
      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
      }

      realtimeChannel = supabaseClient
        .channel('public:leaderboard')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'leaderboard' },
          (payload) => {
            console.log('Supabase realtime score change:', payload.eventType);
            fetchTop10Leaderboard();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('WebSocket active on Supabase leaderboard channel.');
          }
        });
    } catch (err) {
      console.warn('Error subscribing to Supabase Realtime channel:', err);
    }
  }

  async function fetchTop10Leaderboard() {
    if (!dom.globalLeaderboardBody) return;

    renderLeaderboardSkeletons();

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('leaderboard')
          .select('user_id, username, avatar_icon, high_score')
          .order('high_score', { ascending: false })
          .limit(10);

        if (error) {
          console.warn('Error fetching Supabase leaderboard:', error.message);
          renderFallbackLeaderboard('Showing local records.');
          return;
        }

        renderLeaderboardRows(data);
      } catch (err) {
        console.warn('Supabase fetch exception:', err);
        renderFallbackLeaderboard('Offline. Showing local records.');
      }
    } else {
      renderFallbackLeaderboard();
    }
  }

  function renderLeaderboardSkeletons() {
    let skeletonHtml = '';
    for (let i = 0; i < 5; i++) {
      skeletonHtml += `
        <tr class="skeleton-row">
          <td class="col-rank"><div class="skeleton-shimmer skeleton-circle"></div></td>
          <td class="col-player"><div class="skeleton-shimmer skeleton-bar-long"></div></td>
          <td class="col-score"><div class="skeleton-shimmer skeleton-bar-short"></div></td>
        </tr>
      `;
    }
    dom.globalLeaderboardBody.innerHTML = skeletonHtml;
  }

  function renderLeaderboardRows(records) {
    if (!records || records.length === 0) {
      dom.globalLeaderboardBody.innerHTML = `
        <tr>
          <td colspan="3">
            <div class="empty-leaderboard-box">
              <span>🕷️</span>
              <div>No college records set yet!</div>
              <small>Play a round to claim Rank #1!</small>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const currentCollegeId = gameState.activeCollegeId;
    let rowsHtml = '';

    records.forEach((record, index) => {
      const rank = index + 1;
      let badgeClass = 'rank-standard';
      if (rank === 1) badgeClass = 'rank-1';
      else if (rank === 2) badgeClass = 'rank-2';
      else if (rank === 3) badgeClass = 'rank-3';

      const isCurrentUser = record.username === currentCollegeId;
      const rowClass = isCurrentUser ? 'leaderboard-row current-user-row' : 'leaderboard-row';
      const userTag = isCurrentUser ? '<span class="current-user-tag">YOU</span>' : '';
      const avatar = record.avatar_icon || '🕷️';
      const safeName = escapeHtml(record.username);

      rowsHtml += `
        <tr class="${rowClass}">
          <td class="col-rank">
            <span class="rank-badge ${badgeClass}">${rank}</span>
          </td>
          <td class="col-player">
            <div class="player-info-cell">
              <span class="player-avatar-small">${avatar}</span>
              <span class="player-name-text">${safeName}</span>
              ${userTag}
            </div>
          </td>
          <td class="col-score tabular">${record.high_score}</td>
        </tr>
      `;
    });

    dom.globalLeaderboardBody.innerHTML = rowsHtml;
  }

  function renderFallbackLeaderboard(notice = null) {
    const sortedProfiles = Object.entries(gameSaveData.profiles)
      .map(([name, stats]) => ({
        user_id: stats.collegeId || name,
        username: name,
        avatar_icon: stats.avatarIcon || gameSaveData.currentAvatar || '🕷️',
        high_score: stats.highScore || 0
      }))
      .sort((a, b) => b.high_score - a.high_score)
      .slice(0, 10);

    renderLeaderboardRows(sortedProfiles);

    if (notice) {
      console.info(notice);
    }
  }

  let lastScoreSubmitTime = 0;
  async function submitScoreToSupabase(score) {
    if (!supabaseClient) return;
    const now = Date.now();
    if (now - lastScoreSubmitTime < 1000) return;
    lastScoreSubmitTime = now;

    const currentProfile = gameSaveData.profiles[gameState.activeCollegeId];
    if (!currentProfile) return;

    try {
      const sanitizedId = sanitizeCollegeId(gameState.activeCollegeId);
      const avatar = currentProfile.avatarIcon || gameSaveData.currentAvatar || '🕷️';
      // Deterministic user_id per College ID so each student has their own unique rank
      const userId = 'cid_' + sanitizedId.toLowerCase();

      const { error } = await supabaseClient
        .from('leaderboard')
        .upsert(
          {
            user_id: userId,
            username: sanitizedId,
            avatar_icon: avatar,
            high_score: score,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.warn('Supabase upsert warning:', error.message);
      } else {
        console.log('Score synced to Supabase for College ID:', sanitizedId, score);
      }
    } catch (err) {
      console.warn('Network error while syncing score to Supabase:', err);
    }
  }

  function setupAvatarPicker() {
    const avatarButtons = document.querySelectorAll('.avatar-option');
    avatarButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        avatarButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAvatar = btn.getAttribute('data-avatar') || '🕷️';
      });
    });
  }

  function setAvatarPickerSelection(avatar) {
    selectedAvatar = avatar || '🕷️';
    const avatarButtons = document.querySelectorAll('.avatar-option');
    avatarButtons.forEach(b => {
      if (b.getAttribute('data-avatar') === selectedAvatar) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });
  }

  function populateProfileDropdown() {
    if (!dom.profileDropdown) return;
    dom.profileDropdown.innerHTML = '';
    Object.keys(gameSaveData.profiles).forEach(collegeId => {
      const option = document.createElement('option');
      option.value = collegeId;
      const avatar = gameSaveData.profiles[collegeId].avatarIcon || '🕷️';
      option.textContent = `${avatar} ${collegeId} (Best: ${gameSaveData.profiles[collegeId].highScore})`;
      if (collegeId === gameState.activeCollegeId) option.selected = true;
      dom.profileDropdown.appendChild(option);
    });
  }

  function setActiveCollegeId(collegeId) {
    const sanitized = sanitizeCollegeId(collegeId);
    if (!gameSaveData.profiles[sanitized]) return;

    gameState.activeCollegeId = sanitized;
    gameSaveData.lastActiveCollegeId = sanitized;
    gameState.personalBest = gameSaveData.profiles[sanitized].highScore || 0;
    const profAvatar = gameSaveData.profiles[sanitized].avatarIcon || '🕷️';
    gameSaveData.currentAvatar = profAvatar;
    setAvatarPickerSelection(profAvatar);

    if (dom.profileUsernameInput) {
      dom.profileUsernameInput.value = sanitized;
      if (dom.profileCharCounter) {
        dom.profileCharCounter.textContent = `${sanitized.length}/15`;
      }
    }

    commitSavedData();
    updateHUD();
  }

  function saveOrUpdateCollegeId(rawId, avatar) {
    const sanitized = sanitizeCollegeId(rawId);
    if (!sanitized || sanitized.length < 2) return false;

    if (!gameSaveData.profiles[sanitized]) {
      gameSaveData.profiles[sanitized] = {
        collegeId: sanitized,
        avatarIcon: avatar,
        highScore: 0,
        highestLevel: 1,
        gamesPlayed: 0,
        longestStreak: 0,
        createdAt: new Date().toISOString()
      };
    } else {
      gameSaveData.profiles[sanitized].avatarIcon = avatar;
    }

    gameSaveData.currentAvatar = avatar;
    setActiveCollegeId(sanitized);
    populateProfileDropdown();

    if (gameSaveData.profiles[sanitized].highScore > 0) {
      submitScoreToSupabase(gameSaveData.profiles[sanitized].highScore);
    }
    return true;
  }

  function openProfileModal() {
    gameState.paused = true;
    populateProfileDropdown();
    if (dom.profileUsernameInput) {
      dom.profileUsernameInput.value = gameState.activeCollegeId;
      if (dom.profileCharCounter) {
        dom.profileCharCounter.textContent = `${gameState.activeCollegeId.length}/15`;
      }
    }
    const currentAvatar = (gameSaveData.profiles[gameState.activeCollegeId] && gameSaveData.profiles[gameState.activeCollegeId].avatarIcon) || gameSaveData.currentAvatar || '🕷️';
    setAvatarPickerSelection(currentAvatar);
    dismissAllModals();
    dom.modalProfile.classList.add('open');
  }

  function openLeaderboardModal() {
    gameState.paused = true;
    dismissAllModals();
    dom.modalLeaderboard.classList.add('open');
    fetchTop10Leaderboard();
  }

  /* ==========================================================================
     14. DEVICE SIMULATOR & MODAL CONTROLS
     ========================================================================= */
  function dismissAllModals() {
    dom.modalPrediction.classList.remove('open');
    dom.modalGameOver.classList.remove('open');
    dom.modalProfile.classList.remove('open');
    dom.modalHelp.classList.remove('open');
    dom.modalPause.classList.remove('open');
    if (dom.modalLeaderboard) dom.modalLeaderboard.classList.remove('open');
  }

  function togglePauseState() {
    if (gameState.phase === GamePhase.PROFILE_SELECT || gameState.phase === GamePhase.GAME_OVER || gameState.phase === GamePhase.PREDICTION) return;
    gameState.paused = !gameState.paused;
    if (gameState.paused) {
      dom.modalPause.classList.add('open');
    } else {
      dom.modalPause.classList.remove('open');
    }
  }

  const simulationModes = ['mode-auto', 'mode-mobile-small', 'mode-mobile-large', 'mode-tablet', 'mode-laptop', 'mode-tv'];
  const simulationLabels = ['Auto', 'Mobile (Sm)', 'Mobile (Lg)', 'Tablet', 'Laptop', 'TV (4K)'];
  let currentDeviceIndex = 0;

  function cycleDevicePreviewMode() {
    currentDeviceIndex = (currentDeviceIndex + 1) % simulationModes.length;
    simulationModes.forEach(cls => dom.shell.classList.remove(cls));
    dom.shell.classList.add(simulationModes[currentDeviceIndex]);
    dom.deviceViewLabel.textContent = simulationLabels[currentDeviceIndex];

    setTimeout(() => {
      particles.resizeCanvas();
      updatePlayerVisuals();
    }, 300);
  }

  /* ==========================================================================
     15. INITIALIZATION & EVENT LISTENERS
     ========================================================================== */
  function initializeGame() {
    loadSavedData();

    // Restore last active College ID
    if (gameSaveData.lastActiveCollegeId && gameSaveData.profiles[gameSaveData.lastActiveCollegeId]) {
      gameState.activeCollegeId = gameSaveData.lastActiveCollegeId;
    } else {
      gameState.activeCollegeId = Object.keys(gameSaveData.profiles)[0] || 'STUDENT_01';
    }
    gameState.personalBest = gameSaveData.profiles[gameState.activeCollegeId]?.highScore || 0;

    // Restore audio mute state
    sound.muted = !!gameSaveData.muted;
    dom.iconSoundOn.style.display = sound.muted ? 'none' : 'block';
    dom.iconSoundOff.style.display = sound.muted ? 'block' : 'none';

    // Setup Avatar Picker
    setupAvatarPicker();
    const currentAvatar = (gameSaveData.profiles[gameState.activeCollegeId] && gameSaveData.profiles[gameState.activeCollegeId].avatarIcon) || gameSaveData.currentAvatar || '🕷️';
    setAvatarPickerSelection(currentAvatar);

    // Keyboard listeners
    window.addEventListener('keydown', handleKeyboardInput);

    // Page visibility auto-pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !gameState.paused && gameState.phase === GamePhase.ACTIVE) {
        gameState.paused = true;
        dom.modalPause.classList.add('open');
      }
    });

    // Resize handler
    window.addEventListener('resize', () => {
      updatePlayerVisuals();
      particles.resizeCanvas();
    });

    // Touch D-Pad buttons
    attachTouchControls();

    // Sound toggle button
    dom.soundToggleBtn.addEventListener('click', () => {
      sound.ensureContext();
      sound.muted = !sound.muted;
      gameSaveData.muted = sound.muted;
      commitSavedData();
      dom.iconSoundOn.style.display = sound.muted ? 'none' : 'block';
      dom.iconSoundOff.style.display = sound.muted ? 'block' : 'none';
    });

    // Viewport preview toggle
    dom.deviceViewBtn.addEventListener('click', cycleDevicePreviewMode);

    // Pause / Resume buttons
    dom.pauseBtn.addEventListener('click', togglePauseState);
    dom.btnResume.addEventListener('click', togglePauseState);
    dom.btnPauseRestart.addEventListener('click', () => {
      dismissAllModals();
      startNewGame();
    });

    // Help modal buttons
    dom.helpBtn.addEventListener('click', () => {
      gameState.paused = true;
      dom.modalHelp.classList.add('open');
    });
    dom.btnHelpClose.addEventListener('click', () => {
      dom.modalHelp.classList.remove('open');
      gameState.paused = false;
    });

    // Profile modal & HUD edit button
    dom.hudProfileBtn.addEventListener('click', openProfileModal);

    dom.profileDropdown.addEventListener('change', (e) => {
      setActiveCollegeId(e.target.value);
    });

    // Input validation for College ID
    if (dom.profileUsernameInput) {
      dom.profileUsernameInput.value = gameState.activeCollegeId;
      if (dom.profileCharCounter) {
        dom.profileCharCounter.textContent = `${gameState.activeCollegeId.length}/15`;
      }

      dom.profileUsernameInput.addEventListener('input', () => {
        const raw = dom.profileUsernameInput.value;
        const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 15).toUpperCase();
        if (raw !== sanitized) {
          dom.profileUsernameInput.value = sanitized;
        }
        if (dom.profileCharCounter) {
          dom.profileCharCounter.textContent = `${sanitized.length}/15`;
        }

        if (sanitized.length < 2) {
          dom.profileInputFeedback.textContent = 'Minimum 2 characters required.';
          dom.profileInputFeedback.className = 'input-feedback error';
        } else {
          dom.profileInputFeedback.textContent = 'Letters, numbers, dash & underscore only (2–15 chars)';
          dom.profileInputFeedback.className = 'input-feedback';
        }
      });

      dom.profileUsernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleProfileSaveAndStart();
        }
      });
    }

    function handleProfileSaveAndStart() {
      sound.ensureContext();
      const enteredId = dom.profileUsernameInput ? dom.profileUsernameInput.value.trim() : '';
      const sanitized = sanitizeCollegeId(enteredId);

      if (sanitized.length < 2) {
        if (dom.profileInputFeedback) {
          dom.profileInputFeedback.textContent = 'Enter a valid College ID (2–15 chars)!';
          dom.profileInputFeedback.className = 'input-feedback error';
        }
        if (dom.profileUsernameInput) dom.profileUsernameInput.focus();
        return;
      }

      saveOrUpdateCollegeId(sanitized, selectedAvatar);
      dismissAllModals();
      startNewGame();
    }

    dom.btnProfileStart.addEventListener('click', handleProfileSaveAndStart);

    // Leaderboard navigation buttons
    if (dom.leaderboardToggleBtn) {
      dom.leaderboardToggleBtn.addEventListener('click', openLeaderboardModal);
    }
    if (dom.btnLeaderboardClose) {
      dom.btnLeaderboardClose.addEventListener('click', () => {
        dismissAllModals();
        if (gameState.phase === GamePhase.ACTIVE) {
          gameState.paused = false;
        }
      });
    }
    if (dom.btnGameoverLeaderboard) {
      dom.btnGameoverLeaderboard.addEventListener('click', openLeaderboardModal);
    }
    if (dom.btnProfileLeaderboard) {
      dom.btnProfileLeaderboard.addEventListener('click', openLeaderboardModal);
    }

    // Direct cell click/tap controls (moves Electric Blue Dot directly to clicked cell)
    dom.gridCells.forEach(cell => {
      cell.addEventListener('pointerdown', () => {
        sound.ensureContext();
        const cellX = parseInt(cell.getAttribute('data-x'), 10);
        const cellY = parseInt(cell.getAttribute('data-y'), 10);
        if (!isNaN(cellX) && !isNaN(cellY)) {
          moveToCell(cellX, cellY);
        }
      });
    });

    // Touch swipe controls on 3x3 arena
    let touchStartX = 0;
    let touchStartY = 0;
    dom.grid3x3.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    dom.grid3x3.addEventListener('touchend', (e) => {
      if (!touchStartX || !touchStartY || !e.changedTouches || e.changedTouches.length === 0) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (Math.max(absX, absY) > 20) {
        if (absX > absY) {
          movePlayer(deltaX > 0 ? 1 : -1, 0);
        } else {
          movePlayer(0, deltaY > 0 ? 1 : -1);
        }
      }
      touchStartX = 0;
      touchStartY = 0;
    }, { passive: true });

    // Audio context initialization on first user tap
    document.addEventListener('pointerdown', () => sound.ensureContext(), { once: true });

    // Restart & switch user buttons on Game Over
    dom.btnRestart.addEventListener('click', () => {
      sound.ensureContext();
      startNewGame();
    });
    dom.btnSwitchUser.addEventListener('click', openProfileModal);

    // Spider-Sense Prediction 3x3 Grid Buttons
    dom.predCells.forEach(btn => {
      btn.addEventListener('click', () => {
        sound.ensureContext();
        const px = parseInt(btn.getAttribute('data-x'), 10);
        const py = parseInt(btn.getAttribute('data-y'), 10);
        handlePredictionChoice(px, py, btn);
      });
    });

    // Initialize Supabase Cloud Database & WebSockets
    initSupabase();

    // Initial render
    populateProfileDropdown();
    updateHUD();
    updatePlayerVisuals();

    // Check if first visit: prompt College ID login modal on first launch
    if (isFirstVisit) {
      openProfileModal();
    } else {
      dom.modalProfile.classList.add('open');
    }

    // Launch main single-clock RAF loop
    rafLoopId = requestAnimationFrame(mainGameLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
  } else {
    initializeGame();
  }
})();
