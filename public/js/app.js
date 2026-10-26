import { getPlane, getSkin, PLANES, PVP, SKINS } from '../../shared/catalog.js';
import { api } from './api.js';
import { audio } from './audio.js';
import { CombatGame, DuelGame } from './game.js';
import { Mission3D } from './mission3d.js';
import { drawShipThumbnail, MenuScene, ShowcaseScene } from './visuals.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const FREE_PLANES = new Set(PLANES.filter((plane) => plane.unlock === 'free').map((plane) => plane.id));
const FREE_SKINS = new Set(SKINS.filter((skin) => skin.unlock === 'free').map((skin) => skin.id));
const STORAGE = {
  token: 'sky_strike_token',
  loadout: 'sky_strike_loadout',
  guestName: 'sky_strike_guest_name',
  guestStats: 'sky_strike_guest_stats',
  easter: 'sky_strike_easter'
};

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

function guestStatsDefault() {
  return { bestEndless: 0, bestCampaign: 0, campaignStage: 1, kills: 0 };
}

function makeGuestName() {
  const stored = safeRead(STORAGE.guestName, '');
  if (stored) return stored;
  const name = `访客-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  safeWrite(STORAGE.guestName, name);
  return name;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const TAU = Math.PI * 2;

const localLoadout = safeRead(STORAGE.loadout, {});

const state = {
  user: null,
  catalog: null,
  guestName: makeGuestName(),
  guestStats: { ...guestStatsDefault(), ...safeRead(STORAGE.guestStats, {}) },
  selectedPlane: getPlane(localLoadout.plane).id,
  selectedSkin: getSkin(localLoadout.skin).id,
  currentScreen: 'home',
  authMode: 'login',
  afterAuth: null,
  rankMode: 'mission',
  game: null,
  gameMode: null,
  mission: null,
  missionResult: null,
  missionMessageTimer: null,
  missionKillTimer: null,
  missionHudSnapshot: null,
  air3d: {
    selectedMode: 'coop',
    code: null,
    room: null,
    slot: null,
    mode: null,
    waiting: false,
    mission: null,
    active: false,
    countdownTimer: null,
    resultSent: false
  },
  duel: {
    code: null,
    slot: null,
    room: null,
    waiting: false,
    game: null,
    names: null,
    resultTimer: null,
    countdownTimer: null,
    bannerTimer: null
  },
  socket: null,
  network: null,
  easterClicks: 0,
  easterTimer: null,
  leaderboardSeq: 0,
  toastTimers: new Set(),
  radarContacts: [],
  radarRaf: null
};

const dom = {};

function cacheDom() {
  dom.app = $('#app');
  dom.menuCanvas = $('#menu-canvas');
  dom.heroCanvas = $('#hero-canvas');
  dom.hangarCanvas = $('#hangar-canvas');
  dom.topbar = $('#topbar');
  dom.screens = $$('.screen');
  dom.onlineCount = $('#online-count');
  dom.duelOnline = $('#duel-online');
  dom.soundBtn = $('#sound-btn');
  dom.profileBtn = $('#profile-btn');
  dom.avatar = $('#avatar');
  dom.playerName = $('#player-name');
  dom.playerSub = $('#player-sub');
  dom.homeBest = $('#home-best');
  dom.homeStage = $('#home-stage');
  dom.homeKills = $('#home-kills');
  dom.heroPlaneName = $('#hero-plane-name');
  dom.hangarCredits = $('#hangar-credits');
  dom.hangarPlaneCode = $('#hangar-plane-code');
  dom.hangarPlaneName = $('#hangar-plane-name');
  dom.hangarPlaneTagline = $('#hangar-plane-tagline');
  dom.hangarSkinBadge = $('#hangar-skin-badge');
  dom.hangarStats = $('#hangar-stats');
  dom.planeList = $('#plane-list');
  dom.skinGrid = $('#skin-grid');
  dom.skinCount = $('#skin-count');
  dom.launchBtn = $('#launch-btn');
  dom.selfRank = $('#self-rank');
  dom.leaderboardList = $('#leaderboard-list');
  dom.leaderboardUpdated = $('#leaderboard-updated');
  dom.waitingRoom = $('#waiting-room');
  dom.duelLobby = $('#duel-lobby');
  dom.waitingCode = $('#waiting-code');
  dom.hostSlot = $('#host-slot');
  dom.guestSlot = $('#guest-slot');
  dom.hostName = $('#host-name');
  dom.networkList = $('#network-list');
  dom.duelShipIcon = $('#duel-ship-icon');
  dom.duelPlaneName = $('#duel-plane-name');
  dom.duelSkinName = $('#duel-skin-name');
  dom.roomCode = $('#room-code');
  dom.gameCanvas = $('#game-canvas');
  dom.gameHud = $('#game-hud');
  dom.hudModeLabel = $('#hud-mode-label');
  dom.hudStageLabel = $('#hud-stage-label');
  dom.hudScore = $('#hud-score');
  dom.hudCombo = $('#hud-combo');
  dom.hudKills = $('#hud-kills');
  dom.hudTime = $('#hud-time');
  dom.hudPlaneName = $('#hud-plane-name');
  dom.hudHpText = $('#hud-hp-text');
  dom.hudHpFill = $('#hud-hp-fill');
  dom.hudShieldWrap = $('#hud-shield-wrap');
  dom.hudShieldFill = $('#hud-shield-fill');
  dom.hudPower = $('#hud-power');
  dom.bossHud = $('#boss-hud');
  dom.bossName = $('#boss-name');
  dom.bossHpText = $('#boss-hp-text');
  dom.bossHpFill = $('#boss-hp-fill');
  dom.pvpScoreboard = $('#pvp-scoreboard');
  dom.pvpSelfName = $('#pvp-self-name');
  dom.pvpSelfScore = $('#pvp-self-score');
  dom.pvpFoeName = $('#pvp-foe-name');
  dom.pvpFoeScore = $('#pvp-foe-score');
  dom.countdownOverlay = $('#countdown-overlay');
  dom.countdownValue = $('#countdown-value');
  dom.countdownSub = $('#countdown-sub');
  dom.roundBanner = $('#round-banner');
  dom.roundBannerKicker = $('#round-banner-kicker');
  dom.roundBannerText = $('#round-banner-text');
  dom.controlHint = $('#control-hint');
  dom.authModal = $('#auth-modal');
  dom.authForm = $('#auth-form');
  dom.authError = $('#auth-error');
  dom.authUsername = $('#auth-username');
  dom.authPassword = $('#auth-password');
  dom.authSubmit = $('#auth-submit');
  dom.redeemModal = $('#redeem-modal');
  dom.redeemForm = $('#redeem-form');
  dom.redeemCode = $('#redeem-code');
  dom.redeemError = $('#redeem-error');
  dom.redeemResult = $('#redeem-result');
  dom.accountModal = $('#account-modal');
  dom.accountDossier = $('#account-dossier');
  dom.accountActions = $('#account-actions');
  dom.pauseModal = $('#pause-modal');
  dom.pauseSoundToggle = $('#pause-sound-toggle');
  dom.resultModal = $('#result-modal');
  dom.resultEyebrow = $('#result-eyebrow');
  dom.resultTitle = $('#result-title');
  dom.resultSubtitle = $('#result-subtitle');
  dom.resultGrid = $('#result-grid');
  dom.resultExtra = $('#result-extra');
  dom.resultActions = $('#result-actions');
  dom.duelResultModal = $('#duel-result-modal');
  dom.duelResultEyebrow = $('#duel-result-eyebrow');
  dom.duelResultTitle = $('#duel-result-title');
  dom.duelResultSubtitle = $('#duel-result-subtitle');
  dom.duelFinalScore = $('#duel-final-score');
  dom.duelResultActions = $('#duel-result-actions');
  dom.duelRematchNote = $('#duel-rematch-note');
  dom.toastStack = $('#toast-stack');
  dom.bootScreen = $('#boot-screen');
  dom.backButtons = $$('.back-btn');

  dom.missionScreen = $('#screen-mission3d');
  dom.missionCanvas = $('#mission-canvas');
  dom.missionHud = $('#mission-hud');
  dom.missionPauseBtn = $('#mission-pause-btn');
  dom.missionTimer = $('#mission-timer');
  dom.missionKills = $('#mission-kills');
  dom.missionKillcountWrap = $('.mission-killcount');
  dom.missionRequired = $('#mission-required');
  dom.missionSpeed = $('#mission-speed');
  dom.missionAlt = $('#mission-alt');
  dom.missionMach = $('#mission-mach');
  dom.missionThrottle = $('#mission-throttle');
  dom.missionG = $('#mission-g');
  dom.missionHpText = $('#mission-hp-text');
  dom.missionHpFill = $('#mission-hp-fill');
  dom.missionPlaneName = $('#mission-plane-name');
  dom.missionRadar = $('#mission-radar');
  dom.missionRadarCount = $('#mission-radar-count');
  dom.missionCrosshair = $('#mission-crosshair');
  dom.missionTargetMarker = $('#mission-target-marker');
  dom.missionLockRing = $('#mission-lock-ring');
  dom.missionTargetLabel = $('#mission-target-label');
  dom.missionTargetDistance = $('#mission-target-distance');
  dom.missionLockStatus = $('#mission-lock-status');
  dom.missionLockFill = $('#mission-lock-fill');
  dom.missionLockHint = $('#mission-lock-hint');
  dom.missionMissiles = $('#mission-missiles');
  dom.missionFlares = $('#mission-flares');
  dom.missionBoost = $('#mission-boost');
  dom.missionKillfeed = $('#mission-killfeed');
  dom.missionMessage = $('#mission-message');
  dom.missionMessageKicker = $('#mission-message-kicker');
  dom.missionMessageText = $('#mission-message-text');
  dom.missileWarning = $('#missile-warning');
  dom.missileWarningArrow = $('#missile-warning-arrow');
  dom.missileWarningSub = $('#missile-warning-sub');
  dom.missionDamageVignette = $('#mission-damage-vignette');
  dom.missionHitFlash = $('#mission-hit-flash');
  dom.missionCloudOverlay = $('#mission-cloud-overlay');
  dom.missionCoverBadge = $('#mission-cover-badge');
  dom.missionBriefing = $('#mission-briefing');
  dom.missionBriefPlane = $('#mission-brief-plane');
  dom.missionStartBtn = $('#mission-start-btn');
  dom.missionCancelBtn = $('#mission-cancel-btn');
  dom.missionPause = $('#mission-pause');
  dom.missionPauseStats = $('#mission-pause-stats');
  dom.missionResumeBtn = $('#mission-resume-btn');
  dom.missionRestartBtn = $('#mission-restart-btn');
  dom.missionExitBtn = $('#mission-exit-btn');
  dom.missionSoundToggle = $('#mission-sound-toggle');
  dom.missionEnd = $('#mission-end');
  dom.missionEndEyebrow = $('#mission-end-eyebrow');
  dom.missionEndMark = $('#mission-end-mark');
  dom.missionEndTitle = $('#mission-end-title');
  dom.missionEndSubtitle = $('#mission-end-subtitle');
  dom.missionEndGrid = $('#mission-end-grid');
  dom.missionEndExtra = $('#mission-end-extra');
  dom.missionEndActions = $('#mission-end-actions');
  dom.missionStick = $('#mission-stick');
  dom.missionStickKnob = $('#mission-stick-knob');
  dom.missionActionButtons = $$('[data-mission-action]');
  dom.missionRadarCtx = dom.missionRadar?.getContext('2d');
  dom.missionPvpBanner = $('#mission-pvp-banner');
  dom.missionPvpSelfName = $('#mission-pvp-self-name');
  dom.missionPvpSelfHp = $('#mission-pvp-self-hp');
  dom.missionPvpFoeHp = $('#mission-pvp-foe-hp');
  dom.missionPvpFoeName = $('#mission-pvp-foe-name');
  dom.missionWingmanBadge = $('#mission-wingman-badge');
  dom.missionWingmanName = $('#mission-wingman-name');
  dom.missionLanCountdown = $('#mission-lan-countdown');
  dom.missionLanMode = $('#mission-lan-mode');
  dom.missionLanCount = $('#mission-lan-count');
  dom.missionLanSub = $('#mission-lan-sub');

  dom.air3dScreen = $('#screen-air3d');
  dom.air3dOnline = $('#air3d-online');
  dom.air3dLobby = $('#air3d-lobby');
  dom.air3dWaiting = $('#air3d-waiting');
  dom.air3dCreateBtn = $('#air3d-create-btn');
  dom.air3dJoinForm = $('#air3d-join-form');
  dom.air3dRoomCode = $('#air3d-room-code');
  dom.air3dNetworkList = $('#air3d-network-list');
  dom.air3dPlaneName = $('#air3d-plane-name');
  dom.air3dSkinName = $('#air3d-skin-name');
  dom.air3dWaitingCode = $('#air3d-waiting-code');
  dom.air3dWaitingTitle = $('#air3d-waiting-title');
  dom.air3dWaitingEyebrow = $('#air3d-waiting-eyebrow');
  dom.air3dWaitingMode = $('#air3d-waiting-mode');
  dom.air3dHostName = $('#air3d-host-name');
  dom.air3dGuestSlot = $('#air3d-guest-slot');
  dom.air3dCopyBtn = $('#air3d-copy-btn');
  dom.air3dCancelBtn = $('#air3d-cancel-btn');
  dom.air3dModeButtons = $$('[data-air3d-mode]');
}

let menuScene;
let heroScene;
let hangarScene;
let onlineTimer;

function init() {
  cacheDom();
  menuScene = new MenuScene(dom.menuCanvas);
  heroScene = new ShowcaseScene(dom.heroCanvas, {
    plane: state.selectedPlane,
    skin: state.selectedSkin,
    style: 'hero'
  });
  hangarScene = new ShowcaseScene(dom.hangarCanvas, {
    plane: state.selectedPlane,
    skin: state.selectedSkin,
    style: 'hangar'
  });

  bindEvents();
  updateSoundUI();
  updateUserUI();
  renderHome();
  showScreen('home');
  menuScene.start();
  heroScene.start();

  hideBootScreen();
  refreshMe();
  refreshOnline();
  loadNetwork();
  initSocket();

  onlineTimer = setInterval(refreshOnline, 30_000);
  handleInviteFromUrl();
}

function hideBootScreen() {
  window.setTimeout(() => {
    dom.bootScreen?.classList.add('is-done');
  }, 1050);
}

function bindEvents() {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('pointerdown', () => audio.init(), { once: true });
  window.addEventListener('audio:changed', updateSoundUI);
  window.addEventListener('auth:expired', () => {
    state.user = null;
    state.selectedPlane = 'falcon';
    state.selectedSkin = 'chrome';
    updateUserUI();
    renderHome();
    toast('登录状态已过期，请重新接入网络。', 'error');
  });

  document.addEventListener('pointerdown', () => {
    if (state.currentScreen !== 'game' && !audio.ambient) audio.startAmbience('menu');
  }, { once: true });

  dom.soundBtn.addEventListener('click', () => {
    const enabled = audio.toggle();
    updateSoundUI();
    if (enabled) audio.startAmbience(state.currentScreen === 'game' ? 'combat' : 'menu');
    toast(enabled ? '声音已开启' : '声音已静音');
  });

  $('#brand').addEventListener('click', () => {
    registerEasterClick();
    if (state.currentScreen !== 'home') goHome();
  });

  dom.profileBtn.addEventListener('click', () => {
    if (state.user) openAccountModal();
    else openAuth('login');
  });

  $$('.auth-tabs button').forEach((button) => {
    button.addEventListener('click', () => setAuthTab(button.dataset.authTab));
  });

  dom.authForm.addEventListener('submit', submitAuth);
  dom.redeemForm.addEventListener('submit', submitRedeem);
  dom.redeemCode.addEventListener('input', () => {
    dom.redeemCode.value = dom.redeemCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  });

  dom.pauseSoundToggle.addEventListener('click', () => {
    const enabled = audio.toggle();
    updateSoundUI();
  });

  $('#resume-btn').addEventListener('click', resumeGame);
  $('#restart-btn').addEventListener('click', restartGame);
  $('#exit-game-btn').addEventListener('click', exitGameToHome);
  $('#pause-btn').addEventListener('click', requestPause);

  $$('.leaderboard-tabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.rankMode = tab.dataset.rankMode;
      $$('.leaderboard-tabs .tab').forEach((item) => item.classList.toggle('is-active', item === tab));
      loadLeaderboard();
    });
  });

  dom.launchBtn.addEventListener('click', () => startSingle('endless'));
  dom.missionStartBtn.addEventListener('click', startMission3D);
  dom.missionCancelBtn.addEventListener('click', exitMission3D);
  dom.missionPauseBtn.addEventListener('click', openMissionPause);
  dom.missionResumeBtn.addEventListener('click', resumeMission3D);
  dom.missionRestartBtn.addEventListener('click', restartMission3D);
  dom.missionExitBtn.addEventListener('click', exitMission3D);
  dom.missionSoundToggle.addEventListener('click', () => {
    const enabled = audio.toggle();
    updateSoundUI();
    state.mission?.refreshAudio();
    toast(enabled ? '声音已开启' : '声音已静音');
  });
  bindMissionControls();

  dom.air3dModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.air3d.selectedMode = button.dataset.air3dMode === 'pvp' ? 'pvp' : 'coop';
      dom.air3dModeButtons.forEach((item) => item.classList.toggle('is-active', item === button));
      updateAir3DLobbyMode();
    });
  });
  dom.air3dCreateBtn.addEventListener('click', createAir3DRoom);
  dom.air3dJoinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    joinAir3DRoom(dom.air3dRoomCode.value.trim().toUpperCase());
  });
  dom.air3dRoomCode.addEventListener('input', () => {
    dom.air3dRoomCode.value = dom.air3dRoomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  });
  dom.air3dCancelBtn.addEventListener('click', cancelAir3DRoom);
  dom.air3dCopyBtn.addEventListener('click', copyAir3DInvite);

  dom.planeList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-plane]');
    if (card) selectPlane(card.dataset.plane);
  });

  dom.skinGrid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-skin]');
    if (card) selectSkin(card.dataset.skin);
  });

  $('#create-room-btn').addEventListener('click', createRoom);
  $('#quick-room-btn').addEventListener('click', quickMatch);
  $('#cancel-room-btn').addEventListener('click', cancelRoom);
  $('#copy-room-btn').addEventListener('click', copyInvite);
  $('#join-room-form').addEventListener('submit', (event) => {
    event.preventDefault();
    joinRoom(dom.roomCode.value.trim().toUpperCase());
  });
  dom.roomCode.addEventListener('input', () => {
    dom.roomCode.value = dom.roomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  });

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape') return;
    if (!dom.pauseModal.hidden) {
      resumeGame();
    } else if (!dom.missionPause.hidden) {
      resumeMission3D();
    } else if (!dom.authModal.hidden) {
      hideModal('auth-modal');
    } else if (!dom.redeemModal.hidden) {
      hideModal('redeem-modal');
    } else if (!dom.accountModal.hidden) {
      hideModal('account-modal');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.game && !state.duel.game) {
      const modalVisible = !dom.pauseModal.hidden || !dom.resultModal.hidden;
      if (!modalVisible && state.game.phase === 'playing') requestPause();
    }
    if (document.hidden && state.mission && !state.air3d.active && !state.mission.paused && state.mission.state === 'playing' && dom.missionPause.hidden) {
      openMissionPause();
    }
  });

  $$('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target !== backdrop) return;
      if (['auth-modal', 'redeem-modal', 'account-modal'].includes(backdrop.id)) {
        hideModal(backdrop.id);
      }
    });
  });
}

function onDocumentClick(event) {
  const close = event.target.closest('[data-close-modal]');
  if (close) {
    hideModal(close.dataset.closeModal);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  audio.init();
  audio.ui();
  switch (action.dataset.action) {
    case 'home':
      goHome();
      break;
    case 'play-endless':
      startSingle('endless');
      break;
    case 'play-campaign':
      startSingle('campaign');
      break;
    case 'play-mission3d':
      openMission3D();
      break;
    case 'air3d':
      openAir3DLobby();
      break;
    case 'hangar':
      openHangar();
      break;
    case 'leaderboard':
      openLeaderboard();
      break;
    case 'duel':
      openDuel();
      break;
    case 'redeem':
      openRedeem();
      break;
    default:
      break;
  }
}

function updateSoundUI() {
  if (!dom.soundBtn) return;
  dom.soundBtn.classList.toggle('is-muted', !audio.enabled);
  dom.soundBtn.setAttribute('aria-label', audio.enabled ? '静音' : '开启声音');
  dom.pauseSoundToggle?.classList.toggle('on', audio.enabled);
  dom.missionSoundToggle?.classList.toggle('on', audio.enabled);
}

function showScreen(name) {
  const previous = state.currentScreen;
  state.currentScreen = name;
  dom.screens.forEach((screen) => screen.classList.toggle('is-active', screen.id === `screen-${name}`));
  dom.app.classList.toggle('in-game', name === 'game' || name === 'mission3d');

  if (name === 'game' || name === 'mission3d') {
    menuScene?.stop();
    heroScene?.stop();
    hangarScene?.stop();
    audio.stopAmbience();
  } else {
    if (previous === 'game' || previous === 'mission3d') audio.startAmbience('menu');
    menuScene?.start();
    if (name === 'home') {
      heroScene?.start();
      renderHome();
    } else {
      heroScene?.stop();
    }
    if (name === 'hangar') {
      requestAnimationFrame(() => {
        hangarScene?.resize();
        hangarScene?.start();
        renderHangar();
      });
    } else {
      hangarScene?.stop();
    }
    if (name === 'leaderboard') loadLeaderboard();
    if (name === 'duel') {
      renderDuelLobby();
      loadNetwork();
    }
    if (name === 'air3d') {
      updateAir3DLobbyMode();
      renderAir3DLobby();
      loadAir3DNetwork();
    }
  }
}

function openAir3DLobby() {
  hideAllModals();
  cleanupSingleGame();
  if (state.duel.game) leaveDuelCompletely();
  cleanupAir3D();
  showScreen('air3d');
  updateAir3DLobbyMode();
  renderAir3DLobby();
  loadAir3DNetwork();
}

function updateAir3DLobbyMode() {
  const pvp = state.air3d.selectedMode === 'pvp';
  dom.air3dModeButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.air3dMode === state.air3d.selectedMode);
  });
  dom.air3dCreateBtn.querySelector('span').textContent = pvp ? '创建 3D 对决房间' : '创建编队房间';
  dom.air3dCreateBtn.querySelector('small').textContent = pvp ? 'PVP HOST' : 'CO-OP HOST';
  dom.air3dWaitingMode.textContent = pvp ? 'PVP · 3D 王牌对决' : 'CO-OP · 双机编队';
  dom.air3dWaitingTitle.textContent = pvp ? '等待对手接入' : '等待僚机接入';
  dom.air3dWaitingEyebrow.textContent = pvp ? 'WAITING FOR OPPONENT' : 'WAITING FOR WINGMAN';
  dom.air3dGuestSlot.querySelector('small').textContent = pvp ? '挑战者' : '僚机';
  const plane = getPlane(state.selectedPlane);
  const skin = getSkin(state.selectedSkin);
  dom.air3dPlaneName.textContent = plane.name;
  dom.air3dSkinName.textContent = `${skin.name} · ${plane.role}`;
}

function renderAir3DLobby() {
  if (state.air3d.waiting && state.air3d.code) {
    dom.air3dLobby.hidden = true;
    dom.air3dWaiting.hidden = false;
    dom.air3dWaitingCode.textContent = state.air3d.code;
    dom.air3dWaitingMode.textContent = state.air3d.mode === 'pvp' ? 'PVP · 3D 王牌对决' : 'CO-OP · 双机编队';
    dom.air3dHostName.textContent = state.user?.username || state.guestName;
    const guest = state.air3d.room?.players?.find((player) => player.slot !== state.air3d.slot);
    if (guest) {
      dom.air3dGuestSlot.classList.add('filled');
      dom.air3dGuestSlot.querySelector('b').textContent = guest.name;
      dom.air3dGuestSlot.querySelector('small').textContent = getPlane(guest.plane).name;
    } else {
      dom.air3dGuestSlot.classList.remove('filled');
      dom.air3dGuestSlot.querySelector('b').textContent = '等待接入...';
      dom.air3dGuestSlot.querySelector('small').textContent = state.air3d.mode === 'pvp' ? '挑战者' : '僚机';
    }
  } else {
    dom.air3dLobby.hidden = false;
    dom.air3dWaiting.hidden = true;
  }
}

async function loadAir3DNetwork() {
  if (!state.network) {
    try {
      state.network = await api.network();
    } catch {
      state.network = { urls: [window.location.origin] };
    }
  }
  const urls = [...new Set([...(state.network.urls || []), window.location.origin])].filter(Boolean);
  dom.air3dNetworkList.innerHTML = urls.map((url) => `
    <div class="network-url"><span>${escapeHtml(url)}</span><button type="button" data-air3d-copy="${escapeHtml(url)}">复制</button></div>
  `).join('');
  dom.air3dNetworkList.querySelectorAll('[data-air3d-copy]').forEach((button) => {
    button.addEventListener('click', () => copyText(button.dataset.air3dCopy, '接入地址已复制'));
  });
}

function createAir3DRoom() {
  if (!ensureSocket()) return;
  audio.init();
  state.socket.emit('air3d:create', { mode: state.air3d.selectedMode, ...getProfilePayload() }, (result) => {
    if (!result?.ok) {
      toast(result?.error || '创建 3D 房间失败。', 'error');
      return;
    }
    state.air3d.code = result.code;
    state.air3d.mode = result.mode;
    state.air3d.slot = result.slot;
    state.air3d.room = result.room;
    state.air3d.waiting = true;
    renderAir3DLobby();
    toast(result.mode === 'pvp' ? `3D 对决房间 ${result.code} 已建立。` : `编队房间 ${result.code} 已建立。`);
  });
}

function joinAir3DRoom(code) {
  if (!code || code.length < 4) {
    toast('请输入 5 位房间码。', 'error');
    return;
  }
  if (!ensureSocket()) return;
  audio.init();
  state.socket.emit('air3d:join', { code, ...getProfilePayload() }, (result) => {
    if (!result?.ok) {
      toast(result?.error || '接入 3D 房间失败。', 'error');
      return;
    }
    state.air3d.code = result.code;
    state.air3d.mode = result.mode;
    state.air3d.slot = result.slot;
    state.air3d.room = result.room;
    state.air3d.waiting = false;
    toast('已接入 3D 战场，正在同步数据链...');
  });
}

function cancelAir3DRoom() {
  state.socket?.emit('air3d:leave');
  resetAir3DState();
  renderAir3DLobby();
  toast('3D 房间已关闭。');
}

function copyAir3DInvite() {
  const url = new URL(window.location.href);
  url.searchParams.set('air3d', state.air3d.code || '');
  copyText(`${url.toString()}  房间码：${state.air3d.code}`, '3D 邀请链接已复制');
}

function resetAir3DState() {
  clearAir3DCountdown();
  if (state.air3d.mission) {
    state.air3d.mission.destroy();
    state.air3d.mission = null;
  }
  if (state.mission && state.mission.network) state.mission = null;
  state.air3d.code = null;
  state.air3d.room = null;
  state.air3d.slot = null;
  state.air3d.mode = null;
  state.air3d.waiting = false;
  state.air3d.active = false;
  state.air3d.resultSent = false;
}

function cleanupAir3D() {
  state.socket?.emit('air3d:leave');
  stopRadarLoop();
  resetAir3DState();
  if (dom.missionLanCountdown) dom.missionLanCountdown.hidden = true;
}

function clearAir3DCountdown() {
  if (state.air3d.countdownTimer) {
    clearInterval(state.air3d.countdownTimer);
    state.air3d.countdownTimer = null;
  }
}

function prepareAir3DMatch(payload) {
  if (!payload) return;
  cleanupSingleGame();
  cleanupMission3D();
  const slot = state.air3d.slot == null ? 0 : state.air3d.slot;
  const opponent = payload.players?.find((player) => player.slot !== slot) || {
    name: 'WINGMAN',
    plane: 'falcon',
    skin: 'chrome'
  };
  state.air3d.active = true;
  state.air3d.resultSent = false;
  state.air3d.mode = payload.mode;
  state.air3d.room = payload;
  state.air3d.waiting = false;
  showScreen('mission3d');

  const oldCanvas = dom.missionCanvas;
  const freshCanvas = oldCanvas.cloneNode(false);
  oldCanvas.replaceWith(freshCanvas);
  dom.missionCanvas = freshCanvas;

  dom.missionBriefing.hidden = true;
  dom.missionPause.hidden = true;
  dom.missionEnd.hidden = true;
  dom.missionHud.hidden = true;
  dom.missionMessage.hidden = true;
  dom.missileWarning.hidden = true;
  dom.missionTargetMarker.hidden = true;
  dom.missionKillfeed.innerHTML = '';
  dom.missionCloudOverlay.style.opacity = '0';
  dom.missionCoverBadge.hidden = true;
  dom.missionDamageVignette.classList.remove('on');
  dom.missionHitFlash.classList.remove('on');
  dom.missionPvpBanner.hidden = true;
  dom.missionWingmanBadge.hidden = true;
  dom.missionKillcountWrap.style.display = '';
  dom.missionLanMode.textContent = payload.mode === 'pvp' ? '3D DOGFIGHT' : '3D CO-OP';
  dom.missionLanSub.textContent = payload.mode === 'pvp' ? '同步对手数据' : '同步编队数据链';
  dom.missionLanCountdown.hidden = false;

  let mission;
  try {
    mission = new Mission3D({
      canvas: dom.missionCanvas,
      plane: state.selectedPlane,
      skin: state.selectedSkin,
      network: {
        role: slot === 0 ? 'host' : 'guest',
        mode: payload.mode,
        opponent
      },
      callbacks: {
        onHud: updateMissionHud,
        onEvent: handleMissionEvent,
        onEnd: handleAir3DMissionEnd,
        onPauseRequest: () => toast('3D 联机对战中无法暂停。', 'error'),
        onNetworkState: (networkState) => state.socket?.emit('air3d:state', networkState),
        onNetworkSnapshot: (snapshot) => state.socket?.emit('air3d:snapshot', snapshot),
        onNetworkEnemyHit: (hit) => state.socket?.emit('air3d:enemyHit', hit),
        onNetworkPvpHit: (hit) => state.socket?.emit('air3d:pvpHit', hit),
        onNetworkFx: (fx) => state.socket?.emit('air3d:fx', fx)
      }
    });
  } catch (error) {
    console.error(error);
    toast('无法启动 3D 联机渲染，请确认浏览器已启用 WebGL。', 'error', 5000);
    cleanupAir3D();
    showScreen('air3d');
    return;
  }
  state.mission = mission;
  state.air3d.mission = mission;
  state.missionHudSnapshot = null;
  startAir3DCountdown(payload.startAt, payload.mode);
}

function startAir3DCountdown(startAt, mode) {
  clearAir3DCountdown();
  const end = Number(startAt) || Date.now() + 3600;
  let last = null;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    dom.missionLanCount.textContent = remaining > 0 ? remaining : 'GO';
    if (remaining !== last && remaining > 0) {
      last = remaining;
      audio.countdown(remaining === 1);
    }
    if (remaining <= 0) {
      clearAir3DCountdown();
    }
  };
  tick();
  state.air3d.countdownTimer = window.setInterval(tick, 100);
}

function startAir3DMatch() {
  if (!state.air3d.mission || state.air3d.mission.state !== 'briefing') return;
  clearAir3DCountdown();
  dom.missionLanCountdown.hidden = true;
  dom.missionHud.hidden = false;
  state.air3d.mission.start();
  startRadarLoop();
  audio.init();
  updateSoundUI();
}

function handleAir3DMissionEnd(result) {
  if (!state.air3d.active) {
    handleMissionEnd(result);
    return;
  }
  if (state.air3d.slot === 0 && !state.air3d.resultSent) {
    state.air3d.resultSent = true;
    const guestSuccess = result.networkMode === 'pvp' ? !result.success : result.success;
    state.socket?.emit('air3d:end', { ...result, guestSuccess });
  }
  showAir3DResult(result, result.success);
}

function handleAir3DEndFromHost(payload) {
  if (!state.air3d.active) return;
  const guestResult = { ...payload, success: payload.guestSuccess ?? !payload.success };
  if (state.air3d.mission) {
    state.air3d.mission.state = 'ended';
    state.air3d.mission.paused = false;
    audio.stopFlightEngine();
  }
  showAir3DResult(guestResult, guestResult.success);
}

function showAir3DResult(result, success) {
  stopRadarLoop();
  dom.missionHud.hidden = true;
  dom.missionPause.hidden = true;
  dom.missileWarning.hidden = true;
  dom.missionTargetMarker.hidden = true;
  dom.missionMessage.hidden = true;
  dom.missionCloudOverlay.style.opacity = '0';
  dom.missionCoverBadge.hidden = true;
  dom.missionPvpBanner.hidden = true;
  dom.missionWingmanBadge.hidden = true;
  dom.missionLanCountdown.hidden = true;
  dom.missionKillcountWrap.style.display = '';
  dom.missionEnd.hidden = false;
  dom.missionEnd.classList.toggle('is-success', success);
  dom.missionEnd.classList.toggle('is-failure', !success);
  const pvp = Boolean(result.pvp);
  dom.missionEndEyebrow.textContent = pvp ? (success ? 'DOGFIGHT VICTORY' : 'DOGFIGHT DEFEAT') : (success ? 'FORMATION COMPLETE' : 'FORMATION LOST');
  dom.missionEndMark.innerHTML = `<span>${success ? '✓' : '×'}</span>`;
  dom.missionEndTitle.textContent = pvp ? (success ? '对决胜利' : '对决失利') : (success ? '编队任务完成' : '编队任务失败');
  dom.missionEndSubtitle.textContent = pvp
    ? (success ? '你赢下了这场 3D 王牌对决。' : '对手赢下了这次交锋。调整机体与战术再来。')
    : (success ? '双机编队完成空域清理，敌方编队全灭。' : '编队任务失败。与僚机重新规划进攻路线。');
  const pvpSelfHp = state.air3d.slot === 0 ? result.pvpHostHp ?? result.hp : result.pvpGuestHp ?? 0;
  dom.missionEndGrid.innerHTML = `
    <div class="mission-end-stat"><span>SCORE</span><b>${formatNumber(result.score)}</b></div>
    <div class="mission-end-stat"><span>${pvp ? '结构值' : '击落'}</span><b>${pvp ? `${pvpSelfHp}%` : `${result.kills} / ${result.required || 6}`}</b></div>
    <div class="mission-end-stat"><span>剩余时间</span><b>${formatTime(result.timeLeft)}</b></div>
    <div class="mission-end-stat"><span>命中率</span><b>${Math.round((result.accuracy || 0) * 100)}%</b></div>
  `;
  dom.missionEndExtra.innerHTML = `
    <span>${result.networkMode === 'pvp' ? '3D DOGFIGHT' : 'CO-OP SORTIE'}</span>
    <i></i>
    <span>僚机/对手：${escapeHtml(state.air3d.room?.players?.find((player) => player.slot !== state.air3d.slot)?.name || '未知')}</span>
  `;
  dom.missionEndActions.innerHTML = '';
  const lobby = makeActionButton('返回 3D 大厅', 'LAN LOBBY', true, () => {
    cleanupAir3D();
    openAir3DLobby();
  });
  const home = makeActionButton('返回基地', 'HOME', false, () => {
    cleanupAir3D();
    goHome();
  });
  dom.missionEndActions.append(lobby, home);
  audio.stopFlightEngine();
}

function goHome() {
  hideAllModals();
  cleanupSingleGame();
  cleanupAir3D();
  cleanupMission3D();
  if (state.duel.game) {
    leaveDuelCompletely();
  } else if (state.duel.waiting) {
    state.socket?.emit('duel:leave');
    resetDuelState();
  }
  showScreen('home');
  audio.startAmbience('menu');
}

function updateUserUI() {
  const user = state.user;
  const name = user?.username || state.guestName;
  dom.playerName.textContent = name;
  dom.playerSub.textContent = user ? `✦ ${formatNumber(user.credits)} 星尘 · 王牌档案已同步` : '登录以同步战绩';
  dom.avatar.textContent = (name[0] || 'G').toUpperCase();
  dom.hangarCredits.textContent = formatNumber(user?.credits || 0);
  renderHome();
}

function renderHome() {
  const user = state.user;
  const guest = state.guestStats;
  const missionStats = safeRead('sky_strike_mission_stats', { best: 0, runs: 0, kills: 0, clears: 0 });
  dom.homeBest.textContent = formatNumber(user?.bestMission ?? missionStats.best ?? 0);
  dom.homeStage.textContent = formatNumber(user ? user.games : missionStats.runs || 0);
  dom.homeKills.textContent = formatNumber(user?.totalKills ?? (guest.kills || 0) + (missionStats.kills || 0));
  const plane = getPlane(state.selectedPlane);
  dom.heroPlaneName.textContent = plane.name;
  heroScene?.setLook(state.selectedPlane, state.selectedSkin);
}

async function refreshMe() {
  if (!api.token) return;
  try {
    const user = await api.me();
    if (user) {
      state.user = user;
      state.selectedPlane = getPlane(user.equippedPlane).id;
      state.selectedSkin = getSkin(user.equippedSkin).id;
      saveLoadout();
      updateUserUI();
      if (state.currentScreen === 'hangar') renderHangar();
    }
  } catch (error) {
    if (error.status !== 401) {
      // Offline play is still possible; no need to interrupt the menu.
    }
  }
}

async function refreshOnline() {
  try {
    const data = await api.catalog();
    state.catalog = data;
    const count = data.online || 0;
    dom.onlineCount.textContent = count;
    dom.duelOnline.textContent = count;
    dom.air3dOnline.textContent = count;
  } catch {
    dom.onlineCount.textContent = '--';
    dom.duelOnline.textContent = '--';
    dom.air3dOnline.textContent = '--';
  }
}

function saveLoadout() {
  safeWrite(STORAGE.loadout, { plane: state.selectedPlane, skin: state.selectedSkin });
}

function ownedPlanes() {
  return state.user ? state.user.ownedPlanes : [...FREE_PLANES];
}

function ownedSkins() {
  return state.user ? state.user.ownedSkins : [...FREE_SKINS];
}

function isPlaneOwned(id) {
  return ownedPlanes().includes(id);
}

function isSkinOwned(id) {
  return ownedSkins().includes(id);
}

function openAuth(tab = 'login', afterAuth = null) {
  state.afterAuth = afterAuth;
  setAuthTab(tab);
  dom.authError.textContent = '';
  dom.authPassword.value = '';
  dom.authModal.hidden = false;
  window.setTimeout(() => dom.authUsername.focus(), 120);
}

function setAuthTab(tab) {
  state.authMode = tab === 'register' ? 'register' : 'login';
  $$('.auth-tabs button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.authTab === state.authMode);
  });
  $('#auth-title').textContent = state.authMode === 'register' ? '注册飞行员呼号' : '接入飞行员网络';
  dom.authSubmit.querySelector('span').textContent = state.authMode === 'register' ? '创建飞行员档案' : '接入网络';
  dom.authSubmit.querySelector('small').textContent = state.authMode === 'register' ? 'REGISTER' : 'CONNECT';
  dom.authPassword.autocomplete = state.authMode === 'register' ? 'new-password' : 'current-password';
  dom.authError.textContent = '';
}

async function submitAuth(event) {
  event.preventDefault();
  if (!dom.authForm.reportValidity()) return;
  const username = dom.authUsername.value.trim();
  const password = dom.authPassword.value;
  dom.authError.textContent = '';
  dom.authSubmit.disabled = true;
  const previousLabel = dom.authSubmit.querySelector('span').textContent;
  dom.authSubmit.querySelector('span').textContent = '正在握手...';
  try {
    const user = state.authMode === 'register'
      ? await api.register(username, password)
      : await api.login(username, password);
    state.user = user;
    state.selectedPlane = getPlane(user.equippedPlane).id;
    state.selectedSkin = getSkin(user.equippedSkin).id;
    saveLoadout();
    hideModal('auth-modal');
    updateUserUI();
    if (state.currentScreen === 'hangar') renderHangar();
    if (state.currentScreen === 'leaderboard') loadLeaderboard();
    if (state.currentScreen === 'duel') renderDuelLobby();
    toast(state.authMode === 'register' ? `飞行员 ${user.username}，欢迎加入天空。` : `欢迎回来，${user.username}。`);
    audio.ui();
    const callback = state.afterAuth;
    state.afterAuth = null;
    if (callback) window.setTimeout(callback, 120);
  } catch (error) {
    dom.authError.textContent = error.message;
    audio.error();
  } finally {
    dom.authSubmit.disabled = false;
    dom.authSubmit.querySelector('span').textContent = previousLabel;
  }
}

function openAccountModal() {
  if (!state.user) {
    openAuth('login');
    return;
  }
  const user = state.user;
  const joined = new Date(user.createdAt).toLocaleDateString('zh-CN');
  dom.accountDossier.innerHTML = `
    <div class="dossier-head">
      <span class="avatar">${escapeHtml((user.username[0] || 'P').toUpperCase())}</span>
      <div><b>${escapeHtml(user.username)}</b><small>注册于 ${escapeHtml(joined)} · 星尘 ${formatNumber(user.credits)}</small></div>
    </div>
    <div class="dossier-grid">
      <div class="dossier-stat"><span>无尽最高积分</span><b>${formatNumber(user.bestEndless)}</b></div>
      <div class="dossier-stat"><span>远征最高积分</span><b>${formatNumber(user.bestCampaign)}</b></div>
      <div class="dossier-stat"><span>已解锁空域</span><b>${pad2(user.campaignStage)}</b></div>
      <div class="dossier-stat"><span>累计击落</span><b>${formatNumber(user.totalKills)}</b></div>
      <div class="dossier-stat"><span>出击次数</span><b>${formatNumber(user.games)}</b></div>
      <div class="dossier-stat"><span>无尽排名</span><b>${user.rankEndless ? `#${user.rankEndless}` : '未上榜'}</b></div>
    </div>
  `;
  dom.accountActions.innerHTML = `
    <button class="btn btn-ghost" data-account-action="hangar"><span>战备机库</span></button>
    <button class="btn btn-ghost" data-account-action="ranks"><span>积分档案</span></button>
    <button class="btn btn-ghost danger-outline" data-account-action="logout"><span>退出登录</span></button>
  `;
  dom.accountActions.querySelectorAll('[data-account-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.accountAction;
      hideModal('account-modal');
      if (action === 'hangar') openHangar();
      else if (action === 'ranks') openLeaderboard();
      else if (action === 'logout') logout();
    });
  });
  dom.accountModal.hidden = false;
}

function logout() {
  api.logout();
  state.user = null;
  state.selectedPlane = getPlane(localLoadout.plane).id;
  state.selectedSkin = getSkin(localLoadout.skin).id;
  updateUserUI();
  toast('已退出飞行员网络。访客模式仍可出击。');
  if (state.currentScreen === 'hangar') renderHangar();
}

function openHangar() {
  if (!isPlaneOwned(state.selectedPlane)) state.selectedPlane = 'falcon';
  if (!isSkinOwned(state.selectedSkin)) state.selectedSkin = 'chrome';
  hideAllModals();
  showScreen('hangar');
}

function renderHangar() {
  const plane = getPlane(state.selectedPlane);
  const skin = getSkin(state.selectedSkin);
  dom.hangarPlaneCode.textContent = plane.code;
  dom.hangarPlaneName.textContent = plane.name;
  dom.hangarPlaneTagline.textContent = plane.tagline;
  dom.hangarSkinBadge.textContent = skin.name;
  dom.hangarCredits.textContent = formatNumber(state.user?.credits || 0);
  dom.skinCount.textContent = `${SKINS.length} COATINGS`;

  const statLabels = { handling: '机动', speed: '速度', power: '火力', armor: '装甲' };
  dom.hangarStats.innerHTML = Object.entries(plane.stats)
    .map(([key, value]) => `
      <div class="stat-row">
        <span>${statLabels[key] || key}</span>
        <div class="stat-track"><i style="width:${value * 20}%"></i></div>
        <b>${value}</b>
      </div>
    `)
    .join('');

  hangarScene?.setLook(state.selectedPlane, state.selectedSkin);

  dom.planeList.innerHTML = PLANES.map((item) => {
    const owned = isPlaneOwned(item.id);
    const active = item.id === state.selectedPlane;
    return `
      <button class="plane-card ${active ? 'is-active' : ''} ${owned ? '' : 'is-locked'}" data-plane="${item.id}">
        <canvas class="plane-thumb" data-thumb="${item.id}"></canvas>
        <span class="plane-card-info">
          <b>${escapeHtml(item.name)}</b>
          <small>${escapeHtml(item.role)} · ${escapeHtml(item.code.split(' / ')[0])}</small>
        </span>
        ${owned ? '' : `<span class="lock-chip">✦ ${formatNumber(item.price)}</span>`}
      </button>
    `;
  }).join('');

  dom.skinGrid.innerHTML = SKINS.map((item) => {
    const owned = isSkinOwned(item.id);
    const active = item.id === state.selectedSkin;
    let stateLabel = '';
    if (active) stateLabel = '<span class="skin-state equipped">已装备</span>';
    else if (owned) stateLabel = '<span class="skin-state">已拥有</span>';
    else if (item.unlock === 'purchase') stateLabel = `<span class="skin-state">✦ ${formatNumber(item.price)}</span>`;
    else stateLabel = '<span class="skin-state">兑换码</span>';
    const animatedClass = item.animated === 'aurora' ? 'aurora' : '';
    return `
      <button class="skin-card ${active ? 'is-active' : ''}" data-skin="${item.id}" title="${escapeHtml(item.desc)}">
        <span class="skin-swatch ${animatedClass}" style="--swatch-a:${item.palette.body};--swatch-b:${item.palette.accent};--swatch-c:${item.palette.dark}"></span>
        <span class="skin-card-info">
          <b>${escapeHtml(item.name)}</b>
          <small>${escapeHtml(item.rarity)}</small>
        </span>
        ${stateLabel}
      </button>
    `;
  }).join('');

  requestAnimationFrame(() => {
    dom.planeList.querySelectorAll('[data-thumb]').forEach((canvas) => {
      drawShipThumbnail(canvas, canvas.dataset.thumb, state.selectedSkin);
    });
  });

  if (state.currentScreen === 'hangar') {
    hangarScene?.resize();
  }
}

async function selectPlane(id) {
  const plane = getPlane(id);
  if (!isPlaneOwned(id)) {
    if (!state.user) {
      state.afterAuth = () => openHangar();
      openAuth('login');
      return;
    }
    openPurchaseConfirm('plane', plane);
    return;
  }
  state.selectedPlane = plane.id;
  saveLoadout();
  await equipCurrent();
  renderHangar();
}

async function selectSkin(id) {
  const skin = getSkin(id);
  if (!isSkinOwned(id)) {
    if (!state.user) {
      state.afterAuth = () => openHangar();
      openAuth('login');
      return;
    }
    if (skin.unlock === 'purchase') {
      openPurchaseConfirm('skin', skin);
    } else {
      toast('这套涂装藏在加密补给中，需要兑换码才能解锁。', 'info');
      openRedeem();
    }
    return;
  }
  state.selectedSkin = skin.id;
  saveLoadout();
  await equipCurrent();
  renderHangar();
}

async function equipCurrent() {
  if (!state.user) return;
  try {
    state.user = await api.equip(state.selectedPlane, state.selectedSkin);
    updateUserUI();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function openPurchaseConfirm(type, item) {
  if (!state.user) {
    openAuth('login');
    return;
  }
  if (state.user.credits < item.price) {
    toast(`星尘不足，还差 ${formatNumber(item.price - state.user.credits)}。完成出击可以获得星尘。`, 'error');
    return;
  }
  const typeLabel = type === 'plane' ? '战斗机' : '涂装';
  dom.resultEyebrow.textContent = 'HANGAR / 战备采购';
  dom.resultTitle.textContent = `解锁${typeLabel}`;
  dom.resultSubtitle.textContent = `${item.name} · ${item.tagline || item.desc}`;
  dom.resultGrid.innerHTML = `
    <div class="result-stat"><span>所需星尘</span><b>✦ ${formatNumber(item.price)}</b></div>
    <div class="result-stat"><span>当前星尘</span><b>${formatNumber(state.user.credits)}</b></div>
    <div class="result-stat"><span>解锁后</span><b>${formatNumber(state.user.credits - item.price)}</b></div>
  `;
  dom.resultExtra.textContent = '确认后将立即写入你的飞行员档案。';
  dom.resultActions.innerHTML = '';
  const confirm = document.createElement('button');
  confirm.className = 'btn btn-primary';
  confirm.innerHTML = '<span>确认解锁</span><small>UNLOCK</small>';
  const cancel = document.createElement('button');
  cancel.className = 'btn btn-ghost';
  cancel.innerHTML = '<span>返回机库</span>';
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    try {
      state.user = await api.buy(type, item.id);
      if (type === 'plane') state.selectedPlane = item.id;
      else state.selectedSkin = item.id;
      saveLoadout();
      state.user = await api.equip(state.selectedPlane, state.selectedSkin);
      hideModal('result-modal');
      updateUserUI();
      renderHangar();
      toast(`${item.name} 已加入你的战备序列。`);
      audio.redeem();
    } catch (error) {
      toast(error.message, 'error');
      confirm.disabled = false;
    }
  });
  cancel.addEventListener('click', () => hideModal('result-modal'));
  dom.resultActions.append(confirm, cancel);
  dom.resultModal.hidden = false;
}

function openLeaderboard(mode = state.rankMode) {
  state.rankMode = mode;
  $$('.leaderboard-tabs .tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.rankMode === mode);
  });
  hideAllModals();
  showScreen('leaderboard');
}

function openDuel() {
  hideAllModals();
  showScreen('duel');
}

async function loadLeaderboard() {
  const seq = ++state.leaderboardSeq;
  dom.leaderboardList.innerHTML = Array.from({ length: 6 }, () => `
    <div class="leader-row"><span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span></div>
  `).join('');
  try {
    const data = await api.leaderboard(state.rankMode);
    if (seq !== state.leaderboardSeq) return;
    if (!data.rows.length) {
      dom.leaderboardList.innerHTML = `
        <div class="leader-empty">
          <div><b>NO SIGNAL YET</b>天空还没有留下名字。<br>成为第一位上传战绩的王牌。</div>
        </div>
      `;
    } else {
      dom.leaderboardList.innerHTML = data.rows.map((row) => {
        const plane = getPlane(row.plane);
        const skin = getSkin(row.skin);
        return `
          <div class="leader-row ${row.rank <= 3 ? `top-${row.rank}` : ''}">
            <span class="rank-num">${String(row.rank).padStart(2, '0')}</span>
            <span class="leader-pilot">
              <span class="leader-avatar">${escapeHtml((row.username[0] || 'P').toUpperCase())}</span>
              <b>${escapeHtml(row.username)}</b>
            </span>
            <span class="leader-ship">${escapeHtml(plane.name)}<small>${escapeHtml(skin.name)}</small></span>
            <span class="leader-kills">${formatNumber(row.kills)}</span>
            <span class="leader-score">${formatNumber(row.score)}<small>${state.rankMode === 'campaign' ? `SECTOR ${pad2(row.stage || 1)}` : state.rankMode === 'mission' ? '3D SORTIE' : `WAVE ${pad2(row.wave || 1)}`}</small></span>
          </div>
        `;
      }).join('');
    }
    if (data.self?.rank) {
      dom.selfRank.innerHTML = `我的排名 <b>#${data.self.rank}</b> · ${formatNumber(data.self.best)}`;
    } else {
      dom.selfRank.textContent = state.user ? '尚未上榜' : '登录后参与排名';
    }
    dom.leaderboardUpdated.textContent = `SYNC ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    if (seq !== state.leaderboardSeq) return;
    dom.leaderboardList.innerHTML = `<div class="leader-empty"><div><b>SIGNAL LOST</b>暂时无法读取王牌档案。<br>${escapeHtml(error.message)}</div></div>`;
    dom.selfRank.textContent = '--';
  }
}

function openRedeem() {
  dom.redeemError.textContent = '';
  dom.redeemResult.hidden = true;
  dom.redeemResult.innerHTML = '';
  dom.redeemCode.value = '';
  dom.redeemModal.hidden = false;
  window.setTimeout(() => dom.redeemCode.focus(), 120);
}

async function submitRedeem(event) {
  event.preventDefault();
  const code = dom.redeemCode.value.trim();
  if (!code) return;
  if (!state.user) {
    hideModal('redeem-modal');
    state.afterAuth = () => {
      openRedeem();
      dom.redeemCode.value = code;
    };
    openAuth('login');
    toast('兑换加密补给需要先接入飞行员网络。');
    return;
  }
  dom.redeemError.textContent = '';
  dom.redeemResult.hidden = true;
  try {
    const data = await api.redeem(code);
    state.user = data.user;
    updateUserUI();
    dom.redeemResult.hidden = false;
    dom.redeemResult.innerHTML = `<b>${escapeHtml(data.reward.label)}</b><br>${escapeHtml(data.reward.message)}`;
    dom.redeemCode.value = '';
    audio.redeem();
    toast(`兑换成功：${data.reward.rewards.join(' + ')}`);
    if (state.currentScreen === 'hangar') renderHangar();
  } catch (error) {
    dom.redeemError.textContent = error.message;
    audio.error();
  }
}

function registerEasterClick() {
  if (localStorage.getItem(STORAGE.easter) === 'star-map') return;
  state.easterClicks += 1;
  clearTimeout(state.easterTimer);
  state.easterTimer = window.setTimeout(() => {
    state.easterClicks = 0;
  }, 2600);
  if (state.easterClicks >= 7) {
    state.easterClicks = 0;
    localStorage.setItem(STORAGE.easter, 'star-map');
    toast('星图背面浮现出一串坐标：KONAMI。去「彩蛋兑换」看看。', 'info', 6500);
    audio.redeem();
  }
}

function handleInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const air3dCode = params.get('air3d');
  if (air3dCode) {
    const normalized = air3dCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (normalized) {
      window.setTimeout(() => {
        openAir3DLobby();
        dom.air3dRoomCode.value = normalized;
        toast(`已载入 3D 邀请房间 ${normalized}，确认后接入数据链。`, 'info', 4500);
      }, 650);
      return;
    }
  }
  const code = params.get('duel');
  if (!code) return;
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (!normalized) return;
  window.setTimeout(() => {
    openDuel();
    dom.roomCode.value = normalized;
    toast(`已载入邀请房间 ${normalized}，确认后接入战场。`, 'info', 4500);
  }, 650);
}

function getProfilePayload() {
  return {
    name: state.user?.username || state.guestName,
    plane: state.selectedPlane,
    skin: state.selectedSkin
  };
}

function renderDuelLobby() {
  const plane = getPlane(state.selectedPlane);
  const skin = getSkin(state.selectedSkin);
  dom.duelPlaneName.textContent = plane.name;
  dom.duelSkinName.textContent = `${skin.name} · ${plane.role}`;
  if (!dom.duelShipIcon.querySelector('canvas')) {
    const canvas = document.createElement('canvas');
    dom.duelShipIcon.append(canvas);
  }
  drawShipThumbnail(dom.duelShipIcon.querySelector('canvas'), state.selectedPlane, state.selectedSkin);
  if (state.duel.code && state.duel.waiting) {
    dom.waitingRoom.hidden = false;
    dom.duelLobby.hidden = true;
    showWaitingContent();
  } else {
    dom.waitingRoom.hidden = true;
    dom.duelLobby.hidden = false;
  }
}

async function loadNetwork() {
  if (state.network) return;
  try {
    state.network = await api.network();
  } catch {
    state.network = { urls: [window.location.origin] };
  }
  const urls = [...new Set([...(state.network.urls || []), window.location.origin])].filter(Boolean);
  dom.networkList.innerHTML = urls.map((url) => `
    <div class="network-url"><span>${escapeHtml(url)}</span><button type="button" data-copy="${escapeHtml(url)}">复制</button></div>
  `).join('');
  dom.networkList.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', () => copyText(button.dataset.copy, '接入地址已复制'));
  });
}

function showWaitingContent() {
  dom.waitingCode.textContent = state.duel.code || '-----';
  const players = state.duel.room?.players || [];
  const self = players.find((player) => player.slot === state.duel.slot);
  const other = players.find((player) => player.slot !== state.duel.slot);
  dom.hostName.textContent = self?.name || state.user?.username || state.guestName;
  dom.hostSlot.classList.add('filled');
  if (other) {
    dom.guestSlot.classList.add('filled');
    dom.guestSlot.querySelector('b').textContent = other.name;
    dom.guestSlot.querySelector('small').textContent = getPlane(other.plane).name;
  } else {
    dom.guestSlot.classList.remove('filled');
    dom.guestSlot.querySelector('b').textContent = '等待接入...';
    dom.guestSlot.querySelector('small').textContent = '挑战者';
  }
}

function ensureSocket() {
  if (!state.socket || !state.socket.connected) {
    toast('尚未连接对战服务器，请检查网络。', 'error');
    return false;
  }
  return true;
}

function createRoom() {
  if (!ensureSocket()) return;
  audio.init();
  state.socket.emit('duel:create', getProfilePayload(), (result) => {
    if (!result?.ok) {
      toast(result?.error || '创建房间失败。', 'error');
      return;
    }
    state.duel.code = result.code;
    state.duel.slot = result.slot;
    state.duel.room = result.room;
    state.duel.waiting = true;
    dom.duelLobby.hidden = true;
    dom.waitingRoom.hidden = false;
    showWaitingContent();
    toast(`房间 ${result.code} 已创建，等待对手接入。`);
  });
}

function quickMatch() {
  if (!ensureSocket()) return;
  audio.init();
  state.socket.emit('duel:quick', getProfilePayload(), (result) => {
    if (!result?.ok) {
      toast(result?.error || '匹配失败。', 'error');
      return;
    }
    state.duel.code = result.code;
    state.duel.slot = result.slot;
    state.duel.room = result.room;
    state.duel.waiting = Boolean(result.waiting);
    if (result.waiting) {
      dom.duelLobby.hidden = true;
      dom.waitingRoom.hidden = false;
      showWaitingContent();
      toast(`已创建快速匹配房间 ${result.code}，等待另一名飞行员。`);
    }
  });
}

function joinRoom(code) {
  if (!code || code.length < 4) {
    toast('请输入 5 位房间码。', 'error');
    return;
  }
  if (!ensureSocket()) return;
  audio.init();
  state.socket.emit('duel:join', { code, ...getProfilePayload() }, (result) => {
    if (!result?.ok) {
      toast(result?.error || '接入房间失败。', 'error');
      audio.error();
      return;
    }
    state.duel.code = result.code;
    state.duel.slot = result.slot;
    state.duel.room = result.room;
    state.duel.waiting = false;
    toast(`已接入房间 ${result.code}，正在同步战场...`);
  });
}

function cancelRoom() {
  state.socket?.emit('duel:leave');
  resetDuelState();
  dom.waitingRoom.hidden = true;
  dom.duelLobby.hidden = false;
  toast('房间已关闭。');
}

async function copyInvite() {
  const url = new URL(window.location.href);
  url.searchParams.set('duel', state.duel.code || '');
  await copyText(`${url.toString()}  房间码：${state.duel.code}`, '邀请链接已复制');
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast(message);
  }
}

function initSocket() {
  if (!window.io) return;
  const socket = window.io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 700,
    reconnectionDelayMax: 4000
  });
  state.socket = socket;

  socket.on('connect', () => {
    refreshOnline();
    if (state.duel.waiting) toast('已重新连接对战服务器。');
  });

  socket.on('connect_error', () => {
    if (state.currentScreen === 'duel') toast('对战服务器暂时无法连接。', 'error');
  });

  socket.on('disconnect', () => {
    if (state.duel.game) {
      toast('与对战服务器的连接中断。', 'error', 5000);
    }
    if (state.air3d.active) {
      toast('与 3D 战场服务器的连接中断。', 'error', 5000);
    }
  });

  socket.on('duel:matched', (payload) => {
    state.duel.room = payload;
    state.duel.code = payload.code;
    state.duel.waiting = false;
    if (state.duel.slot == null) {
      const selfName = state.user?.username || state.guestName;
      const own = payload.players.find((player) => player.name === selfName);
      state.duel.slot = own?.slot ?? 0;
    }
    mountDuel(payload);
  });

  socket.on('duel:go', (payload) => {
    clearCountdown();
    dom.countdownOverlay.hidden = true;
    if (!state.duel.game) return;
    state.duel.game.begin();
    if (payload?.scores) state.duel.game.syncScores(payload.scores, payload.round);
    showRoundBanner(`ROUND ${pad2(payload?.round || 1)}`, 'FIGHT');
  });

  socket.on('duel:state', (payload) => {
    state.duel.game?.setRemoteState(payload);
  });

  socket.on('duel:shot', (bullet) => {
    state.duel.game?.addRemoteShot(bullet);
  });

  socket.on('duel:damage', (payload) => {
    if (!state.duel.game) return;
    state.duel.game.syncHp(payload.hp);
    if (payload.targetSlot === state.duel.slot) {
      state.duel.game.shake = Math.max(state.duel.game.shake, 2);
    }
  });

  socket.on('duel:roundend', (payload) => {
    const game = state.duel.game;
    if (!game) return;
    clearCountdown();
    dom.countdownOverlay.hidden = true;
    game.freeze();
    game.syncScores(payload.scores, payload.round);
    game.syncHp(payload.hp);
    const selfWon = payload.winnerSlot === state.duel.slot;
    showRoundBanner(
      selfWon ? 'ROUND WON' : 'ROUND LOST',
      `${payload.scores[state.duel.slot] || 0} : ${payload.scores[1 - state.duel.slot] || 0}`
    );
    if (selfWon) audio.victory();
    else audio.defeat();
    if (payload.matchOver) {
      clearTimeout(state.duel.resultTimer);
      state.duel.resultTimer = window.setTimeout(() => showDuelResult(payload), 1650);
    }
  });

  socket.on('duel:roundstart', (payload) => {
    if (!state.duel.game) return;
    state.duel.game.roundReset(payload.hp, payload.scores, payload.round);
    dom.roundBanner.hidden = true;
    runCountdown(payload.startAt, `ROUND ${pad2(payload.round || 1)} · 准备`);
    toast(`第 ${payload.round} 回合即将开始。`);
  });

  socket.on('duel:rematchvote', (payload) => {
    if (!dom.duelResultModal.hidden) {
      const selfVoted = Array.isArray(payload.votes) && payload.votes.includes(state.duel.slot);
      dom.duelRematchNote.textContent = selfVoted ? '已提交再战申请，等待对手确认...' : '对手已申请再战。';
    }
  });

  socket.on('duel:opponentleft', (payload) => {
    clearDuelTimers();
    if (state.duel.game) {
      state.duel.game.destroy();
      state.duel.game = null;
    }
    resetDuelState();
    hideAllModals();
    toast(payload?.message || '对手已离开战场。', 'error', 4000);
    showScreen('duel');
    audio.startAmbience('menu');
  });

  socket.on('air3d:matched', (payload) => {
    if (!payload) return;
    state.air3d.code = payload.code;
    state.air3d.mode = payload.mode;
    state.air3d.room = payload;
    state.air3d.waiting = false;
    if (state.air3d.slot == null) {
      const selfName = state.user?.username || state.guestName;
      const own = payload.players?.find((player) => player.name === selfName);
      state.air3d.slot = own?.slot ?? 0;
    }
    dom.air3dWaiting.hidden = true;
    dom.air3dLobby.hidden = true;
    prepareAir3DMatch(payload);
  });

  socket.on('air3d:go', () => {
    startAir3DMatch();
  });

  socket.on('air3d:state', (payload) => {
    state.air3d.mission?.setRemotePlayerState(payload);
  });

  socket.on('air3d:snapshot', (payload) => {
    state.air3d.mission?.applyNetworkSnapshot(payload);
  });

  socket.on('air3d:enemyHit', (payload) => {
    state.air3d.mission?.applyNetworkEnemyHit(payload?.id, Number(payload?.damage) || 0);
  });

  socket.on('air3d:pvpHit', (payload) => {
    state.air3d.mission?.applyNetworkPvpHit(Number(payload?.damage) || 0);
  });

  socket.on('air3d:fx', (payload) => {
    state.air3d.mission?.addNetworkFx(payload);
  });

  socket.on('air3d:end', (payload) => {
    handleAir3DEndFromHost(payload || {});
  });

  socket.on('air3d:opponentleft', (payload) => {
    const wasActive = state.air3d.active;
    clearAir3DCountdown();
    resetAir3DState();
    hideAllModals();
    toast(payload?.message || '联机队友已离开 3D 战场。', 'error', 4000);
    if (wasActive) {
      showScreen('air3d');
      renderAir3DLobby();
      audio.startAmbience('menu');
    } else {
      dom.air3dLobby.hidden = false;
      dom.air3dWaiting.hidden = true;
    }
  });
}

function mountDuel(payload) {
  hideAllModals();
  clearDuelTimers();
  if (state.duel.game) {
    state.duel.game.destroy();
    state.duel.game = null;
  }
  dom.duelLobby.hidden = false;
  dom.waitingRoom.hidden = true;
  showScreen('game');
  configureSingleHud();
  dom.gameHud.classList.add('duel-mode');
  dom.pvpScoreboard.hidden = false;
  dom.hudModeLabel.textContent = 'LAN DUEL';
  dom.hudStageLabel.textContent = '王牌对决';
  const opponent = payload.players.find((player) => player.slot !== state.duel.slot) || {
    name: '敌方飞行员',
    plane: 'falcon',
    skin: 'chrome'
  };
  state.duel.names = {
    self: payload.players.find((player) => player.slot === state.duel.slot)?.name || state.user?.username || state.guestName,
    foe: opponent.name
  };
  dom.pvpSelfName.textContent = state.duel.names.self;
  dom.pvpFoeName.textContent = state.duel.names.foe;
  dom.pvpSelfScore.textContent = payload.scores?.[state.duel.slot] || 0;
  dom.pvpFoeScore.textContent = payload.scores?.[1 - state.duel.slot] || 0;
  dom.hudPlaneName.textContent = getPlane(state.selectedPlane).name;
  dom.countdownOverlay.hidden = false;
  dom.roundBanner.hidden = true;
  dom.bossHud.hidden = true;

  const game = new DuelGame({
    canvas: dom.gameCanvas,
    slot: state.duel.slot,
    plane: state.selectedPlane,
    skin: state.selectedSkin,
    opponent,
    callbacks: {
      onHud: updateDuelHud,
      onState: (payloadState) => state.socket?.emit('duel:state', payloadState),
      onShot: (bullet) => state.socket?.emit('duel:shot', bullet),
      onDamage: () => state.socket?.emit('duel:damage', { amount: PVP.damage }),
      onPauseRequest: () => toast('局域网对决中无法暂停。', 'error')
    }
  });
  state.duel.game = game;
  if (payload.scores) game.syncScores(payload.scores, payload.round);
  runCountdown(payload.startAt, payload.rematch ? '再战即将开始' : '同步战场数据');
  audio.startAmbience('combat');
  if (payload.rematch) toast('对手接受再战，准备下一场对决。');
}

function updateDuelHud(snapshot) {
  if (!snapshot) return;
  const ratio = Math.max(0, snapshot.hp / snapshot.maxHp);
  dom.hudHpFill.style.transform = `scaleX(${ratio})`;
  dom.hudHpText.textContent = `${snapshot.hp} / ${snapshot.maxHp}`;
  dom.hudShieldWrap.classList.remove('on');
  dom.pvpSelfScore.textContent = snapshot.selfScore;
  dom.pvpFoeScore.textContent = snapshot.foeScore;
  if (snapshot.hp < snapshot.maxHp * 0.3) {
    dom.hudHpFill.style.background = 'linear-gradient(90deg, #ff355a, #ff889c)';
  } else {
    dom.hudHpFill.style.background = '';
  }
}

function runCountdown(startAt, subtitle) {
  clearCountdown();
  const end = Number(startAt) || Date.now() + 3000;
  dom.countdownOverlay.hidden = false;
  dom.countdownSub.textContent = subtitle || '同步战场数据';
  let lastValue = null;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    dom.countdownValue.textContent = remaining > 0 ? remaining : 'GO';
    if (remaining !== lastValue && remaining > 0) {
      lastValue = remaining;
      audio.countdown(remaining === 1);
    }
    if (remaining <= 0) {
      window.clearInterval(state.duel.countdownTimer);
      state.duel.countdownTimer = null;
    }
  };
  tick();
  state.duel.countdownTimer = window.setInterval(tick, 120);
}

function clearCountdown() {
  if (state.duel.countdownTimer) {
    clearInterval(state.duel.countdownTimer);
    state.duel.countdownTimer = null;
  }
}

function showDuelResult(payload) {
  if (!state.duel.game) return;
  state.duel.game.freeze();
  const selfScore = payload.scores[state.duel.slot] || 0;
  const foeScore = payload.scores[1 - state.duel.slot] || 0;
  const won = selfScore > foeScore;
  dom.duelResultEyebrow.textContent = won ? 'ACE OF THE SKY' : 'SIGNAL LOST';
  dom.duelResultTitle.textContent = won ? '你赢得了这场对决' : '天空记住了这次失利';
  dom.duelResultSubtitle.textContent = won
    ? '对手的战机坠入云海。王牌，只留一个。'
    : '重新校准你的航路，下一次把天空夺回来。';
  dom.duelFinalScore.innerHTML = `
    <span class="${won ? 'win' : 'lose'}">${selfScore}</span>
    <span>:</span>
    <span class="${won ? 'lose' : 'win'}">${foeScore}</span>
  `;
  dom.duelRematchNote.textContent = '双方都申请后，将立刻开始新的对决。';
  dom.duelResultActions.innerHTML = '';
  const rematch = document.createElement('button');
  rematch.className = 'btn btn-primary';
  rematch.innerHTML = '<span>申请再战</span><small>REMATCH</small>';
  rematch.addEventListener('click', () => {
    state.socket?.emit('duel:rematch');
    rematch.disabled = true;
    dom.duelRematchNote.textContent = '已提交再战申请，等待对手确认...';
  });
  const leave = document.createElement('button');
  leave.className = 'btn btn-ghost';
  leave.innerHTML = '<span>返回对决大厅</span>';
  leave.addEventListener('click', () => {
    state.socket?.emit('duel:leave');
    resetDuelState();
    hideModal('duel-result-modal');
    if (state.duel.game) {
      state.duel.game.destroy();
      state.duel.game = null;
    }
    showScreen('duel');
    audio.startAmbience('menu');
  });
  dom.duelResultActions.append(rematch, leave);
  dom.duelResultModal.hidden = false;
}

function showRoundBanner(kicker, text) {
  dom.roundBannerKicker.textContent = kicker || '';
  dom.roundBannerText.textContent = text || '';
  dom.roundBanner.hidden = false;
  clearTimeout(state.duel.bannerTimer);
  state.duel.bannerTimer = window.setTimeout(() => {
    dom.roundBanner.hidden = true;
  }, 1700);
}

function clearDuelTimers() {
  clearCountdown();
  clearTimeout(state.duel.resultTimer);
  clearTimeout(state.duel.bannerTimer);
  state.duel.resultTimer = null;
  state.duel.bannerTimer = null;
}

function resetDuelState() {
  clearDuelTimers();
  if (state.duel.game) {
    state.duel.game.destroy();
    state.duel.game = null;
  }
  state.duel.code = null;
  state.duel.slot = null;
  state.duel.room = null;
  state.duel.waiting = false;
  state.duel.names = null;
  dom.pvpScoreboard.hidden = true;
  dom.gameHud.classList.remove('duel-mode');
}

function leaveDuelCompletely() {
  state.socket?.emit('duel:leave');
  resetDuelState();
  hideModal('duel-result-modal');
  dom.countdownOverlay.hidden = true;
  dom.roundBanner.hidden = true;
}

function startSingle(mode, options = {}) {
  if (state.duel.game) leaveDuelCompletely();
  cleanupSingleGame();
  hideAllModals();
  audio.init();
  state.gameMode = mode;
  const stage = mode === 'campaign'
    ? Math.max(1, Number(options.stage) || getCampaignStartStage())
    : 1;
  showScreen('game');
  configureSingleHud();
  dom.gameHud.classList.remove('duel-mode');
  dom.pvpScoreboard.hidden = true;
  dom.hudModeLabel.textContent = mode === 'campaign' ? 'CAMPAIGN' : 'ENDLESS SORTIE';
  dom.hudStageLabel.textContent = mode === 'campaign' ? `空域 ${pad2(stage)}` : '无限战斗';
  dom.hudScore.textContent = '0';
  dom.hudKills.textContent = '0';
  dom.hudTime.textContent = '00:00';
  dom.hudCombo.textContent = 'x1.0';
  dom.hudCombo.classList.remove('hot');
  dom.hudPlaneName.textContent = getPlane(state.selectedPlane).name;
  dom.hudHpText.textContent = `${getPlane(state.selectedPlane).loadout.hp} / ${getPlane(state.selectedPlane).loadout.hp}`;
  dom.hudHpFill.style.transform = 'scaleX(1)';
  dom.hudHpFill.style.background = '';
  dom.hudShieldWrap.classList.remove('on');
  dom.bossHud.hidden = true;
  dom.countdownOverlay.hidden = true;
  dom.roundBanner.hidden = true;
  dom.controlHint.style.display = '';

  const game = new CombatGame({
    canvas: dom.gameCanvas,
    mode,
    stage,
    plane: state.selectedPlane,
    skin: state.selectedSkin,
    callbacks: {
      onHud: updateSingleHud,
      onEnd: (result) => showGameOver(result),
      onStageClear: (result) => showStageClear(result),
      onBanner: (banner) => showRoundBanner(banner.kicker, banner.text),
      onPauseRequest: requestPause
    }
  });
  state.game = game;
  game.start();
}

function getCampaignStartStage() {
  return Math.max(1, state.user?.campaignStage || state.guestStats.campaignStage || 1);
}

function configureSingleHud() {
  dom.bossHud.hidden = true;
  dom.pvpScoreboard.hidden = true;
  dom.gameHud.classList.remove('duel-mode');
  dom.hudCombo.style.visibility = '';
  dom.controlHint.style.display = '';
}

function openMission3D({ autoStart = false } = {}) {
  hideAllModals();
  cleanupSingleGame();
  cleanupMission3D();
  if (state.duel.game) leaveDuelCompletely();
  showScreen('mission3d');

  const oldCanvas = dom.missionCanvas;
  const freshCanvas = oldCanvas.cloneNode(false);
  oldCanvas.replaceWith(freshCanvas);
  dom.missionCanvas = freshCanvas;

  dom.missionBriefing.hidden = autoStart;
  dom.missionPause.hidden = true;
  dom.missionEnd.hidden = true;
  dom.missionHud.hidden = true;
  dom.missionMessage.hidden = true;
  dom.missileWarning.hidden = true;
  dom.missionTargetMarker.hidden = true;
  dom.missionKillfeed.innerHTML = '';
  dom.missionDamageVignette.classList.remove('on');
  dom.missionHitFlash.classList.remove('on');
  dom.missionCloudOverlay.style.opacity = '0';
  dom.missionCoverBadge.hidden = true;
  dom.missionPvpBanner.hidden = true;
  dom.missionWingmanBadge.hidden = true;
  dom.missionKillcountWrap.style.display = '';
  dom.missionLanCountdown.hidden = true;
  dom.missionTargetMarker.classList.remove('is-locked', 'is-in-reticle');

  const plane = getPlane(state.selectedPlane);
  const skin = getSkin(state.selectedSkin);
  dom.missionBriefPlane.textContent = `${plane.name} · ${skin.name}`;
  dom.missionPlaneName.textContent = plane.code;
  dom.missionRequired.textContent = '6';
  dom.missionKills.textContent = '0';
  dom.missionTimer.textContent = '03:00';
  dom.missionSpeed.textContent = '000';
  dom.missionAlt.textContent = '0330';
  dom.missionMach.textContent = '0.4';
  dom.missionG.textContent = '1.0';
  dom.missionHpText.textContent = '100';
  dom.missionHpFill.style.transform = 'scaleX(1)';
  dom.missionMissiles.textContent = '06';
  dom.missionFlares.textContent = '03';
  dom.missionBoost.textContent = '100';
  dom.missionLockStatus.textContent = 'NO TARGET';
  dom.missionLockFill.style.width = '0%';
  dom.missionLockHint.textContent = '将目标保持在准星内锁定，或先发射导弹再制导';
  dom.missionCrosshair.classList.remove('is-locked', 'hit');
  dom.missionRadarCount.textContent = '4 CONTACTS';

  try {
    state.mission = new Mission3D({
      canvas: dom.missionCanvas,
      plane: state.selectedPlane,
      skin: state.selectedSkin,
      callbacks: {
        onHud: updateMissionHud,
        onEnd: handleMissionEnd,
        onEvent: handleMissionEvent,
        onPauseRequest: openMissionPause
      }
    });
  } catch (error) {
    state.mission = null;
    console.error(error);
    toast('无法启动 3D 渲染，请确认浏览器已启用 WebGL。', 'error', 5000);
    showScreen('home');
    return;
  }

  if (autoStart) {
    window.setTimeout(() => startMission3D(), 80);
  }
}

function startMission3D() {
  if (!state.mission || state.mission.state !== 'briefing') return;
  audio.init();
  state.missionResult = null;
  dom.missionBriefing.hidden = true;
  dom.missionHud.hidden = false;
  dom.missionEnd.hidden = true;
  dom.missionPause.hidden = true;
  state.mission.start();
  startRadarLoop();
  updateSoundUI();
}

function cleanupMission3D() {
  stopRadarLoop();
  if (state.mission) {
    state.mission.destroy();
    state.mission = null;
  }
  clearTimeout(state.missionMessageTimer);
  clearTimeout(state.missionKillTimer);
  state.missionMessageTimer = null;
  state.missionKillTimer = null;
  state.missionHudSnapshot = null;
  audio.stopFlightEngine();
  if (!dom.missionHud) return;
  dom.missionHud.hidden = true;
  dom.missionPause.hidden = true;
  dom.missionEnd.hidden = true;
  dom.missileWarning.hidden = true;
  dom.missionTargetMarker.hidden = true;
  dom.missionMessage.hidden = true;
  dom.missionKillfeed.innerHTML = '';
  dom.missionDamageVignette.classList.remove('on');
  dom.missionHitFlash.classList.remove('on');
  dom.missionCloudOverlay.style.opacity = '0';
  dom.missionCoverBadge.hidden = true;
  dom.missionPvpBanner.hidden = true;
  dom.missionWingmanBadge.hidden = true;
  dom.missionKillcountWrap.style.display = '';
  dom.missionLanCountdown.hidden = true;
  dom.missionActionButtons.forEach((button) => button.classList.remove('is-pressed'));
}

function openMissionPause() {
  if (state.air3d.active) {
    toast('3D 联机对战中无法暂停。', 'error');
    return;
  }
  const mission = state.mission;
  if (!mission || mission.state !== 'playing' || mission.paused) return;
  mission.pause();
  mission.mobileCannon = false;
  mission.mobileBoost = false;
  dom.missionActionButtons.forEach((button) => button.classList.remove('is-pressed'));
  dom.missionStickKnob.style.transform = 'translate(0, 0)';
  dom.missionStick.classList.remove('is-active');
  audio.stopFlightEngine();
  const snapshot = state.missionHudSnapshot || {};
  dom.missionPauseStats.innerHTML = `
    <div><span>剩余时间</span><b>${formatTime(snapshot.timeLeft ?? 180)}</b></div>
    <div><span>击落</span><b>${snapshot.kills ?? 0} / ${snapshot.required ?? 6}</b></div>
    <div><span>结构完整度</span><b>${snapshot.hp ?? 100}%</b></div>
    <div><span>当前积分</span><b>${formatNumber(snapshot.score || 0)}</b></div>
  `;
  dom.missionPause.hidden = false;
  updateSoundUI();
}

function resumeMission3D() {
  if (!state.mission) return;
  dom.missionPause.hidden = true;
  state.mission.resume();
  if (audio.enabled) audio.startFlightEngine();
}

function restartMission3D() {
  dom.missionPause.hidden = true;
  cleanupMission3D();
  openMission3D({ autoStart: true });
}

function exitMission3D() {
  dom.missionPause.hidden = true;
  dom.missionEnd.hidden = true;
  goHome();
}

function bindMissionControls() {
  let stickPointer = null;
  const updateStick = (event) => {
    if (!dom.missionStick) return;
    const rect = dom.missionStick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const max = rect.width * 0.34;
    let x = (event.clientX - centerX) / max;
    let y = -(event.clientY - centerY) / max;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    if (state.mission) state.mission.setStick(x, y);
    dom.missionStickKnob.style.transform = `translate(${x * max}px, ${-y * max}px)`;
  };

  dom.missionStick.addEventListener('pointerdown', (event) => {
    if (!state.mission || state.mission.state !== 'playing' || state.mission.paused) return;
    stickPointer = event.pointerId;
    dom.missionStick.setPointerCapture?.(event.pointerId);
    dom.missionStick.classList.add('is-active');
    updateStick(event);
    event.preventDefault();
  });
  dom.missionStick.addEventListener('pointermove', (event) => {
    if (stickPointer == null || event.pointerId !== stickPointer) return;
    updateStick(event);
    event.preventDefault();
  });
  const releaseStick = (event) => {
    if (stickPointer != null && event.pointerId !== stickPointer) return;
    stickPointer = null;
    dom.missionStick.classList.remove('is-active');
    dom.missionStickKnob.style.transform = 'translate(0, 0)';
    state.mission?.setStick(0, 0);
  };
  dom.missionStick.addEventListener('pointerup', releaseStick);
  dom.missionStick.addEventListener('pointercancel', releaseStick);

  dom.missionActionButtons.forEach((button) => {
    const action = button.dataset.missionAction;
    const hold = action === 'cannon' || action === 'boost';
    const press = (event) => {
      if (!state.mission || state.mission.state !== 'playing' || state.mission.paused) return;
      button.classList.add('is-pressed');
      state.mission.setAction(action, true);
      if (hold) button.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    const release = (event) => {
      button.classList.remove('is-pressed');
      if (hold) state.mission?.setAction(action, false);
      event.preventDefault();
    };
    button.addEventListener('pointerdown', press);
    if (hold) {
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', (event) => {
        if (event.buttons === 0) release(event);
      });
    }
  });
}

function updateMissionHud(snapshot) {
  if (!snapshot || !state.mission) return;
  state.missionHudSnapshot = snapshot;
  dom.missionTimer.textContent = formatTime(snapshot.timeLeft);
  dom.missionTimer.classList.toggle('is-critical', snapshot.timeLeft <= 30);
  dom.missionKills.textContent = snapshot.kills;
  dom.missionRequired.textContent = snapshot.required;
  dom.missionSpeed.textContent = String(snapshot.speed).padStart(3, '0');
  dom.missionAlt.textContent = String(snapshot.altitude).padStart(4, '0');
  dom.missionMach.textContent = snapshot.mach.toFixed(1);
  dom.missionG.textContent = snapshot.g.toFixed(1);
  dom.missionThrottle.style.transform = `scaleX(${clamp(snapshot.speed / 250, 0, 1)})`;
  dom.missionHpText.textContent = String(snapshot.hp);
  dom.missionHpFill.style.transform = `scaleX(${clamp(snapshot.hp / snapshot.maxHp, 0, 1)})`;
  dom.missionHpFill.classList.toggle('is-critical', snapshot.hp / snapshot.maxHp < 0.32);
  dom.missionMissiles.textContent = String(snapshot.missiles).padStart(2, '0');
  dom.missionFlares.textContent = String(snapshot.flares).padStart(2, '0');
  dom.missionBoost.textContent = String(Math.round(snapshot.boost)).padStart(3, '0');

  const lock = snapshot.lock;
  const inReticle = Boolean(lock?.screen?.inReticle);
  const screen = lock?.screen;
  if (lock?.active && screen && screen.z < 1) {
    dom.missionTargetMarker.hidden = false;
    dom.missionTargetMarker.style.left = `${screen.x}px`;
    dom.missionTargetMarker.style.top = `${screen.y}px`;
    dom.missionTargetMarker.classList.toggle('is-locked', lock.locked);
    dom.missionTargetMarker.classList.toggle('is-in-reticle', inReticle);
    dom.missionTargetLabel.textContent = lock.targetName || 'TARGET';
    dom.missionTargetDistance.textContent = `${(screen.distance / 1000).toFixed(1)} KM`;
    dom.missionLockRing.style.setProperty('--lock', `${Math.round(lock.progress * 100)}%`);
  } else {
    dom.missionTargetMarker.hidden = true;
  }

  if (!lock?.active) {
    dom.missionLockStatus.textContent = 'NO TARGET';
    dom.missionLockHint.textContent = '将目标保持在准星内锁定，或先发射导弹再制导';
    dom.missionLockFill.style.width = '0%';
    dom.missionCrosshair.classList.remove('is-locked', 'is-locking');
  } else if (lock.locked) {
    dom.missionLockStatus.textContent = 'LOCKED';
    dom.missionLockHint.textContent = '按 F 或导弹按钮发射追踪导弹';
    dom.missionLockFill.style.width = '100%';
    dom.missionCrosshair.classList.add('is-locked');
    dom.missionCrosshair.classList.remove('is-locking');
  } else {
    dom.missionLockStatus.textContent = `LOCKING ${Math.round(lock.progress * 100)}%`;
    dom.missionLockHint.textContent = inReticle ? '保持目标在准星内' : '目标偏离准星，锁定正在衰减';
    dom.missionLockFill.style.width = `${Math.round(lock.progress * 100)}%`;
    dom.missionCrosshair.classList.remove('is-locked');
    dom.missionCrosshair.classList.toggle('is-locking', inReticle);
  }

  const warning = snapshot.warning;
  if (warning?.active) {
    dom.missileWarning.hidden = false;
    dom.missileWarning.classList.toggle('is-intense', warning.intense);
    dom.missileWarning.classList.toggle('is-locking', warning.phase === 'lock');
    dom.missileWarningArrow.style.transform = `rotate(${warning.angle}deg)`;
    dom.missileWarningSub.textContent = warning.phase === 'incoming'
      ? '导弹来袭 · 释放诱弹或大幅机动'
      : '敌机正在锁定 · 立即机动';
  } else {
    dom.missileWarning.hidden = true;
    dom.missileWarning.classList.remove('is-intense', 'is-locking');
  }

  const cloudCover = clamp(Number(snapshot.cloud) || 0, 0, 1);
  dom.missionCloudOverlay.style.opacity = String(cloudCover * 0.56);
  dom.missionCoverBadge.hidden = cloudCover < 0.28;

  const pvp = Boolean(snapshot.pvp);
  dom.missionPvpBanner.hidden = !pvp;
  dom.missionKillcountWrap.style.display = pvp ? 'none' : '';
  if (pvp) {
    dom.missionPvpSelfName.textContent = state.user?.username || state.guestName;
    dom.missionPvpFoeName.textContent = snapshot.pvp.foeName || '对手';
    dom.missionPvpSelfHp.textContent = snapshot.pvp.selfHp;
    dom.missionPvpFoeHp.textContent = snapshot.pvp.foeHp;
  }
  const coopNetwork = snapshot.network?.mode === 'coop';
  dom.missionWingmanBadge.hidden = !coopNetwork;
  if (coopNetwork) {
    dom.missionWingmanName.textContent = snapshot.network.allyName || '僚机';
  }

  dom.missionCrosshair.classList.toggle('hit', Boolean(snapshot.hitMarker));
  state.radarContacts = snapshot.contacts || [];
  dom.missionRadarCount.textContent = `${state.radarContacts.length} CONTACTS`;
  drawMissionRadar(state.radarContacts, performance.now());
  if (!dom.missionHud.hidden) startRadarLoop();
}

function startRadarLoop() {
  if (state.radarRaf) return;
  const frame = (timestamp) => {
    if (!state.mission || state.currentScreen !== 'mission3d') {
      state.radarRaf = null;
      return;
    }
    drawMissionRadar(state.radarContacts, timestamp);
    state.radarRaf = requestAnimationFrame(frame);
  };
  state.radarRaf = requestAnimationFrame(frame);
}

function stopRadarLoop() {
  if (state.radarRaf) cancelAnimationFrame(state.radarRaf);
  state.radarRaf = null;
}

function drawMissionRadar(contacts = [], timestamp = performance.now()) {
  const canvas = dom.missionRadar;
  const ctx = dom.missionRadarCtx;
  if (!ctx || !canvas) return;
  const size = 180;
  const center = size / 2;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const bg = ctx.createRadialGradient(center, center, 5, center, center, center);
  bg.addColorStop(0, 'rgba(15, 46, 57, 0.62)');
  bg.addColorStop(0.62, 'rgba(8, 28, 38, 0.36)');
  bg.addColorStop(1, 'rgba(2, 10, 15, 0.12)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const sweep = ((timestamp / 2700) % 1) * TAU;
  const sweepX = Math.sin(sweep);
  const sweepY = -Math.cos(sweep);
  const glow = ctx.createRadialGradient(center, center, 2, center, center, 84);
  glow.addColorStop(0, 'rgba(87, 229, 255, 0.06)');
  glow.addColorStop(1, 'rgba(87, 229, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center, center, 84, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(center, center);
  ctx.arc(center, center, 82, -Math.PI / 2 + sweep - 0.54, -Math.PI / 2 + sweep);
  ctx.closePath();
  const wedge = ctx.createLinearGradient(center, center, center + sweepX * 82, center + sweepY * 82);
  wedge.addColorStop(0, 'rgba(87, 229, 255, 0.015)');
  wedge.addColorStop(1, 'rgba(87, 229, 255, 0.13)');
  ctx.fillStyle = wedge;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(center, center);
  ctx.lineTo(center + sweepX * 82, center + sweepY * 82);
  ctx.strokeStyle = 'rgba(128, 241, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(87, 229, 255, 0.13)';
  ctx.lineWidth = 1;
  for (const radius of [26, 52, 78]) {
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(center, 8);
  ctx.lineTo(center, size - 8);
  ctx.moveTo(8, center);
  ctx.lineTo(size - 8, center);
  ctx.strokeStyle = 'rgba(87, 229, 255, 0.065)';
  ctx.stroke();

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * TAU;
    const inner = i % 3 === 0 ? 76 : 80;
    ctx.beginPath();
    ctx.moveTo(center + Math.sin(angle) * inner, center - Math.cos(angle) * inner);
    ctx.lineTo(center + Math.sin(angle) * 84, center - Math.cos(angle) * 84);
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(128, 226, 247, 0.3)' : 'rgba(87, 229, 255, 0.12)';
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(150, 226, 244, 0.48)';
  ctx.font = '5px "Bahnschrift", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1.2', center, center - 42);
  ctx.fillText('2.4', center, center - 68);

  for (const contact of contacts) {
    const x = center + contact.x * 72;
    const y = center + contact.y * 72;
    const contactAngle = (Math.atan2(contact.x, -contact.y) + TAU) % TAU;
    let delta = (sweep - contactAngle + TAU) % TAU;
    const trail = delta < 1.75 ? 1 - delta / 1.75 : 0;
    const isAlly = contact.type === 'ally';
    const color = contact.target ? '#ffcf5b' : isAlly ? '#6bffb8' : '#ff5f79';
    const alpha = 0.25 + trail * 0.75;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 5 + trail * 7;
    ctx.fillStyle = color;
    if (contact.target) {
      ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 5.5, y - 5.5, 11, 11);
    } else if (isAlly) {
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x, y + 4);
      ctx.lineTo(x - 4, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, TAU);
      ctx.fill();
      if (trail > 0.3) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4 + (1 - trail) * 6, 0, TAU);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(center, center);
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(4.6, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-4.6, 6);
  ctx.closePath();
  ctx.fillStyle = '#e8fcff';
  ctx.shadowColor = '#57e5ff';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();
}

function handleMissionEvent(event) {
  if (!event) return;
  if (event.type === 'message') {
    showMissionMessage(event.kicker, event.text, event.tone);
    if (event.kicker === 'MISSILE LAUNCH' || event.kicker === 'NEW CONTACT') {
      audio.warningBeep(true);
    }
  } else if (event.type === 'kill') {
    addMissionKill(event.text, event.score);
  } else if (event.type === 'damage') {
    dom.missionHitFlash.classList.remove('on');
    dom.missionDamageVignette.classList.remove('on');
    void dom.missionHitFlash.offsetWidth;
    dom.missionHitFlash.classList.add('on');
    dom.missionDamageVignette.classList.add('on');
    clearTimeout(state.missionKillTimer);
    state.missionKillTimer = window.setTimeout(() => {
      dom.missionHitFlash.classList.remove('on');
      dom.missionDamageVignette.classList.remove('on');
    }, 320);
  }
}

function showMissionMessage(kicker, text, tone = 'info') {
  dom.missionMessageKicker.textContent = kicker || 'SYSTEM';
  dom.missionMessageText.textContent = text || '';
  dom.missionMessage.className = `mission-message tone-${tone}`;
  dom.missionMessage.hidden = false;
  clearTimeout(state.missionMessageTimer);
  state.missionMessageTimer = window.setTimeout(() => {
    dom.missionMessage.hidden = true;
  }, tone === 'danger' ? 2400 : 1600);
}

function addMissionKill(text, score = 0) {
  const item = document.createElement('div');
  item.className = 'killfeed-item';
  item.innerHTML = `<span>${escapeHtml(text)}</span><b>+${formatNumber(score)}</b>`;
  dom.missionKillfeed.append(item);
  while (dom.missionKillfeed.children.length > 4) dom.missionKillfeed.firstElementChild.remove();
  window.setTimeout(() => {
    item.classList.add('is-out');
    window.setTimeout(() => item.remove(), 300);
  }, 3200);
}

function handleMissionEnd(result) {
  if (!result) return;
  stopRadarLoop();
  state.missionResult = result;
  dom.missionHud.hidden = true;
  dom.missionPause.hidden = true;
  dom.missileWarning.hidden = true;
  dom.missionTargetMarker.hidden = true;
  dom.missionMessage.hidden = true;
  dom.missionCloudOverlay.style.opacity = '0';
  dom.missionCoverBadge.hidden = true;
  dom.missionPvpBanner.hidden = true;
  dom.missionWingmanBadge.hidden = true;
  dom.missionKillcountWrap.style.display = '';
  dom.missionEnd.hidden = false;
  dom.missionEnd.classList.toggle('is-success', result.success);
  dom.missionEnd.classList.toggle('is-failure', !result.success);
  dom.missionEndEyebrow.textContent = result.success ? 'MISSION COMPLETE' : 'MISSION FAILED';
  dom.missionEndMark.innerHTML = `<span>${result.success ? '✓' : '×'}</span>`;
  dom.missionEndTitle.textContent = result.success ? '任务完成' : result.reason === 'timeout' ? '任务超时' : '战机被击落';
  dom.missionEndSubtitle.textContent = result.success
    ? '敌方编队全部击落。空域恢复安全，王牌档案已记录你的呼号。'
    : result.reason === 'timeout'
      ? '时限耗尽，敌方编队仍在空域内活动。重新规划攻击路线。'
      : '战机结构失效。下一次，别让导弹咬住你的尾焰。';
  dom.missionEndGrid.innerHTML = `
    <div class="mission-end-stat"><span>SCORE</span><b>${formatNumber(result.score)}</b></div>
    <div class="mission-end-stat"><span>击落</span><b>${result.kills} / ${result.required}</b></div>
    <div class="mission-end-stat"><span>剩余时间</span><b>${formatTime(result.timeLeft)}</b></div>
    <div class="mission-end-stat"><span>命中率</span><b>${Math.round(result.accuracy * 100)}%</b></div>
  `;
  const best = updateMissionLocalBest(result);
  dom.missionEndExtra.innerHTML = `
    <span>${result.success ? 'HULL' : 'TIME'} ${result.success ? `${result.hp}%` : formatTime(result.timeLeft)}</span>
    <i></i>
    <span>导弹 ${result.missilesLeft} · 诱弹 ${result.flaresLeft}</span>
    <i></i>
    <span class="record">任务最高分 ${formatNumber(best)}</span>
    ${state.user ? '' : '<span class="login-hint">登录后可同步至王牌档案</span>'}
  `;
  dom.missionEndActions.innerHTML = '';
  const retry = makeActionButton('再次出击', 'REDEPLOY', true, () => {
    openMission3D({ autoStart: true });
  });
  const hangar = makeActionButton('战备机库', 'HANGAR', false, () => {
    cleanupMission3D();
    openHangar();
  });
  const home = makeActionButton('返回基地', 'HOME', false, () => {
    goHome();
  });
  dom.missionEndActions.append(retry, hangar, home);
  audio.stopFlightEngine();
  if (state.user) {
    dom.missionEndExtra.insertAdjacentHTML('beforeend', '<span class="mission-sync-state" id="mission-sync-state">正在同步王牌档案...</span>');
    submitMissionScore(result);
  }
}

async function submitMissionScore(result) {
  if (!state.user) return;
  try {
    const data = await api.submitScore({
      mode: 'mission',
      score: result.score,
      kills: result.kills,
      stage: 1,
      wave: 1,
      duration: Math.round(result.duration),
      plane: result.plane,
      skin: result.skin,
      stageCleared: false
    });
    state.user = data.user;
    updateUserUI();
    if (state.currentScreen === 'leaderboard') loadLeaderboard();
    if (state.missionResult !== result) return;
    const stateEl = $('#mission-sync-state');
    if (!stateEl) return;
    const parts = ['档案已同步'];
    if (data.isRecord) parts.push('新纪录');
    parts.push(`+${formatNumber(data.creditsEarned)} 星尘`);
    if (data.rank) parts.push(`排名 #${data.rank}`);
    stateEl.textContent = parts.join(' · ');
    stateEl.classList.add('is-done');
  } catch (error) {
    const stateEl = $('#mission-sync-state');
    if (stateEl) {
      stateEl.textContent = `同步失败：${error.message}`;
      stateEl.classList.add('is-error');
    }
  }
}

