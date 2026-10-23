// Говорящий Тенгиз — three.js + Web Audio, без сборки.
// Модель собрана из отдельных деталей без скелета: при загрузке раскладываем их по группам-шарнирам
// (тело → торс → голова → глаза/рот/брови, руки) и двигаем эти группы.
import * as THREE from 'three';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

const $ = (s) => document.querySelector(s);
const now = () => performance.now() / 1000;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// 0 → 1 → 0 на отрезке [a, b]
const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(Math.PI * ((t - a) / (b - a))));
// плавный 0 → 1 на отрезке [a, b]
const ramp = (t, a, b) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };

/* ── сцена ── */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

scene.add(new THREE.HemisphereLight(0xfff1e6, 0x2a1640, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2.3);
key.position.set(2.2, 5, 4.5);
key.target.position.set(0, 1.2, 0);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 1, far: 15 });
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.03;
key.shadow.radius = 4;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x9d5cf0, 2.4);
rim.position.set(-3, 3, -3.5);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffd2b8, 0.5);
fill.position.set(-3, 1.5, 3);
scene.add(fill);
const RIM_COLOR = rim.color.clone();

const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.4 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// мягкое фиолетовое пятно под ногами
const glow = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(157,92,240,0.55)');
  grd.addColorStop(1, 'rgba(157,92,240,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  scene.add(m);
  return m;
})();

/* ── камера: персонаж влезает между шапкой и нижней панелью ── */
function fit() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const top = 70, bot = 120;
  const frac = Math.max(0.45, (h - top - bot) / h);
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(2.85 / 2 / (t * frac), 2.4 / 2 / (t * camera.aspect));
  const cy = 1.33 - ((bot - top) / h) * t * dist;
  camera.position.set(0, cy + 0.3, dist);
  camera.lookAt(0, cy, 0);
  camera.updateProjectionMatrix();
}
addEventListener('resize', fit);
fit();

/* ── модель и кости ── */
// Модель — один цельный меш без скелета.
// Кости ставим сами, а веса считаем по высоте и ширине: что выше бёдер — торс, выше шеи — голова и т. д.
// Внутри MODEL работаем в единицах файла: рост 1.15, Y вверх, лицо смотрит в +Z.
const S = 2.6 / 1.15;
const MODEL = new THREE.Group();
MODEL.scale.setScalar(S);
MODEL.userData.abs = [0, 0, 0];
scene.add(MODEL);

function joint(parent, abs) {
  const b = new THREE.Bone();
  const pa = parent.userData.abs;
  b.position.set(abs[0] - pa[0], abs[1] - pa[1], abs[2] - pa[2]);
  b.userData.abs = abs;
  parent.add(b);
  return b;
}

const J = {};
J.body = joint(MODEL, [0, 0, 0]);
J.torso = joint(J.body, [0, 0.5, 0]);
J.head = joint(J.torso, [0, 0.95, -0.02]);
J.jaw = joint(J.head, [0, 0.99, -0.03]);
// Рук-костей нет: у модели рукава прижаты к пиджаку, и при любом взмахе бок тянется за рукой «перепонкой».
// Руки едут вместе с торсом, а живость дают голова, корпус, прыжки и рот.
const BONES = [J.body, J.torso, J.head, J.jaw];

// открытый рот: у модели нет полости рта, поэтому кладём на губы тёмный овал и растягиваем его
const mouthHole = new THREE.Mesh(
  new THREE.SphereGeometry(1, 20, 12),
  new THREE.MeshStandardMaterial({ color: 0x3a1012, roughness: 0.9 }),
);
{
  const a = J.head.userData.abs;
  mouthHole.position.set(0 - a[0], 0.972 - a[1], 0.073 - a[2]);
  mouthHole.visible = false;
  J.head.add(mouthHole);
}

const ss = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// вес точки: [кость, вес] для тела, торса, головы и челюсти
function weightsAt(x, y, z) {
  const ax = Math.abs(x);
  const spine = ss(0.44, 0.56, y);
  const head = ss(0.93, 0.965, y) * (y < 0.98 ? 1 - ss(0.1, 0.13, ax) : 1);
  const jaw = ss(0.978, 0.968, y) * ss(0.935, 0.95, y) * ss(0.01, 0.04, z) * ss(0.05, 0.035, ax);
  return [
    [0, 1 - spine],
    [1, spine * (1 - head)],
    [2, spine * head * (1 - jaw)],
    [3, spine * head * jaw],
  ];
}

// зона для тыка — по точке модели в исходной позе
function zoneAt(x, y, z) {
  const ax = Math.abs(x);
  if (y > 0.93 && ax < 0.12) {
    if (ax < 0.02 && y > 0.985 && y < 1.015 && z > 0.075) return 'nose';
    if (y > 1.03 && y < 1.078) return 'bandana';
    return 'head';
  }
  if (y < 0.45) return 'feet';
  if (ax > 0.142 - 0.027 * ss(0.56, 0.66, y) && y > 0.455 && y < 0.86) return x < 0 ? 'handL' : 'handR';
  return 'belly';
}