function updateMissionLocalBest(result) {
  const stats = safeRead('sky_strike_mission_stats', { best: 0, clears: 0, kills: 0, runs: 0 });
  stats.best = Math.max(stats.best || 0, result.score);
  stats.kills = (stats.kills || 0) + result.kills;
  stats.runs = (stats.runs || 0) + 1;
  if (result.success) stats.clears = (stats.clears || 0) + 1;
  safeWrite('sky_strike_mission_stats', stats);
  return stats.best;
}

function updateSingleHud(snapshot) {
  if (!snapshot) return;
  dom.hudModeLabel.textContent = snapshot.mode === 'campaign' ? 'CAMPAIGN' : 'ENDLESS SORTIE';
  dom.hudStageLabel.textContent = snapshot.mode === 'campaign' ? `空域 ${pad2(snapshot.stage)}` : '无限战斗';
  dom.hudScore.textContent = formatNumber(snapshot.score);
  dom.hudKills.textContent = formatNumber(snapshot.kills);
  dom.hudTime.textContent = formatTime(snapshot.time);
  dom.hudCombo.textContent = `x${snapshot.combo.toFixed(1)}`;
  dom.hudCombo.classList.toggle('hot', snapshot.comboActive);
  dom.hudPlaneName.textContent = getPlane(state.selectedPlane).name;
  const ratio = Math.max(0, snapshot.hp / snapshot.maxHp);
  dom.hudHpText.textContent = `${snapshot.hp} / ${snapshot.maxHp}`;
  dom.hudHpFill.style.transform = `scaleX(${ratio})`;
  dom.hudHpFill.style.background = ratio < 0.3 ? 'linear-gradient(90deg, #ff355a, #ff889c)' : '';
  dom.hudShieldWrap.classList.toggle('on', snapshot.shield);
  dom.hudShieldFill.style.transform = 'scaleX(1)';
  dom.hudPower.querySelectorAll('i').forEach((pip, index) => {
    pip.classList.toggle('on', index < snapshot.power);
  });
  if (snapshot.boss) {
    dom.bossHud.hidden = false;
    dom.bossName.textContent = snapshot.boss.name;
    dom.bossHpText.textContent = `${Math.ceil(snapshot.boss.ratio * 100)}%`;
    dom.bossHpFill.style.transform = `scaleX(${snapshot.boss.ratio})`;
  } else {
    dom.bossHud.hidden = true;
  }
}

function requestPause() {
  if (state.duel.game) {
    toast('局域网对决中无法暂停。', 'error');
    return;
  }
  if (!state.game || state.game.phase !== 'playing' || state.game.paused) return;
  state.game.pause();
  dom.pauseModal.hidden = false;
  updateSoundUI();
}

function resumeGame() {
  dom.pauseModal.hidden = true;
  if (state.duel.game) state.duel.game.resume();
  if (state.game) state.game.resume();
}

function restartGame() {
  const mode = state.gameMode || 'endless';
  const stage = state.game?.stage || 1;
  dom.pauseModal.hidden = true;
  cleanupSingleGame();
  startSingle(mode, { stage });
}

function exitGameToHome() {
  dom.pauseModal.hidden = true;
  hideModal('result-modal');
  cleanupSingleGame();
  if (state.duel.game) {
    leaveDuelCompletely();
  }
  showScreen('home');
  audio.startAmbience('menu');
}

function cleanupSingleGame() {
  if (state.game) {
    state.game.destroy();
    state.game = null;
  }
  dom.pauseModal.hidden = true;
}

function showGameOver(result) {
  if (state.game) state.game.paused = true;
  dom.resultEyebrow.textContent = result.mode === 'campaign' ? 'SORTIE LOST' : 'SIGNAL LOST';
  dom.resultTitle.textContent = result.mode === 'campaign' ? '战机失联' : '任务结束';
  dom.resultSubtitle.textContent = result.mode === 'campaign'
    ? `你抵达了空域 ${pad2(result.stage)}。下一次，带着更强的火力回来。`
    : '天空恢复安静，但王牌档案仍在等待你的下一个纪录。';
  dom.resultGrid.innerHTML = `
    <div class="result-stat"><span>积分</span><b>${formatNumber(result.score)}</b></div>
    <div class="result-stat"><span>击落</span><b>${formatNumber(result.kills)}</b></div>
    <div class="result-stat"><span>${result.mode === 'campaign' ? '空域' : '时长'}</span><b>${result.mode === 'campaign' ? pad2(result.stage) : formatTime(result.duration)}</b></div>
  `;
  dom.resultExtra.textContent = state.user ? '正在同步战绩...' : '访客战绩仅保存在本机。';
  dom.resultActions.innerHTML = '';
  const again = makeActionButton('再次出击', 'RESORTIE', true, () => {
    hideModal('result-modal');
    cleanupSingleGame();
    startSingle(result.mode, { stage: result.stage });
  });
  const hangar = makeActionButton('战备机库', 'HANGAR', false, () => {
    hideModal('result-modal');
    cleanupSingleGame();
    openHangar();
  });
  const home = makeActionButton('返回基地', 'HOME', false, () => {
    hideModal('result-modal');
    cleanupSingleGame();
    goHome();
  });
  dom.resultActions.append(again, hangar, home);
  dom.resultModal.hidden = false;
  submitRun(result, dom.resultExtra);
  renderHome();
}