const hitMeshes = [];
let skin = null;

function setupModel(root) {
  let src = null;
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isMesh && !src) src = o; });
  const geo = src.geometry.clone();
  geo.applyMatrix4(src.matrixWorld); // поворот узла из файла запекаем в геометрию

  const pos = geo.attributes.position, n = pos.count;
  const idx = new Uint16Array(n * 4), wts = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const w = weightsAt(pos.getX(i), pos.getY(i), pos.getZ(i));
    const sum = w.reduce((t, [, v]) => t + v, 0) || 1;
    w.forEach(([b, v], k) => { idx[i * 4 + k] = b; wts[i * 4 + k] = v / sum; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));

  skin = new THREE.SkinnedMesh(geo, src.material);
  skin.castShadow = true;
  skin.frustumCulled = false;
  MODEL.add(skin);
  skin.add(J.body);
  MODEL.updateMatrixWorld(true);
  skin.bind(new THREE.Skeleton(BONES));
  hitMeshes.push(skin);
}

/* ── позы ── */
// Каждая реакция добавляет свои значения к «нулевой» позе, потом всё сглаживается и применяется к шарнирам.
// Оси (координаты модели): rotation.x — кивок вперёд, rotation.y — наклон вбок, rotation.z — поворот.
const KEYS = ['bodyY', 'bodyRot', 'squash', 'torsoX', 'torsoY', 'torsoZ', 'headX', 'headY', 'headZ',
  'armLX', 'armLY', 'armRX', 'armRY', 'mouth', 'mouthW', 'brow', 'blink', 'eyeX', 'eyeY', 'cross', 'hair'];
const FAST = new Set(['mouth', 'blink', 'mouthW']);
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const cur = zero();

const running = [];
let lockUntil = 0;
function act(dur, fn, { lock = false } = {}) {
  const a = { t: 0, dur, fn, fired: new Set() };
  a.at = (time, cb) => { if (a.t >= time && !a.fired.has(time)) { a.fired.add(time); cb(); } };
  running.push(a);
  if (lock) lockUntil = now() + dur;
  return a;
}
const busy = () => now() < lockUntil;

/* ── звук ── */
let ctx = null, master = null, voiceBus = null, analyser = null;
const levelBuf = new Float32Array(1024);
function initAudio() {
  if (ctx) return ctx.resume();
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  voiceBus = ctx.createGain();
  voiceBus.connect(analyser);
  analyser.connect(master);
  return ctx.resume();
}
function voiceLevel() {
  if (!analyser) return 0;
  analyser.getFloatTimeDomainData(levelBuf);
  let s = 0;
  for (const v of levelBuf) s += v * v;
  return Math.sqrt(s / levelBuf.length);
}

let quietUntil = 0; // пока Тенгиз шумит, микрофон не слушаем — иначе он повторит сам себя
const quiet = (sec) => { quietUntil = Math.max(quietUntil, now() + sec + 0.35); };

function env(g, t0, peak, attack, dur) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
function osc(type, f0, f1, dur, vol, { at = 0, dest = master, attack = 0.01 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(g, t0, vol, attack, dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  return o;
}
let noiseBuf = null;
function noise(dur, vol, filter, f0, f1 = f0, { at = 0, q = 1, dest = master } = {}) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + at;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf;
  s.loop = true;
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(g, t0, vol, 0.005, dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t0);
  s.stop(t0 + dur + 0.05);
}

const sfx = {
  poke() { osc('triangle', 700, 120, 0.14, 0.35); noise(0.05, 0.2, 'bandpass', 2500); quiet(0.3); },
  boing() {
    if (!ctx) return;
    const o = osc('sine', 180, 520, 0.5, 0.4);
    o.frequency.setValueAtTime(180, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(560, ctx.currentTime + 0.1);
    o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.5);
    quiet(0.6);
  },
  honk() { osc('square', 400, 360, 0.28, 0.12); osc('square', 407, 366, 0.28, 0.12); quiet(0.4); },
  whoosh() { noise(0.35, 0.3, 'bandpass', 2400, 300, { q: 2 }); quiet(0.4); },
  thump(at = 0) { osc('sine', 140, 45, 0.25, 0.7, { at }); },
  splat() { noise(0.4, 0.7, 'lowpass', 1600, 200); this.thump(); quiet(0.5); },
  fart() {
    if (!ctx) return 0;
    const t0 = ctx.currentTime, dur = rand(0.9, 1.5);
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(), ag = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(85, 110), t0);
    o.frequency.exponentialRampToValueAtTime(rand(45, 60), t0 + dur);
    lfo.frequency.value = rand(14, 24);
    lg.gain.value = 22;
    ag.gain.value = 0.18;
    lfo.connect(lg).connect(o.frequency);
    lfo.connect(ag).connect(g.gain);
    f.type = 'lowpass';
    f.frequency.value = 650;
    f.Q.value = 7;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.04);
    g.gain.setValueAtTime(0.45, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f).connect(g).connect(master);
    noise(dur, 0.12, 'bandpass', 380, 200, { q: 3 });
    for (const n of [o, lfo]) { n.start(t0); n.stop(t0 + dur + 0.05); }
    quiet(dur);
    return dur;
  },
  // 8 секунд бита: бочка, хэт, хлопок, бас
  beat(bars = 4) {
    if (!ctx) return;
    const bpm = 120, b = 60 / bpm, bass = [55, 55, 65.4, 73.4, 55, 55, 82.4, 73.4];
    for (let i = 0; i < bars * 4; i++) {
      const at = i * b;
      osc('sine', 150, 42, 0.28, 0.85, { at, attack: 0.003 });
      noise(0.05, 0.12, 'highpass', 7000, 7000, { at: at + b / 2 });
      if (i % 2) noise(0.16, 0.3, 'bandpass', 1500, 1200, { at, q: 0.8 });
      for (const k of [0, 1]) osc('sawtooth', bass[(i * 2 + k) % 8] * (k ? 2 : 1), bass[(i * 2 + k) % 8] * (k ? 2 : 1), b / 2 - 0.02, 0.16, { at: at + (k * b) / 2 });
    }
    quiet(bars * 4 * b);
  },
};

/* ── голоса ── */
const VOICES = [
  { id: 'chip', label: '🐿 Бурундук', rate: 1.6, pitch: 2, babble: 560 },
  { id: 'bass', label: '🐻 Бас', rate: 0.72, pitch: 0.1, babble: 140 },
  { id: 'robot', label: '🤖 Робот', rate: 1.1, pitch: 0.6, babble: 260, robot: true },
];
let voice = VOICES[0];
try { voice = VOICES.find((v) => v.id === localStorage.getItem('tengiz-voice')) || voice; } catch { /* нет хранилища */ }
const voiceBtn = $('#voice');
voiceBtn.textContent = voice.label;
voiceBtn.addEventListener('click', () => {
  voice = VOICES[(VOICES.indexOf(voice) + 1) % VOICES.length];
  voiceBtn.textContent = voice.label;
  try { localStorage.setItem('tengiz-voice', voice.id); } catch { /* ничего */ }
  touch();
  say(pick(['Так лучше?', 'Новый голос, бро', 'Проверка, раз-два']));
});

// робот: кольцевая модуляция поверх голоса
function voiceInput() {
  if (!voice.robot) return voiceBus;
  const g = ctx.createGain(), o = ctx.createOscillator();
  g.gain.value = 0;
  o.frequency.value = 55;
  o.connect(g.gain);
  o.start();
  g.connect(voiceBus);
  setTimeout(() => o.stop(), 15000);
  return g;
}

/* ── речь: системный синтез, а если русского голоса нет — «бормотание» как в играх ── */
let ruVoice = null;
let speakingUntil = 0;
const pickRu = () => { ruVoice = speechSynthesis.getVoices().find((v) => /^ru/i.test(v.lang)) || null; };
if ('speechSynthesis' in window) {
  pickRu();
  speechSynthesis.addEventListener?.('voiceschanged', pickRu);
}

function babble(text) {
  const syl = Math.min(28, Math.max(2, (text.match(/[аеёиоуыэюяaeiouy]/gi) || []).length));
  const step = voice.id === 'bass' ? 0.15 : 0.11;
  const dest = voiceInput();
  for (let i = 0; i < syl; i++) {
    const f = voice.babble * rand(0.85, 1.25);
    osc(voice.robot ? 'square' : 'sawtooth', f, f * rand(0.85, 1.1), step * 0.85, 0.22, { at: i * step, dest, attack: 0.015 });
  }
  return syl * step;
}

function say(text, { sound = true } = {}) {
  bubble(text, Math.max(1600, text.length * 75));
  if (!sound || !ctx) return;
  let dur;
  if (ruVoice) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = ruVoice;
    u.lang = ruVoice.lang;
    u.pitch = voice.pitch;
    u.rate = voice.id === 'bass' ? 0.85 : 1.15;
    dur = 0.6 + text.length * 0.075;
    u.onend = u.onerror = () => { speakingUntil = Math.min(speakingUntil, now()); quiet(0.1); };
    speechSynthesis.speak(u);
    speakingUntil = now() + dur;
    quiet(dur);
  } else {
    dur = babble(text);
    quiet(dur);
  }
}