function showStageClear(result) {
  if (state.game) state.game.paused = true;
  dom.resultEyebrow.textContent = 'SECTOR SECURED';
  dom.resultTitle.textContent = '空域肃清';
  dom.resultSubtitle.textContent = `第 ${result.stage} 空域的虚空舰队已被击溃。航线已延伸至下一片云海。`;
  dom.resultGrid.innerHTML = `
    <div class="result-stat"><span>总积分</span><b>${formatNumber(result.score)}</b></div>
    <div class="result-stat"><span>击落</span><b>${formatNumber(result.kills)}</b></div>
    <div class="result-stat"><span>当前空域</span><b>${pad2(result.stage)}</b></div>
  `;
  dom.resultExtra.textContent = '正在记录空域进度...';
  dom.resultActions.innerHTML = '';
  const next = makeActionButton('深入下一空域', 'NEXT SECTOR', true, () => {
    hideModal('result-modal');
    if (state.game) {
      state.game.nextStage();
      state.game.paused = false;
    }
    dom.hudStageLabel.textContent = `空域 ${pad2(state.game?.stage || result.stage + 1)}`;
  });
  const returnHome = makeActionButton('返航并结算', 'EXTRACT', false, async () => {
    hideModal('result-modal');
    submitRun({ ...result, stageCleared: true }, document.createElement('div'));
    cleanupSingleGame();
    goHome();
  });
  const hangar = makeActionButton('前往机库', 'HANGAR', false, () => {
    hideModal('result-modal');
    submitRun({ ...result, stageCleared: true }, document.createElement('div'));
    cleanupSingleGame();
    openHangar();
  });
  dom.resultActions.append(next, returnHome, hangar);
  dom.resultModal.hidden = false;
  saveCampaignProgress(result);
}