/* ── пузырь с репликой ── */
const bubbleEl = $('#bubble');
let bubbleUntil = 0;
function bubble(text, ms = 1800) {
  bubbleEl.hidden = false;
  bubbleEl.textContent = text;
  bubbleEl.style.animation = 'none';
  void bubbleEl.offsetWidth;
  bubbleEl.style.animation = '';
  bubbleUntil = now() + ms / 1000;
}
const headTop = new THREE.Vector3();
function placeBubble() {
  if (bubbleEl.hidden) return;
  if (now() > bubbleUntil) { bubbleEl.hidden = true; return; }
  J.head.localToWorld(headTop.set(0.08, 0.19, 0)).project(camera);
  const x = (headTop.x * 0.5 + 0.5) * innerWidth;
  const y = (-headTop.y * 0.5 + 0.5) * innerHeight;
  const w = bubbleEl.offsetWidth, h = bubbleEl.offsetHeight;
  bubbleEl.style.transform = `translate(${Math.min(innerWidth - w - 12, Math.max(12, x))}px, ${Math.max(64, y - h)}px)`;
}

/* ── реакции на тык ── */
const taps = {};
let lastTouch = now();
const touch = () => { lastTouch = now(); };
function combo(zone, n, within) {
  const t = now();
  const list = (taps[zone] = (taps[zone] || []).filter((x) => t - x < within));
  list.push(t);
  if (list.length >= n) { taps[zone] = []; return true; }
  return false;
}

const REACT = {
  head() {
    if (combo('head', 4, 3)) return offended();
    sfx.poke();
    say(pick(['Ай!', 'Эй, бро!', 'Ну хорош', 'Больно же!', 'Аккуратнее с кудрями']));
    act(0.7, (t, p) => {
      const k = bump(t, 0, 0.6);
      p.headX -= 0.35 * k;
      p.torsoX -= 0.08 * k;
      p.blink = Math.max(p.blink, t < 0.35 ? 1 : 0);
      p.mouth += 0.6 * k;
      p.hair += 0.8 * bump(t, 0.05, 0.5);
    });
  },
  nose() {
    sfx.honk();
    say(pick(['Бип!', 'Нос не кнопка, бро', 'Бип-бип']));
    act(0.9, (t, p) => {
      const k = bump(t, 0, 0.8);
      p.cross += k;
      p.headX -= 0.15 * k;
      p.brow += k;
      p.mouthW += k;
    });
  },
  bandana() {
    say(pick(['Не трогай бандану!', 'Это моя фишка', 'Поправь обратно, бро']));
    sfx.whoosh();
    act(1.4, (t, p) => {
      const k = bump(t, 0, 1.4);
      p.headY += 0.22 * Math.sin(t * 16) * (1 - t / 1.4);
      p.armRY -= 2.7 * k;
      p.armRX -= 0.35 * k;
      p.brow -= 0.8 * k;
    });
  },
  belly() {
    if (combo('belly', 3, 1.5)) return tickle();
    sfx.boing();
    say(pick(['Уфф!', 'Это пресс вообще-то', 'Ой', 'Костюм помнёшь!']));
    act(0.8, (t, p) => {
      const k = bump(t, 0, 0.7);
      p.torsoX += 0.28 * k;
      p.squash += 0.06 * k;
      p.headX += 0.1 * k;
      p.mouth += 0.7 * k;
      p.brow += k;
      p.armLY += 0.3 * k;
      p.armRY -= 0.3 * k;
    });
  },
  hand(side) {
    say(pick(['Здарова, бро!', 'Дай пять!', 'Йоу!', 'Чё по руке-то?']));
    const s = side === 'handL' ? -1 : 1; // сторона, куда ткнули (по X)
    act(1.6, (t, p) => {
      const k = ramp(t, 0, 0.25) * (1 - ramp(t, 1.2, 1.6));
      p.headZ += 0.4 * s * k;
      p.headX += 0.18 * k;
      p.torsoY += 0.1 * s * k;
      p.bodyY += 0.05 * Math.abs(Math.sin(t * 9)) * k;
      p.mouth += 0.4 * k;
      p.brow += 0.6 * k;
    });
  },
  feet() {
    sfx.whoosh();
    sfx.thump(0.6);
    say(pick(['Эй, по ногам не надо!', 'Это новые ботинки!', 'Ай, нога!']));
    act(1.0, (t, p) => {
      const air = bump(t, 0.12, 0.62);
      p.bodyY += 0.45 * air;
      p.squash += 0.1 * bump(t, 0, 0.14) + 0.08 * bump(t, 0.6, 0.85) - 0.05 * air;
      p.armLY += 1.4 * air;
      p.armRY -= 1.4 * air;
      p.mouth += 0.8 * bump(t, 0.05, 0.7);
      p.brow += air;
      p.hair += bump(t, 0.55, 0.9) * 1.2;
    });
  },
};

function offended() {
  say('Всё, я обиделся');
  sfx.whoosh();
  act(4, (t, p, a) => {
    const turned = ramp(t, 0.3, 0.8) * (1 - ramp(t, 3.1, 3.6));
    p.bodyRot += Math.PI * turned;
    p.headX += 0.25 * turned;
    p.armLX -= 0.5 * turned;
    p.armRX -= 0.5 * turned;
    a.at(3.2, () => say(pick(['Ладно, прощаю', 'Ну ладно, бро'])));
  }, { lock: true });
}

function tickle() {
  say('Ха-ха-ха, щекотно!');
  act(2.2, (t, p) => {
    const k = 1 - ramp(t, 1.8, 2.2);
    p.torsoY += 0.12 * Math.sin(t * 28) * k;
    p.headY += 0.1 * Math.sin(t * 22 + 1) * k;
    p.torsoX += 0.15 * k;
    p.mouth += (0.5 + 0.5 * Math.abs(Math.sin(t * 18))) * k;
    p.blink = Math.max(p.blink, 0.85 * k);
    p.armLY += 0.5 * k;
    p.armRY -= 0.5 * k;
    p.bodyY += 0.03 * Math.abs(Math.sin(t * 14)) * k;
  }, { lock: true });
}

/* ── кнопки ── */
const ACTIONS = {
  dance() {
    sfx.beat(4);
    bubble('Погнали! 🕺', 1500);
    act(8, (t, p, a) => {
      const beat = t * 2;
      const k = ramp(t, 0, 0.3) * (1 - ramp(t, 7.6, 8));
      p.bodyY += 0.07 * Math.abs(Math.sin(Math.PI * beat)) * k;
      p.squash += 0.03 * Math.cos(2 * Math.PI * beat) * k;
      p.torsoY += 0.14 * Math.sin((Math.PI * beat) / 2) * k;
      p.torsoZ += 0.25 * Math.sin((Math.PI * beat) / 4) * k;
      p.headX += 0.14 * Math.sin(2 * Math.PI * beat) * k;
      p.headY -= 0.12 * Math.sin((Math.PI * beat) / 2) * k;
      p.armLY += (1.3 + 1.1 * Math.sin(Math.PI * beat)) * k;
      p.armRY -= (1.3 + 1.1 * Math.sin(Math.PI * beat + Math.PI)) * k;
      p.armLX -= 0.3 * k;
      p.armRX -= 0.3 * k;
      p.mouth += 0.5 * Math.max(0, Math.sin(2 * Math.PI * beat)) * k;
      p.brow += 0.6 * k;
      p.hair += 0.6 * Math.abs(Math.sin(Math.PI * beat)) * k;
      // полный оборот; в конце вычитаем 2π из сглаженного значения, чтобы он не раскручивался обратно
      if (t < 5) p.bodyRot += 2 * Math.PI * ramp(t, 4, 5);
      a.at(5, () => { cur.bodyRot -= 2 * Math.PI; });
      rim.color.setHSL((t * 0.4) % 1, 0.8, 0.6);
      a.at(7.6, () => { rim.color.copy(RIM_COLOR); say('Фух!'); });
    });
    lockUntil = now() + 8;
  },
  fart() {
    const dur = sfx.fart();
    act(2.6, (t, p, a) => {
      const pop = bump(t, 0, 0.35);
      p.bodyY += 0.08 * pop;
      p.brow += 1.2 * bump(t, 0, 1);
      p.mouthW += bump(t, 0, 1);
      const shame = ramp(t, 1, 1.3) * (1 - ramp(t, 2.3, 2.6));
      p.headX += 0.28 * shame;
      p.eyeX -= shame;
      p.eyeY -= 0.5 * shame;
      p.armLX -= 0.4 * shame;
      p.armRX -= 0.4 * shame;
      for (const s of [0.05, 0.25, 0.45, 0.65]) a.at(s, puff);
      a.at(Math.max(1, dur || 1), () => say(pick(['Это не я', 'Ой…', 'Пардон, бро', 'Это был кот'])));
    }, { lock: true });
  },
  cake() {
    throwCake();
  },
};

for (const b of document.querySelectorAll('[data-act]')) {
  b.addEventListener('click', () => {
    if (!ready || busy()) return;
    touch();
    ACTIONS[b.dataset.act]();
  });
}

/* ── облачка и торт ── */
const fx = [];
const puffMat = new THREE.MeshStandardMaterial({ color: 0x9ccc4a, transparent: true, opacity: 0.6, roughness: 1, depthWrite: false });
const sphere = new THREE.SphereGeometry(1, 16, 12);
function puff() {
  const m = new THREE.Mesh(sphere, puffMat.clone());
  const side = Math.random() < 0.5 ? -1 : 1;
  m.position.set(side * rand(0.1, 0.17), rand(0.42, 0.5), rand(-0.13, -0.06));
  J.body.add(m);
  const v = new THREE.Vector3(side * rand(0.15, 0.27), rand(0.07, 0.18), rand(-0.05, 0));
  fx.push({ t: 0, dur: 1.8, update(t) {
    m.position.addScaledVector(v, 1 / 60);
    m.scale.setScalar(0.02 + 0.06 * ramp(t, 0, 1.2));
    m.material.opacity = 0.6 * (1 - ramp(t, 0.6, 1.8));
  }, done() { J.body.remove(m); m.material.dispose(); } });
}