function makeActionButton(label, small, primary, onClick) {
  const button = document.createElement('button');
  button.className = `btn ${primary ? 'btn-primary' : 'btn-ghost'}`;
  button.innerHTML = `<span>${escapeHtml(label)}</span><small>${escapeHtml(small)}</small>`;
  button.addEventListener('click', onClick);
  return button;
}

async function saveCampaignProgress(result) {
  if (state.user) {
    try {
      state.user = await api.saveProgress(result.stage);
      updateUserUI();
      dom.resultExtra.innerHTML = `空域进度已同步。<span class="reward">下一空域：${pad2(result.stage + 1)}</span>`;
    } catch (error) {
      dom.resultExtra.textContent = `进度同步失败：${error.message}`;
    }
  } else {
    state.guestStats.campaignStage = Math.max(state.guestStats.campaignStage || 1, result.stage + 1);
    safeWrite(STORAGE.guestStats, state.guestStats);
    renderHome();
    dom.resultExtra.innerHTML = '访客进度已保存在本机。登录后可跨设备同步。';
  }
}

async function submitRun(result, extraEl) {
  if (!state.user) {
    recordGuestRun(result);
    if (extraEl) {
      extraEl.innerHTML = '访客战绩已保存在本机。<span class="reward">登录后可上传排名</span>';
    }
    return;
  }
  if (extraEl) extraEl.textContent = '正在上传飞行数据...';
  try {
    const data = await api.submitScore({
      mode: result.mode,
      score: result.score,
      kills: result.kills,
      stage: result.stage,
      wave: result.stage,
      duration: result.duration,
      plane: result.plane,
      skin: result.skin,
      stageCleared: Boolean(result.stageCleared)
    });
    state.user = data.user;
    updateUserUI();
    if (state.currentScreen === 'leaderboard') loadLeaderboard();
    if (!extraEl) return;
    const details = [];
    if (data.isRecord) details.push('<span class="record">新纪录已写入王牌档案</span>');
    details.push(`<span class="reward">+${formatNumber(data.creditsEarned)} 星尘</span>`);
    if (data.rank) details.push(`当前排名 <b>#${data.rank}</b>`);
    extraEl.innerHTML = details.join(' · ');
  } catch (error) {
    if (extraEl) extraEl.textContent = `战绩同步失败：${error.message}`;
  }
}