const cream = new THREE.MeshStandardMaterial({ color: 0xfff4ea, roughness: 0.35 });
const crust = new THREE.MeshStandardMaterial({ color: 0xd99a55, roughness: 0.8 });
const berry = new THREE.MeshStandardMaterial({ color: 0xd42a4a, roughness: 0.3 });
function makePie() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.07, 24), crust);
  const top = new THREE.Mesh(sphere, cream);
  top.scale.set(0.16, 0.06, 0.16);
  top.position.y = 0.04;
  const c = new THREE.Mesh(sphere, berry);
  c.scale.setScalar(0.035);
  c.position.y = 0.1;
  g.add(base, top, c);
  g.rotation.x = Math.PI / 2;
  return g;
}
// крем на лице — в координатах головы; центр группы на лице, чтобы масштаб шёл от него
const splat = new THREE.Group();
const splatIn = new THREE.Group();
{
  const FACE = [0, 0.995, 0.088];
  const blobs = [[0.004, 0.993, 0.086, 0.032, 0.028, 0.013], [-0.026, 1.012, 0.078, 0.014, 0.012, 0.009], [0.027, 0.976, 0.074, 0.012, 0.013, 0.009],
    [0.008, 0.958, 0.07, 0.007, 0.012, 0.006], [-0.017, 0.965, 0.072, 0.005, 0.01, 0.005]];
  for (const [x, y, z, sx, sy, sz] of blobs) {
    const m = new THREE.Mesh(sphere, cream);
    m.position.set(x - FACE[0], y - FACE[1], z - FACE[2]);
    m.scale.set(sx, sy, sz);
    splatIn.add(m);
  }
  const c = new THREE.Mesh(sphere, berry);
  c.position.set(0.006 - FACE[0], 0.998 - FACE[1], 0.1 - FACE[2]);
  c.scale.setScalar(0.007);
  splatIn.add(c);
  const a = J.head.userData.abs;
  splat.position.set(FACE[0] - a[0], FACE[1] - a[1], FACE[2] - a[2]);
  splat.add(splatIn);
  splat.visible = false;
  J.head.add(splat);
}

function throwCake() {
  const pie = makePie();
  scene.add(pie);
  const from = camera.position.clone().add(new THREE.Vector3(0.6, -0.8, -1));
  const to = new THREE.Vector3();
  sfx.whoosh();
  act(4, (t, p, a) => {
    if (t < 0.45) {
      J.head.localToWorld(to.set(0, 0.045, 0.14));
      const k = t / 0.45;
      pie.position.lerpVectors(from, to, k);
      pie.position.y += Math.sin(Math.PI * k) * 0.4;
      pie.rotation.z = k * 4;
      p.brow += 1.5 * k;
      p.mouthW += k;
    }
    a.at(0.45, () => { scene.remove(pie); splat.visible = true; sfx.splat(); });
    const hit = bump(t, 0.45, 1.2);
    p.headX -= 0.4 * hit;
    p.torsoX -= 0.15 * hit;
    p.hair += hit;
    if (t > 0.45 && t < 3.2) p.blink = Math.max(p.blink, 1);
    const wipe = bump(t, 2.5, 3.6);
    p.armLY += 1.2 * wipe;
    p.armLX -= 1.5 * wipe;
    p.armRY -= 1.2 * wipe;
    p.armRX -= 1.5 * wipe;
    p.headY += 0.15 * Math.sin(t * 20) * wipe;
    const s = 1 - ramp(t, 2.9, 3.5);
    splat.scale.set(1, 1, 1).multiplyScalar(t < 0.6 ? 0.6 + 0.4 * ramp(t, 0.45, 0.6) : s);
    a.at(1.3, () => say(pick(['Ну бро…', 'Вкусно, но обидно', 'Это был мой лучший костюм'])));
    a.at(3.6, () => { splat.visible = false; splat.scale.setScalar(1); });
  }, { lock: true });
}

/* ── микрофон: слушаем → пишем фразу → проигрываем смешным голосом ── */
const micBtn = $('#mic');
const listenEl = $('#listen');
const mic = { on: false, state: 'off', stream: null, proc: null, pre: [], chunks: [], silent: 0, voiced: 0, len: 0, noise: 0.008, level: 0 };

async function micOn() {
  try {
    mic.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    say('Без микрофона я тебя не услышу, бро', { sound: false });
    return;
  }
  const src = ctx.createMediaStreamSource(mic.stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(proc);
  proc.connect(mute).connect(ctx.destination);
  proc.onaudioprocess = (e) => onMic(e.inputBuffer.getChannelData(0));
  mic.proc = proc;
  mic.on = true;
  mic.state = 'listen';
  micBtn.setAttribute('aria-pressed', 'true');
  listenEl.hidden = false;
  bubble('Говори, я повторю', 1600);
}
function micOff() {
  mic.on = false;
  mic.state = 'off';
  mic.proc && (mic.proc.onaudioprocess = null, mic.proc.disconnect());
  mic.stream?.getTracks().forEach((t) => t.stop());
  mic.stream = mic.proc = null;
  micBtn.setAttribute('aria-pressed', 'false');
  listenEl.hidden = true;
}
micBtn.addEventListener('click', () => {
  if (!ready) return;
  touch();
  mic.on ? micOff() : micOn();
});

function onMic(data) {
  if (!mic.on || mic.state === 'play') return;
  let s = 0;
  for (const v of data) s += v * v;
  const rms = Math.sqrt(s / data.length);
  mic.level = rms;
  const dur = data.length / ctx.sampleRate;
  const th = Math.max(0.018, mic.noise * 3);
  if (now() < quietUntil || now() < speakingUntil) {
    if (mic.state === 'rec') mic.state = 'listen';
    mic.pre = [];
    return;
  }
  if (mic.state === 'listen') {
    if (rms < th) mic.noise = mic.noise * 0.97 + rms * 0.03;
    mic.pre.push(new Float32Array(data));
    while (mic.pre.length * dur > 0.35) mic.pre.shift();
    if (rms > th) {
      mic.state = 'rec';
      mic.chunks = mic.pre;
      mic.pre = [];
      mic.silent = 0;
      mic.voiced = dur;
      mic.len = mic.chunks.length * dur;
    }
  } else if (mic.state === 'rec') {
    mic.chunks.push(new Float32Array(data));
    mic.len += dur;
    if (rms > th * 0.7) { mic.silent = 0; mic.voiced += dur; } else mic.silent += dur;
    if (mic.silent > 0.8 || mic.len > 10) finishRec(dur);
  }
}

function finishRec(chunkDur) {
  if (mic.voiced < 0.25) { mic.state = 'listen'; return; }
  const drop = Math.max(0, Math.floor((mic.silent - 0.15) / chunkDur));
  const chunks = mic.chunks.slice(0, mic.chunks.length - drop);
  mic.chunks = [];
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buf = ctx.createBuffer(1, total, ctx.sampleRate);
  const out = buf.getChannelData(0);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  // подтягиваем громкость, чтобы тихие фразы тоже было слышно
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= Math.min(4, 0.9 / peak);
  mic.state = 'play';
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = voice.rate;
  src.connect(voiceInput());
  src.onended = () => setTimeout(() => { if (mic.on) mic.state = 'listen'; mic.pre = []; }, 350);
  src.start();
  touch();
}

/* ── ввод текста ── */
const sayForm = $('#say');
const sayText = $('#sayText');
const typeBtn = $('#typeBtn');
typeBtn.addEventListener('click', () => {
  sayForm.hidden = !sayForm.hidden;
  typeBtn.setAttribute('aria-pressed', String(!sayForm.hidden));
  if (!sayForm.hidden) sayText.focus();
});
sayForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = sayText.value.trim();
  if (!text || !ready) return;
  touch();
  say(text);
  sayText.value = '';
});

/* ── указатель и тыки ── */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const look = { x: 0, y: 0, tx: 0, ty: 0, until: 0 };
function toNdc(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
}
canvas.addEventListener('pointermove', (e) => {
  toNdc(e);
  look.tx = ndc.x;
  look.ty = ndc.y;
  look.until = now() + 2.5;
});
canvas.addEventListener('pointerdown', (e) => {
  if (!ready) return;
  toNdc(e);
  look.tx = ndc.x;
  look.ty = ndc.y;
  look.until = now() + 2.5;
  touch();
  if (busy()) return;
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(hitMeshes, false)[0];
  if (!hit) return;
  const pos = skin.geometry.attributes.position, i = hit.face.a;
  react(zoneAt(pos.getX(i), pos.getY(i), pos.getZ(i)));
});
function react(zone) {
  if (zone === 'handL' || zone === 'handR') REACT.hand(zone);
  else REACT[zone]?.();
}

/* ── сами по себе: моргает, дышит, скучает ── */
let nextBlink = now() + 2, blinkT = -1;
let nextIdle = now() + rand(6, 10);
const IDLE = [
  () => act(3, (t, p) => { const k = bump(t, 0, 3); p.headZ += 0.55 * Math.sin(t * 2.1) * k; p.eyeX += 0.8 * Math.sin(t * 2.1) * k; }),
  () => act(2.6, (t, p) => { const k = bump(t, 0, 2.6); p.armLY += 2.6 * k; p.armRY -= 2.6 * k; p.torsoX -= 0.1 * k; p.mouth += 0.9 * bump(t, 0.4, 2.2); p.blink = Math.max(p.blink, k > 0.5 ? 1 : 0); }),
  () => act(1.6, (t, p) => { const k = bump(t, 0, 1.6); p.armRY -= 2.7 * k; p.armRX -= 0.35 * k; p.headY += 0.1 * k; }),
  () => act(1.2, (t, p) => { p.brow += bump(t, 0, 1.2); p.mouthW += 0.6 * bump(t, 0.2, 1.1); }),
];