function recordGuestRun(result) {
  const stats = state.guestStats;
  stats.kills += result.kills;
  if (result.mode === 'endless') {
    stats.bestEndless = Math.max(stats.bestEndless || 0, result.score);
  } else {
    stats.bestCampaign = Math.max(stats.bestCampaign || 0, result.score);
    const unlocked = result.stage + (result.stageCleared ? 1 : 0);
    stats.campaignStage = Math.max(stats.campaignStage || 1, unlocked);
  }
  safeWrite(STORAGE.guestStats, stats);
  renderHome();
}

function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.hidden = true;
}

function hideAllModals() {
  $$('.modal-backdrop').forEach((modal) => {
    modal.hidden = true;
  });
}

function toast(message, type = 'info', duration = 3000) {
  if (!message) return;
  const element = document.createElement('div');
  element.className = `toast ${type === 'error' ? 'is-error' : ''}`;
  element.textContent = message;
  dom.toastStack.append(element);
  while (dom.toastStack.children.length > 3) dom.toastStack.firstElementChild.remove();
  const timer = window.setTimeout(() => {
    element.classList.add('is-out');
    window.setTimeout(() => element.remove(), 320);
    state.toastTimers.delete(timer);
  }, duration);
  state.toastTimers.add(timer);
}

window.addEventListener('beforeunload', () => {
  state.socket?.emit('duel:leave');
  state.socket?.emit('air3d:leave');
  state.game?.destroy();
  state.duel.game?.destroy();
  const air3dMission = state.air3d.mission;
  air3dMission?.destroy();
  if (state.mission !== air3dMission) state.mission?.destroy();
  clearInterval(onlineTimer);
});

init();