function idle(t, p) {
  const breath = Math.sin(t * 1.7);
  p.torsoX += 0.015 * breath;
  p.headX -= 0.02 * breath;
  p.headY += 0.03 * Math.sin(t * 0.6);
  p.torsoY += 0.015 * Math.sin(t * 0.8);
  p.armLY += 0.06 + 0.02 * breath;
  p.armRY -= 0.06 + 0.02 * breath;

  // взгляд за пальцем, потом — на зрителя
  if (now() > look.until) { look.tx = 0; look.ty = 0; }
  const f = 1 - Math.exp(-dt * 4);
  look.x += (look.tx - look.x) * f;
  look.y += (look.ty - look.y) * f;
  p.headZ += look.x * 0.45;
  p.headX -= look.y * 0.25;
  p.eyeX += look.x;
  p.eyeY += look.y;

  if (now() > nextBlink) { blinkT = 0; nextBlink = now() + rand(2, 5.5); }
  if (blinkT >= 0) {
    p.blink = Math.max(p.blink, bump(blinkT, 0, 0.18));
    blinkT += dt;
    if (blinkT > 0.18) blinkT = -1;
  }

  if (!running.length && now() > nextIdle && ready) {
    pick(IDLE)();
    nextIdle = now() + rand(7, 13);
  }
  if (ready && !running.length && now() - lastTouch > 25) {
    touch();
    say(pick(['Эй, ты тут?', 'Бро, мне скучно', 'Потыкай меня, что ли']), { sound: false });
  }
}

/* ── кадр ── */
let dt = 0;
let ready = false;
const clock = new THREE.Clock();
const listenDot = listenEl.querySelector('i');

// Оси внутри модели: Y вверх, лицо в +Z. Значения поз придуманы в «метрах на экране», поэтому смещения делим на S.
function apply(p) {
  const b = J.body, s = p.squash;
  b.position.y = p.bodyY / S;
  b.rotation.y = p.bodyRot;
  b.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
  J.torso.rotation.set(p.torsoX, p.torsoZ, -p.torsoY);
  J.head.rotation.set(p.headX + p.brow * 0.03, p.headZ, -p.headY);
  const m = clamp01(p.mouth);
  J.jaw.rotation.x = m * 0.1;
  mouthHole.visible = m > 0.03;
  mouthHole.scale.set(0.013 * (1 + p.mouthW * 0.3 + m * 0.2), 0.001 + 0.006 * m, 0.011);
}

function tick() {
  dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const p = zero();
  idle(t, p);

  for (let i = running.length - 1; i >= 0; i--) {
    const a = running[i];
    a.t += dt;
    a.fn(a.t, p, a);
    if (a.t >= a.dur) running.splice(i, 1);
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.t += dt;
    f.update(f.t);
    if (f.t >= f.dur) { f.done(); fx.splice(i, 1); }
  }

  // голос: рот по громкости, у системного синтеза громкость не достать — шлёпаем ртом сами
  const lvl = voiceLevel();
  if (lvl > 0.004) {
    p.mouth += Math.min(1, lvl * 7);
    p.brow += Math.min(0.6, lvl * 3);
    p.headX += Math.min(0.1, lvl * 0.6) * Math.sin(t * 9);
  } else if (now() < speakingUntil) {
    p.mouth += 0.25 + 0.4 * Math.abs(Math.sin(t * 17) * Math.sin(t * 7.3));
  }

  // слушает: склоняет голову, брови вверх
  if (mic.on && mic.state !== 'play') {
    const k = mic.state === 'rec' ? 1 : 0.4;
    p.headY += 0.16 * k;
    p.brow += 0.7 * k;
    p.eyeY += 0.2 * k;
    listenEl.classList.toggle('rec', mic.state === 'rec');
    listenDot.style.transform = `scale(${1 + Math.min(1.2, mic.level * 25)})`;
  }

  const f = 1 - Math.exp(-dt * 16), ff = 1 - Math.exp(-dt * 38);
  for (const k of KEYS) cur[k] += (p[k] - cur[k]) * (FAST.has(k) ? ff : f);
  apply(cur);
  glow.scale.setScalar(1 - Math.min(0.4, cur.bodyY));

  renderer.render(scene, camera);
  placeBubble();
}
renderer.setAnimationLoop(tick);

/* ── загрузка и старт ── */
const go = $('#go');
new GLTFLoader().load(
  'tengiz.glb',
  (gltf) => {
    setupModel(gltf.scene);
    go.disabled = false;
    go.textContent = 'Погнали';
  },
  undefined,
  () => { go.textContent = 'Не загрузилась модель 😢'; },
);

go.addEventListener('click', () => {
  initAudio();
  ready = true;
  touch();
  $('#start').classList.add('out');
  setTimeout(() => $('#start').remove(), 500);
  REACT.hand('handR');
});

window.tengiz = { react, act: (name) => ACTIONS[name]?.() };
