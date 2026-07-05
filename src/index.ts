import {
  World,
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  eq,
  Follower,
  ScreenSpace,
  Mesh,
  Group,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  TorusGeometry,
  OctahedronGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  LineBasicMaterial,
  Color,
  Vector3,
  Fog,
  AmbientLight,
  PointLight,
  DirectionalLight,
  EdgesGeometry,
  LineSegments,
  AdditiveBlending,
  Float32BufferAttribute,
  BufferGeometry,
  InputComponent,
  Entity,
} from '@iwsdk/core';

// ===== TYPES & CONSTANTS =====
type GameState = 'title' | 'modes' | 'difficulty' | 'playing' | 'paused' | 'gameover' | 'levelcomplete' | 'leaderboard' | 'achievements' | 'settings' | 'stats' | 'skins' | 'help' | 'countdown';
type GameMode = 'campaign' | 'endless' | 'speed' | 'practice' | 'daily' | 'zen' | 'gravity' | 'hardcore';
type Difficulty = 'easy' | 'medium' | 'hard';

interface ObstacleData {
  type: 'spike' | 'wall' | 'gap' | 'saw' | 'pillar';
  x: number;
  width: number;
  height: number;
  isTop?: boolean;
}

interface CollectibleData {
  type: 'orb' | 'jumppad' | 'gravitypad' | 'speedboost';
  x: number;
  y: number;
}

interface LevelData {
  name: string;
  length: number;
  speed: number;
  obstacles: ObstacleData[];
  collectibles: CollectibleData[];
  parTime: number;
}

interface Achievement {
  id: string;
  name: string;
  desc: string;
  check: () => boolean;
}

interface ThemeColors {
  name: string;
  grid: string;
  accent: string;
  bg: string;
  fog: string;
  wall: string;
  player: string;
  spike: string;
  orb: string;
  glow: string;
}

const THEMES: ThemeColors[] = [
  { name: 'Neon Holodeck', grid: '#004444', accent: '#00ffff', bg: '#000811', fog: '#000811', wall: '#003333', player: '#00ffff', spike: '#ff0044', orb: '#ffcc00', glow: '#00ffff' },
  { name: 'Crimson Arena', grid: '#440000', accent: '#ff4444', bg: '#110000', fog: '#110000', wall: '#330000', player: '#ff4444', spike: '#ff8800', orb: '#ffcc00', glow: '#ff4444' },
  { name: 'Toxic Neon', grid: '#004400', accent: '#00ff44', bg: '#001100', fog: '#001100', wall: '#003300', player: '#00ff44', spike: '#ff0044', orb: '#ffcc00', glow: '#00ff44' },
  { name: 'Ultra Violet', grid: '#220044', accent: '#aa44ff', bg: '#080011', fog: '#080011', wall: '#330055', player: '#aa44ff', spike: '#ff0088', orb: '#ffcc00', glow: '#aa44ff' },
  { name: 'Solar Blaze', grid: '#442200', accent: '#ff8800', bg: '#110800', fog: '#110800', wall: '#332200', player: '#ff8800', spike: '#ff0044', orb: '#ffcc00', glow: '#ff8800' },
];

const SKINS = [
  { name: 'Neon Cyan', color: '#00ffff', emissive: '#004444', glow: '#00ffff', unlock: 'default' },
  { name: 'Solar Flare', color: '#ff8800', emissive: '#331100', glow: '#ff8800', unlock: '50 jumps' },
  { name: 'Plasma Pink', color: '#ff00ff', emissive: '#330033', glow: '#ff00ff', unlock: '5K score' },
  { name: 'Frost Blue', color: '#00ccff', emissive: '#002233', glow: '#00ccff', unlock: '10 games' },
  { name: 'Toxic Green', color: '#88ff00', emissive: '#223300', glow: '#88ff00', unlock: 'x5 combo' },
  { name: 'Royal Gold', color: '#ffcc00', emissive: '#332200', glow: '#ffcc00', unlock: 'Level 10' },
  { name: 'Void Purple', color: '#8800ff', emissive: '#220044', glow: '#8800ff', unlock: 'All modes' },
  { name: 'Inferno', color: '#ff4400', emissive: '#331100', glow: '#ff4400', unlock: 'Level 20' },
];

// ===== LEVEL GENERATION =====
function generateLevel(levelNum: number, mode: GameMode, difficulty: Difficulty): LevelData {
  const diffMult = difficulty === 'easy' ? 0.7 : difficulty === 'hard' ? 1.4 : 1.0;
  const baseSpeed = 4 + levelNum * 0.3;
  const speed = baseSpeed * diffMult;
  const length = 40 + levelNum * 8;
  const obstacles: ObstacleData[] = [];
  const collectibles: CollectibleData[] = [];

  // Seeded PRNG
  let seed = mode === 'daily' ? dateToSeed() : levelNum * 7919 + (difficulty === 'easy' ? 1 : difficulty === 'hard' ? 3 : 2);
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };

  const gapChance = 0.15 * diffMult;
  const spikeChance = 0.25 * diffMult;
  const wallChance = 0.12 * diffMult;
  const sawChance = 0.08 * diffMult;
  const pillarChance = 0.1 * diffMult;

  let x = 8;
  while (x < length - 5) {
    const r = rand();
    if (r < spikeChance) {
      obstacles.push({ type: 'spike', x, width: 0.6, height: 0.6 });
      if (rand() < 0.3) collectibles.push({ type: 'orb', x: x + 0.3, y: 2.5 });
      x += 2 + rand() * 2;
    } else if (r < spikeChance + wallChance) {
      const h = 1.0 + rand() * 1.5;
      obstacles.push({ type: 'wall', x, width: 0.8, height: h });
      if (rand() < 0.4) collectibles.push({ type: 'orb', x, y: h + 1.5 });
      x += 2.5 + rand() * 2;
    } else if (r < spikeChance + wallChance + gapChance) {
      const w = 1.5 + rand() * 1.5;
      obstacles.push({ type: 'gap', x, width: w, height: 0 });
      collectibles.push({ type: 'orb', x: x + w / 2, y: 1.5 });
      x += w + 2 + rand();
    } else if (r < spikeChance + wallChance + gapChance + sawChance) {
      obstacles.push({ type: 'saw', x, width: 0.8, height: 1.0 });
      x += 2.5 + rand() * 2;
    } else if (r < spikeChance + wallChance + gapChance + sawChance + pillarChance) {
      obstacles.push({ type: 'pillar', x, width: 0.4, height: 2.5 + rand() * 1.5 });
      if (rand() < 0.3) {
        obstacles.push({ type: 'spike', x: x + 0.2, width: 0.4, height: 0.4, isTop: true });
      }
      x += 3 + rand() * 2;
    } else {
      // Open section -- collectibles
      if (rand() < 0.5) collectibles.push({ type: 'orb', x, y: 0.8 + rand() * 2 });
      if (rand() < 0.15) collectibles.push({ type: 'jumppad', x, y: 0 });
      if (rand() < 0.08 && (mode === 'gravity' || levelNum > 5)) collectibles.push({ type: 'gravitypad', x, y: 0 });
      if (rand() < 0.1) collectibles.push({ type: 'speedboost', x, y: 0.5 });
      x += 1.5 + rand() * 2;
    }
  }

  // Ensure at least some orbs
  for (let ox = 5; ox < length; ox += 4 + rand() * 4) {
    if (rand() < 0.4 && !collectibles.some(c => Math.abs(c.x - ox) < 1.5)) {
      collectibles.push({ type: 'orb', x: ox, y: 0.8 + rand() * 1.5 });
    }
  }

  const names = ['Neon Streets', 'Pulse Highway', 'Grid Runner', 'Void Sprint', 'Cyber Lane',
    'Flux Corridor', 'Ion Path', 'Photon Road', 'Plasma Drive', 'Quantum Run',
    'Signal Surge', 'Vector Rush', 'Warp Track', 'Zero Point', 'Arc Lightning',
    'Digital Dash', 'Echo Runway', 'Fractal Way', 'Glow Circuit', 'Hyper Rail',
    'Laser Lane', 'Matrix Mile', 'Nova Route', 'Omega Pass', 'Prism Path'];
  const name = names[levelNum % names.length];

  return { name, length, speed, obstacles, collectibles, parTime: Math.floor(length / speed * 1.2) };
}

function dateToSeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// ===== PERSISTENCE =====
function loadData(key: string, def: any): any {
  try { const v = localStorage.getItem('neondash_' + key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function saveData(key: string, val: any): void {
  try { localStorage.setItem('neondash_' + key, JSON.stringify(val)); } catch {}
}

// ===== AUDIO =====
class AudioManager {
  ctx: AudioContext | null = null;
  masterVol = 1; sfxVol = 1; musicVol = 0.5;
  musicOscs: OscillatorNode[] = [];
  musicGain: GainNode | null = null;
  musicPlaying = false;

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    const saved = loadData('audio', null);
    if (saved) { this.masterVol = saved.m ?? 1; this.sfxVol = saved.s ?? 1; this.musicVol = saved.u ?? 0.5; }
  }

  saveVolumes() { saveData('audio', { m: this.masterVol, s: this.sfxVol, u: this.musicVol }); }

  playSfx(freq: number, type: OscillatorType, dur: number, vol = 0.3) {
    if (!this.ctx) return;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol * this.masterVol * this.sfxVol * (0.95 + Math.random() * 0.1), this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    g.connect(this.ctx.destination);
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq * (0.97 + Math.random() * 0.06), this.ctx.currentTime);
    o.connect(g);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  jump() { this.playSfx(440, 'triangle', 0.15, 0.25); this.playSfx(660, 'sine', 0.1, 0.15); }
  crash() { this.playSfx(120, 'sawtooth', 0.3, 0.4); this.playSfx(80, 'square', 0.25, 0.3); }
  orb() { this.playSfx(880, 'sine', 0.12, 0.2); this.playSfx(1100, 'triangle', 0.08, 0.15); }
  jumpPad() { this.playSfx(330, 'triangle', 0.2, 0.3); this.playSfx(550, 'sine', 0.15, 0.2); this.playSfx(770, 'sine', 0.1, 0.15); }
  gravityFlip() { this.playSfx(200, 'sawtooth', 0.25, 0.3); this.playSfx(400, 'sine', 0.2, 0.2); }
  speedBoost() { this.playSfx(600, 'square', 0.15, 0.2); this.playSfx(900, 'triangle', 0.1, 0.15); }
  levelComplete() {
    [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.playSfx(f, 'sine', 0.3, 0.3), i * 100));
  }
  countdown(n: number) { this.playSfx(n > 0 ? 440 : 880, 'sine', 0.1, 0.3); }
  click() { this.playSfx(660, 'sine', 0.05, 0.15); }
  achievement() { [660, 880, 1100, 1320, 1540].forEach((f, i) => setTimeout(() => this.playSfx(f, 'sine', 0.15, 0.2), i * 60)); }
  gameOver() { [440, 370, 311, 262].forEach((f, i) => setTimeout(() => this.playSfx(f, 'triangle', 0.2, 0.3), i * 120)); }
  gameStart() { [262, 330, 392, 523].forEach((f, i) => setTimeout(() => this.playSfx(f, 'triangle', 0.15, 0.25), i * 80)); }

  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.08 * this.masterVol * this.musicVol;
    this.musicGain.connect(this.ctx.destination);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    lp.connect(this.musicGain);
    // Bass drone
    const bass = this.ctx.createOscillator(); bass.type = 'sine'; bass.frequency.value = 55;
    bass.connect(lp); bass.start(); this.musicOscs.push(bass);
    // Pad
    const pad = this.ctx.createOscillator(); pad.type = 'triangle'; pad.frequency.value = 82.5;
    pad.connect(lp); pad.start(); this.musicOscs.push(pad);
    // Sub
    const sub = this.ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 110;
    sub.connect(lp); sub.start(); this.musicOscs.push(sub);
    // LFO
    const lfo = this.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.15;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 50;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(); this.musicOscs.push(lfo);
  }

  stopMusic() {
    this.musicOscs.forEach(o => { try { o.stop(); } catch {} });
    this.musicOscs = []; this.musicPlaying = false;
  }

  updateMusicVolume() {
    if (this.musicGain) this.musicGain.gain.value = 0.08 * this.masterVol * this.musicVol;
  }
}

// ===== PARTICLE SYSTEM =====
interface Particle { mesh: Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number; active: boolean; }

class ParticlePool {
  particles: Particle[] = [];
  scene: any;

  constructor(scene: any, count: number) {
    this.scene = scene;
    const geo = new SphereGeometry(0.03, 4, 4);
    for (let i = 0; i < count; i++) {
      const mat = new MeshBasicMaterial({ color: 0x00ffff, transparent: true, blending: AdditiveBlending });
      const m = new Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      this.particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, active: false });
    }
  }

  emit(x: number, y: number, z: number, count: number, color: number, speed = 3) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active || spawned >= count) continue;
      p.mesh.position.set(x, y, z);
      const angle = Math.random() * Math.PI * 2;
      const up = Math.random() * speed;
      p.vx = Math.cos(angle) * speed * (0.5 + Math.random());
      p.vy = up;
      p.vz = Math.sin(angle) * speed * 0.3;
      p.life = 0.5 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.active = true;
      p.mesh.visible = true;
      (p.mesh.material as MeshBasicMaterial).color.setHex(color);
      spawned++;
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; p.mesh.visible = false; continue; }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 6 * dt; // gravity
      const alpha = p.life / p.maxLife;
      (p.mesh.material as MeshBasicMaterial).opacity = alpha;
    }
  }
}

// ===== MAIN GAME =====
const container = document.getElementById('app') as HTMLDivElement;

const world = await World.create(container, {
  xr: { offer: 'once' },
  features: {
    locomotion: { browserControls: true },
  },
  render: {
    camera: { position: [0, 3, 8], lookAt: [0, 1, 0] },
    fov: 70,
  },
});

const audio = new AudioManager();
const particles = new ParticlePool(world.scene, 150);

// ===== GAME STATE =====
let state: GameState = 'title';
let mode: GameMode = 'campaign';
let difficulty: Difficulty = 'medium';
let themeIdx = loadData('theme', 0);
let skinIdx = loadData('skin', 0);
let currentLevel = loadData('campaignLevel', 1);

// Player physics
let playerX = 0;
let playerY = 0.5;
let playerVY = 0;
let playerSpeed = 0;
let gravityDir = 1; // 1=down, -1=up
const GRAVITY = 22;
const JUMP_FORCE = 9;
const SUPER_JUMP_FORCE = 14;
const PLAYER_SIZE = 0.4;
const GROUND_Y = 0.5;
const CEILING_Y = 5.5;

// Level state
let level: LevelData | null = null;
let levelProgress = 0;
let score = 0;
let attempts = 1;
let isGrounded = true;
let isDead = false;
let isComplete = false;
let countdownTimer = 0;
let countdownNum = 3;
let levelTime = 0;
let comboCount = 0;
let comboTimer = 0;
let speedMultiplier = 1;
let speedBoostTimer = 0;

// Stats
let stats = loadData('stats', { games: 0, jumps: 0, totalScore: 0, bestScore: 0, cleared: 0, bestStreak: 0, flips: 0, orbs: 0, playTime: 0, level: 1 });
let bestProgress: Record<string, number> = loadData('bestProgress', {});
let achUnlocked: Set<string> = new Set(loadData('achievements', []));
let achPage = 0;

// Leaderboard
let leaderboard: { score: number; mode: string; level: number; date: string }[] = loadData('leaderboard', []);

// 3D objects
let playerMesh: Mesh;
let playerGlow: Mesh;
let playerWireframe: LineSegments;
let playerGroup: Group;
let groundSegments: Mesh[] = [];
let obstacleGroup: Group;
let collectibleGroup: Group;
let obstacleObjects: { mesh: Group; data: ObstacleData; collected?: boolean }[] = [];
let collectibleObjects: { mesh: Group; data: CollectibleData; collected: boolean }[] = [];
let trailPoints: { mesh: Mesh; life: number }[] = [];
let cameraTargetX = 0;

// ===== SCENE SETUP =====
function applyTheme() {
  const t = THEMES[themeIdx % THEMES.length];
  world.scene.fog = new Fog(new Color(t.fog).getHex(), 5, 35);
  world.scene.background = new Color(t.bg);
}

function createHolodeck() {
  applyTheme();
  const t = THEMES[themeIdx % THEMES.length];

  // Grid floor
  const gridGeo = new BoxGeometry(200, 0.001, 200, 40, 1, 40);
  const gridMat = new MeshStandardMaterial({ color: new Color(t.grid), wireframe: true, transparent: true, opacity: 0.3 });
  const grid = new Mesh(gridGeo, gridMat);
  grid.position.y = 0;
  world.scene.add(grid);

  // Ceiling grid
  const ceilGrid = new Mesh(gridGeo, gridMat.clone());
  ceilGrid.rotation.x = Math.PI / 2;
  ceilGrid.position.y = 6;
  world.scene.add(ceilGrid);

  // Lights
  const ambient = new AmbientLight(new Color(t.accent).getHex(), 0.3);
  world.scene.add(ambient);
  const dir = new DirectionalLight(0xffffff, 0.6);
  dir.position.set(5, 10, 5);
  world.scene.add(dir);
  const accentLight1 = new PointLight(new Color(t.accent).getHex(), 1, 20);
  accentLight1.position.set(0, 4, 3);
  world.scene.add(accentLight1);
  const accentLight2 = new PointLight(new Color(t.glow).getHex(), 0.6, 15);
  accentLight2.position.set(0, 2, -3);
  world.scene.add(accentLight2);

  // Floating decorations
  const shapes = [new BoxGeometry(0.3, 0.3, 0.3), new SphereGeometry(0.2, 8, 8), new TorusGeometry(0.2, 0.06, 8, 12), new CylinderGeometry(0, 0.15, 0.3, 6)];
  for (let i = 0; i < 14; i++) {
    const geo = shapes[i % shapes.length];
    const mat = new MeshBasicMaterial({ color: new Color(t.accent), wireframe: true, transparent: true, opacity: 0.15 });
    const m = new Mesh(geo, mat);
    m.position.set((Math.random() - 0.5) * 20, 1 + Math.random() * 4, (Math.random() - 0.5) * 10 - 5);
    m.userData.rotSpeed = 0.2 + Math.random() * 0.5;
    m.userData.bobPhase = Math.random() * Math.PI * 2;
    m.userData.baseY = m.position.y;
    world.scene.add(m);
  }
}

function createPlayer() {
  const t = THEMES[themeIdx % THEMES.length];
  const s = SKINS[skinIdx % SKINS.length];
  playerGroup = new Group();

  // Main cube
  const geo = new BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);
  const mat = new MeshStandardMaterial({ color: new Color(s.color), emissive: new Color(s.emissive), emissiveIntensity: 0.5 });
  playerMesh = new Mesh(geo, mat);
  playerGroup.add(playerMesh);

  // Wireframe
  const edges = new EdgesGeometry(geo);
  const lineMat = new LineBasicMaterial({ color: new Color(s.glow), transparent: true, opacity: 0.8 });
  playerWireframe = new LineSegments(edges, lineMat);
  playerGroup.add(playerWireframe);

  // Glow
  const glowGeo = new BoxGeometry(PLAYER_SIZE * 1.3, PLAYER_SIZE * 1.3, PLAYER_SIZE * 1.3);
  const glowMat = new MeshBasicMaterial({ color: new Color(s.glow), transparent: true, opacity: 0.15, blending: AdditiveBlending });
  playerGlow = new Mesh(glowGeo, glowMat);
  playerGroup.add(playerGlow);

  playerGroup.position.set(0, GROUND_Y, 0);
  world.scene.add(playerGroup);
}

function buildLevel() {
  // Clean old level
  if (obstacleGroup) world.scene.remove(obstacleGroup);
  if (collectibleGroup) world.scene.remove(collectibleGroup);
  groundSegments.forEach(s => world.scene.remove(s));
  groundSegments = [];
  obstacleObjects = [];
  collectibleObjects = [];

  obstacleGroup = new Group();
  collectibleGroup = new Group();

  if (!level) return;

  const t = THEMES[themeIdx % THEMES.length];

  // Build ground segments (with gaps where needed)
  const gapSet = new Set<number>();
  level.obstacles.filter(o => o.type === 'gap').forEach(o => {
    for (let gx = Math.floor(o.x); gx < Math.ceil(o.x + o.width); gx++) gapSet.add(gx);
  });

  // Continuous ground strips
  let stripStart = -5;
  for (let x = -5; x <= level.length + 10; x++) {
    if (gapSet.has(x)) {
      if (x > stripStart) {
        const w = x - stripStart;
        const geo = new BoxGeometry(w, 0.2, 4);
        const mat = new MeshStandardMaterial({ color: new Color(t.wall), emissive: new Color(t.grid), emissiveIntensity: 0.3 });
        const seg = new Mesh(geo, mat);
        seg.position.set(stripStart + w / 2, -0.1, 0);
        obstacleGroup.add(seg);
        groundSegments.push(seg);
      }
      stripStart = x + 1;
    }
  }
  // Final strip
  const finalW = level.length + 10 - stripStart;
  if (finalW > 0) {
    const geo = new BoxGeometry(finalW, 0.2, 4);
    const mat = new MeshStandardMaterial({ color: new Color(t.wall), emissive: new Color(t.grid), emissiveIntensity: 0.3 });
    const seg = new Mesh(geo, mat);
    seg.position.set(stripStart + finalW / 2, -0.1, 0);
    obstacleGroup.add(seg);
    groundSegments.push(seg);
  }

  // Build obstacles
  for (const obs of level.obstacles) {
    const g = new Group();
    if (obs.type === 'spike') {
      const geo = new CylinderGeometry(0, 0.3, obs.height, 4);
      const mat = new MeshStandardMaterial({ color: new Color(t.spike), emissive: new Color(t.spike), emissiveIntensity: 0.4 });
      const m = new Mesh(geo, mat);
      const y = obs.isTop ? CEILING_Y - obs.height / 2 : obs.height / 2;
      if (obs.isTop) m.rotation.x = Math.PI;
      m.position.y = y;
      g.add(m);
      const edgeGeo = new EdgesGeometry(geo);
      const lineMat = new LineBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.6 });
      const wireframe = new LineSegments(edgeGeo, lineMat);
      wireframe.position.copy(m.position);
      wireframe.rotation.copy(m.rotation);
      g.add(wireframe);
    } else if (obs.type === 'wall') {
      const geo = new BoxGeometry(obs.width, obs.height, 1);
      const mat = new MeshStandardMaterial({ color: new Color(t.wall), emissive: new Color(t.accent), emissiveIntensity: 0.2 });
      const m = new Mesh(geo, mat);
      m.position.y = obs.height / 2;
      g.add(m);
      const edgeGeo = new EdgesGeometry(geo);
      const lineMat = new LineBasicMaterial({ color: new Color(t.accent), transparent: true, opacity: 0.5 });
      g.add(new LineSegments(edgeGeo, lineMat));
    } else if (obs.type === 'saw') {
      const geo = new TorusGeometry(0.4, 0.08, 8, 12);
      const mat = new MeshStandardMaterial({ color: 0xff0044, emissive: 0xff0044, emissiveIntensity: 0.5 });
      const m = new Mesh(geo, mat);
      m.position.y = 0.5 + obs.height;
      m.rotation.x = Math.PI / 2;
      g.add(m);
      // Inner spikes
      for (let i = 0; i < 8; i++) {
        const sGeo = new CylinderGeometry(0, 0.06, 0.15, 3);
        const sMat = new MeshBasicMaterial({ color: 0xff4444 });
        const spike = new Mesh(sGeo, sMat);
        const angle = (i / 8) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.4, 0.5 + obs.height, Math.sin(angle) * 0.4);
        spike.rotation.z = -angle + Math.PI / 2;
        g.add(spike);
      }
    } else if (obs.type === 'pillar') {
      const geo = new CylinderGeometry(0.2, 0.2, obs.height, 8);
      const mat = new MeshStandardMaterial({ color: new Color(t.wall), emissive: new Color(t.accent), emissiveIntensity: 0.3 });
      const m = new Mesh(geo, mat);
      m.position.y = obs.height / 2;
      g.add(m);
    }
    g.position.x = obs.x;
    obstacleGroup.add(g);
    obstacleObjects.push({ mesh: g, data: obs });
  }

  // Build collectibles
  for (const col of level.collectibles) {
    const g = new Group();
    if (col.type === 'orb') {
      const geo = new OctahedronGeometry(0.15);
      const mat = new MeshStandardMaterial({ color: new Color(t.orb), emissive: new Color(t.orb), emissiveIntensity: 0.6 });
      g.add(new Mesh(geo, mat));
      const glowGeo = new SphereGeometry(0.2, 8, 8);
      const glowMat = new MeshBasicMaterial({ color: new Color(t.orb), transparent: true, opacity: 0.2, blending: AdditiveBlending });
      g.add(new Mesh(glowGeo, glowMat));
    } else if (col.type === 'jumppad') {
      const geo = new BoxGeometry(0.6, 0.15, 0.6);
      const mat = new MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.5 });
      g.add(new Mesh(geo, mat));
      // Arrow on top
      const arrow = new CylinderGeometry(0, 0.15, 0.3, 4);
      const arrowMat = new MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 });
      const arrowMesh = new Mesh(arrow, arrowMat);
      arrowMesh.position.y = 0.3;
      g.add(arrowMesh);
    } else if (col.type === 'gravitypad') {
      const geo = new BoxGeometry(0.6, 0.15, 0.6);
      const mat = new MeshStandardMaterial({ color: 0x8800ff, emissive: 0x8800ff, emissiveIntensity: 0.5 });
      g.add(new Mesh(geo, mat));
      const ring = new TorusGeometry(0.25, 0.03, 8, 12);
      const ringMat = new MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.5 });
      const ringMesh = new Mesh(ring, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.2;
      g.add(ringMesh);
    } else if (col.type === 'speedboost') {
      const geo = new CylinderGeometry(0.15, 0.15, 0.6, 6);
      const mat = new MeshStandardMaterial({ color: 0xff8800, emissive: 0xff8800, emissiveIntensity: 0.5 });
      const m = new Mesh(geo, mat);
      m.rotation.z = Math.PI / 2;
      g.add(m);
    }
    g.position.set(col.x, col.y, 0);
    collectibleGroup.add(g);
    collectibleObjects.push({ mesh: g, data: col, collected: false });
  }

  // Goal marker at end
  const goalGeo = new TorusGeometry(1, 0.08, 8, 16);
  const goalMat = new MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.8 });
  const goal = new Mesh(goalGeo, goalMat);
  goal.position.set(level.length, 1.5, 0);
  goal.rotation.y = Math.PI / 2;
  collectibleGroup.add(goal);
  // Goal glow
  const goalGlow = new Mesh(new TorusGeometry(1.2, 0.15, 8, 16), new MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.15, blending: AdditiveBlending }));
  goalGlow.position.copy(goal.position);
  goalGlow.rotation.copy(goal.rotation);
  collectibleGroup.add(goalGlow);

  world.scene.add(obstacleGroup);
  world.scene.add(collectibleGroup);
}

function resetPlayer() {
  playerX = 0;
  playerY = GROUND_Y;
  playerVY = 0;
  gravityDir = 1;
  isGrounded = true;
  isDead = false;
  isComplete = false;
  levelProgress = 0;
  score = 0;
  levelTime = 0;
  comboCount = 0;
  comboTimer = 0;
  speedMultiplier = 1;
  speedBoostTimer = 0;
  playerGroup.position.set(0, GROUND_Y, 0);
  playerGroup.rotation.z = 0;
  cameraTargetX = 0;

  // Reset collectibles
  collectibleObjects.forEach(c => {
    c.collected = false;
    c.mesh.visible = true;
  });
}

function startGame(m: GameMode, d: Difficulty) {
  audio.init();
  mode = m;
  difficulty = d;
  const lvl = mode === 'endless' ? Math.floor(Math.random() * 100) + 1 : currentLevel;
  level = generateLevel(lvl, mode, difficulty);
  if (mode === 'zen') level.speed *= 0.6;
  if (mode === 'hardcore') level.speed *= 1.5;
  if (mode === 'speed') level.speed *= 1.3;

  playerSpeed = level.speed;
  attempts = 1;
  buildLevel();
  resetPlayer();

  countdownNum = 3;
  countdownTimer = 1;
  state = 'countdown';
  showPanel('countdown');
  audio.startMusic();
}

// ===== COLLISION =====
function checkCollisions(): boolean {
  if (!level) return false;
  const px = playerX;
  const py = playerY;
  const half = PLAYER_SIZE / 2;

  // Ground check (considering gaps)
  const groundLevel = gravityDir === 1 ? GROUND_Y : CEILING_Y;

  // Check gaps
  for (const obs of level.obstacles) {
    if (obs.type === 'gap') {
      if (px + half > obs.x && px - half < obs.x + obs.width) {
        // Over a gap
        if (gravityDir === 1 && py - half <= 0) return true; // Fell into gap
        if (gravityDir === -1 && py + half >= 6) return true;
      }
    }
  }

  // Obstacle collisions
  for (const obj of obstacleObjects) {
    const obs = obj.data;
    if (obs.type === 'gap') continue;
    const ox = obs.x;

    if (obs.type === 'spike') {
      const sy = obs.isTop ? CEILING_Y - obs.height : 0;
      const sh = obs.height;
      const sw = 0.4;
      if (px + half > ox - sw / 2 && px - half < ox + sw / 2 &&
          py + half > sy && py - half < sy + sh) {
        return true;
      }
    } else if (obs.type === 'wall') {
      if (px + half > ox - obs.width / 2 && px - half < ox + obs.width / 2 &&
          py + half > 0 && py - half < obs.height) {
        return true;
      }
    } else if (obs.type === 'saw') {
      const sx = ox;
      const sy = 0.5 + obs.height;
      const dist = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
      if (dist < 0.5) return true;
    } else if (obs.type === 'pillar') {
      const dist = Math.sqrt((px - ox) ** 2);
      if (dist < 0.2 + half && py - half < obs.height) {
        return true;
      }
    }
  }

  return false;
}

function checkCollectibles() {
  const px = playerX;
  const py = playerY;

  for (const col of collectibleObjects) {
    if (col.collected) continue;
    const dist = Math.sqrt((px - col.data.x) ** 2 + (py - col.data.y) ** 2);

    if (col.data.type === 'orb' && dist < 0.5) {
      col.collected = true;
      col.mesh.visible = false;
      comboCount++;
      comboTimer = 2;
      const pts = 100 * Math.min(comboCount, 10);
      score += pts;
      stats.orbs++;
      audio.orb();
      const t = THEMES[themeIdx % THEMES.length];
      particles.emit(col.data.x, col.data.y, 0, 8, new Color(t.orb).getHex());
    } else if (col.data.type === 'jumppad' && dist < 0.6 && isGrounded) {
      playerVY = SUPER_JUMP_FORCE * gravityDir * -1;
      isGrounded = false;
      audio.jumpPad();
      particles.emit(px, py, 0, 12, 0x00ff88);
    } else if (col.data.type === 'gravitypad' && dist < 0.6) {
      gravityDir *= -1;
      stats.flips++;
      audio.gravityFlip();
      particles.emit(px, py, 0, 15, 0x8800ff);
    } else if (col.data.type === 'speedboost' && dist < 0.5) {
      col.collected = true;
      col.mesh.visible = false;
      speedBoostTimer = 3;
      speedMultiplier = 1.5;
      audio.speedBoost();
      particles.emit(col.data.x, col.data.y, 0, 10, 0xff8800);
    }
  }
}

// ===== UI PANELS =====
const panelConfigs = [
  'title', 'modes', 'difficulty', 'hud', 'pause', 'gameover',
  'levelcomplete', 'leaderboard', 'achievements', 'settings',
  'stats', 'skins', 'help', 'countdown', 'toast'
] as const;

const panelEntities: Record<string, Entity> = {};
const panelDocs: Record<string, UIKitDocument> = {};

function showPanel(name: string) {
  for (const key in panelEntities) {
    const e = panelEntities[key];
    if (e && e.object3D) {
      e.object3D.visible = key === name || (key === 'hud' && (name === 'playing' || state === 'playing')) || (key === 'toast' && name === 'toast');
    }
  }
  // HUD always visible during play
  if (state === 'playing' && panelEntities['hud']?.object3D) {
    panelEntities['hud'].object3D.visible = true;
  }
}

function hideAllPanels() {
  for (const key in panelEntities) {
    const e = panelEntities[key];
    if (e && e.object3D) e.object3D.visible = false;
  }
}

function setText(doc: UIKitDocument | undefined, id: string, text: string) {
  if (!doc) return;
  const el = doc.getElementById(id) as UIKit.Text | undefined;
  el?.setProperties({ text });
}

function updateHUD() {
  const doc = panelDocs['hud'];
  if (!doc || !level) return;
  const pct = level.length > 0 ? Math.floor((playerX / level.length) * 100) : 0;
  setText(doc, 'hud-score', `Score: ${score}`);
  setText(doc, 'hud-progress', `${Math.min(pct, 100)}%`);
  setText(doc, 'hud-attempts', `Attempt: ${attempts}`);
  setText(doc, 'hud-mode', mode.charAt(0).toUpperCase() + mode.slice(1));
  setText(doc, 'hud-level', mode === 'campaign' ? `Level ${currentLevel}` : level.name);
}

function updateLeaderboard() {
  const doc = panelDocs['leaderboard'];
  if (!doc) return;
  for (let i = 0; i < 10; i++) {
    const entry = leaderboard[i];
    const text = entry ? `${i + 1}. ${entry.score} - ${entry.mode} L${entry.level} (${entry.date})` : `${i + 1}. ---`;
    setText(doc, `lb-r${i + 1}`, text);
  }
}

function updateStats() {
  const doc = panelDocs['stats'];
  if (!doc) return;
  setText(doc, 'stat-1', `Games Played: ${stats.games}`);
  setText(doc, 'stat-2', `Total Jumps: ${stats.jumps}`);
  setText(doc, 'stat-3', `Total Score: ${stats.totalScore}`);
  setText(doc, 'stat-4', `Best Score: ${stats.bestScore}`);
  setText(doc, 'stat-5', `Levels Cleared: ${stats.cleared}`);
  setText(doc, 'stat-6', `Best Streak: ${stats.bestStreak}`);
  setText(doc, 'stat-7', `Total Flips: ${stats.flips}`);
  setText(doc, 'stat-8', `Total Orbs: ${stats.orbs}`);
  const mins = Math.floor(stats.playTime / 60);
  const secs = Math.floor(stats.playTime % 60);
  setText(doc, 'stat-9', `Play Time: ${mins}:${secs < 10 ? '0' : ''}${secs}`);
  setText(doc, 'stat-10', `Level: ${stats.level}`);
}

// ===== ACHIEVEMENTS =====
const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_jump', name: 'First Jump', desc: 'Jump for the first time', check: () => stats.jumps >= 1 },
  { id: 'jumper_10', name: 'Jumping Jack', desc: '10 total jumps', check: () => stats.jumps >= 10 },
  { id: 'jumper_50', name: 'Spring Loaded', desc: '50 total jumps', check: () => stats.jumps >= 50 },
  { id: 'jumper_100', name: 'Bounce Master', desc: '100 total jumps', check: () => stats.jumps >= 100 },
  { id: 'jumper_500', name: 'Sky Walker', desc: '500 total jumps', check: () => stats.jumps >= 500 },
  { id: 'score_500', name: 'Getting Started', desc: 'Score 500 points', check: () => stats.bestScore >= 500 },
  { id: 'score_1k', name: 'Rising Star', desc: 'Score 1,000 points', check: () => stats.bestScore >= 1000 },
  { id: 'score_5k', name: 'Point Collector', desc: 'Score 5,000 points', check: () => stats.bestScore >= 5000 },
  { id: 'score_10k', name: 'Score Legend', desc: 'Score 10,000 points', check: () => stats.bestScore >= 10000 },
  { id: 'orb_10', name: 'Orb Hunter', desc: 'Collect 10 orbs', check: () => stats.orbs >= 10 },
  { id: 'orb_50', name: 'Orb Magnet', desc: 'Collect 50 orbs', check: () => stats.orbs >= 50 },
  { id: 'orb_100', name: 'Orb Hoarder', desc: 'Collect 100 orbs', check: () => stats.orbs >= 100 },
  { id: 'orb_500', name: 'Orb Master', desc: 'Collect 500 orbs', check: () => stats.orbs >= 500 },
  { id: 'flip_1', name: 'Gravity Bender', desc: 'Flip gravity once', check: () => stats.flips >= 1 },
  { id: 'flip_10', name: 'Anti-Gravity', desc: 'Flip gravity 10 times', check: () => stats.flips >= 10 },
  { id: 'flip_50', name: 'Gravity Master', desc: 'Flip gravity 50 times', check: () => stats.flips >= 50 },
  { id: 'clear_1', name: 'First Clear', desc: 'Complete a level', check: () => stats.cleared >= 1 },
  { id: 'clear_5', name: 'Trail Runner', desc: 'Complete 5 levels', check: () => stats.cleared >= 5 },
  { id: 'clear_10', name: 'Dasher', desc: 'Complete 10 levels', check: () => stats.cleared >= 10 },
  { id: 'clear_25', name: 'Speedster', desc: 'Complete 25 levels', check: () => stats.cleared >= 25 },
  { id: 'games_10', name: 'Persistent', desc: 'Play 10 games', check: () => stats.games >= 10 },
  { id: 'games_50', name: 'Dedicated', desc: 'Play 50 games', check: () => stats.games >= 50 },
  { id: 'games_100', name: 'Veteran', desc: 'Play 100 games', check: () => stats.games >= 100 },
  { id: 'streak_3', name: 'Combo Start', desc: 'Get a x3 combo', check: () => stats.bestStreak >= 3 },
  { id: 'streak_5', name: 'Combo Chain', desc: 'Get a x5 combo', check: () => stats.bestStreak >= 5 },
  { id: 'streak_10', name: 'Combo King', desc: 'Get a x10 combo', check: () => stats.bestStreak >= 10 },
  { id: 'daily_done', name: 'Daily Dasher', desc: 'Complete a daily challenge', check: () => loadData('dailyDone', false) },
  { id: 'skin_unlock', name: 'Fashionista', desc: 'Unlock a cube skin', check: () => getSkinUnlocks().filter(u => u).length > 1 },
  { id: 'theme_all', name: 'Theme Tourist', desc: 'Play with every theme', check: () => (loadData('themesUsed', []) as string[]).length >= 5 },
  { id: 'mode_all', name: 'Mode Explorer', desc: 'Play all 8 modes', check: () => (loadData('modesPlayed', []) as string[]).length >= 8 },
  { id: 'total_10k', name: 'Point Vault', desc: '10K total points', check: () => stats.totalScore >= 10000 },
  { id: 'total_50k', name: 'Point Empire', desc: '50K total points', check: () => stats.totalScore >= 50000 },
  { id: 'level_10', name: 'Level 10', desc: 'Reach XP level 10', check: () => stats.level >= 10 },
  { id: 'level_25', name: 'Level 25', desc: 'Reach XP level 25', check: () => stats.level >= 25 },
  { id: 'level_50', name: 'Level 50', desc: 'Reach XP level 50', check: () => stats.level >= 50 },
  { id: 'time_30', name: 'Marathon Start', desc: 'Play for 30 minutes', check: () => stats.playTime >= 1800 },
  { id: 'time_60', name: 'Marathon Runner', desc: 'Play for 60 minutes', check: () => stats.playTime >= 3600 },
  { id: 'perfect_run', name: 'Flawless', desc: 'Complete a level first try', check: () => loadData('perfectRun', false) },
  { id: 'speed_clear', name: 'Speed Demon', desc: 'Clear under par time', check: () => loadData('speedClear', false) },
  { id: 'hardcore_win', name: 'Fearless', desc: 'Complete hardcore mode', check: () => loadData('hardcoreWin', false) },
];

function checkAchievements() {
  for (const ach of ACHIEVEMENTS) {
    if (!achUnlocked.has(ach.id) && ach.check()) {
      achUnlocked.add(ach.id);
      saveData('achievements', Array.from(achUnlocked));
      showToast(`${ach.name}!`);
      audio.achievement();
    }
  }
}

function getSkinUnlocks(): boolean[] {
  return SKINS.map((s, i) => {
    if (i === 0) return true;
    if (i === 1) return stats.jumps >= 50;
    if (i === 2) return stats.bestScore >= 5000;
    if (i === 3) return stats.games >= 10;
    if (i === 4) return stats.bestStreak >= 5;
    if (i === 5) return stats.level >= 10;
    if (i === 6) return (loadData('modesPlayed', []) as string[]).length >= 8;
    if (i === 7) return stats.level >= 20;
    return false;
  });
}

function updateAchievementsPanel() {
  const doc = panelDocs['achievements'];
  if (!doc) return;
  const start = achPage * 15;
  for (let i = 0; i < 15; i++) {
    const idx = start + i;
    const ach = ACHIEVEMENTS[idx];
    const text = ach ? `${achUnlocked.has(ach.id) ? '[X]' : '[ ]'} ${ach.name}: ${ach.desc}` : '';
    setText(doc, `ach-${i + 1}`, text);
  }
  const totalPages = Math.ceil(ACHIEVEMENTS.length / 15);
  setText(doc, 'ach-page', `Page ${achPage + 1}/${totalPages}`);
}

function updateSkinsPanel() {
  const doc = panelDocs['skins'];
  if (!doc) return;
  const unlocks = getSkinUnlocks();
  for (let i = 0; i < SKINS.length; i++) {
    const s = SKINS[i];
    const equipped = i === skinIdx;
    const unlocked = unlocks[i];
    const label = equipped ? `${s.name} [E]` : unlocked ? s.name : `${s.name} (${s.unlock})`;
    setText(doc, `skin-${i + 1}`, label);
  }
}

let toastTimer = 0;
function showToast(msg: string) {
  const doc = panelDocs['toast'];
  if (!doc) return;
  setText(doc, 'toast-text', msg);
  if (panelEntities['toast']?.object3D) panelEntities['toast'].object3D.visible = true;
  toastTimer = 2;
}

function addToLeaderboard() {
  const d = new Date();
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  leaderboard.push({ score, mode, level: currentLevel, date });
  leaderboard.sort((a, b) => b.score - a.score);
  if (leaderboard.length > 20) leaderboard.length = 20;
  saveData('leaderboard', leaderboard);
}

// ===== TRAIL SYSTEM =====
function spawnTrail() {
  const s = SKINS[skinIdx % SKINS.length];
  const geo = new SphereGeometry(0.04, 4, 4);
  const mat = new MeshBasicMaterial({ color: new Color(s.glow), transparent: true, opacity: 0.5, blending: AdditiveBlending });
  const m = new Mesh(geo, mat);
  m.position.copy(playerGroup.position);
  world.scene.add(m);
  trailPoints.push({ mesh: m, life: 0.4 });
  if (trailPoints.length > 30) {
    const old = trailPoints.shift()!;
    world.scene.remove(old.mesh);
  }
}

function updateTrail(dt: number) {
  for (let i = trailPoints.length - 1; i >= 0; i--) {
    const t = trailPoints[i];
    t.life -= dt;
    if (t.life <= 0) {
      world.scene.remove(t.mesh);
      trailPoints.splice(i, 1);
    } else {
      (t.mesh.material as MeshBasicMaterial).opacity = t.life * 1.2;
    }
  }
}

// ===== CREATE PANELS =====
for (const name of panelConfigs) {
  const entity = world.createTransformEntity(new Group() as any);
  entity.addComponent(PanelUI, { config: `./ui/${name}.json` });

  if (name === 'hud' || name === 'countdown' || name === 'toast') {
    entity.addComponent(Follower, { target: world.player.head });
    entity.object3D!.position.set(0, 0, -1.5);
  } else {
    entity.addComponent(ScreenSpace, {});
    entity.object3D!.position.set(0, 1.5, -2);
  }

  entity.object3D!.visible = name === 'title';
  panelEntities[name] = entity;
}

// ===== GAME SYSTEM =====
let jumpPressed = false;
let prevJump = false;
let trailCooldown = 0;

class DashGameSystem extends createSystem({
  title: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/title.json')] },
  modes: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/modes.json')] },
  diff: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/difficulty.json')] },
  hud: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
  pause: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
  gameover: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/gameover.json')] },
  levelcomplete: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/levelcomplete.json')] },
  lb: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/leaderboard.json')] },
  ach: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achievements.json')] },
  settings: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
  statsQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/stats.json')] },
  skins: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/skins.json')] },
  help: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/help.json')] },
  countdown: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/countdown.json')] },
  toast: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/toast.json')] },
}) {
  init() {
    const wirePanel = (queryName: string, panelKey: string, setup: (doc: UIKitDocument) => void) => {
      (this.queries as any)[queryName].subscribe('qualify', (entity: Entity) => {
        const doc = PanelDocument.data.document[entity.index] as UIKitDocument;
        if (!doc) return;
        panelDocs[panelKey] = doc;
        setup(doc);
      });
    };

    const btn = (doc: UIKitDocument, id: string, cb: () => void) => {
      const el = doc.getElementById(id) as UIKit.Text | undefined;
      (el as any)?.addEventListener('click', () => { audio.init(); audio.click(); cb(); });
    };

    wirePanel('title', 'title', doc => {
      setText(doc, 'level-display', `Level ${stats.level}`);
      btn(doc, 'btn-play', () => { state = 'modes'; showPanel('modes'); });
      btn(doc, 'btn-modes', () => { state = 'modes'; showPanel('modes'); });
      btn(doc, 'btn-scores', () => { state = 'leaderboard'; updateLeaderboard(); showPanel('leaderboard'); });
      btn(doc, 'btn-achievements', () => { state = 'achievements'; achPage = 0; updateAchievementsPanel(); showPanel('achievements'); });
      btn(doc, 'btn-stats', () => { state = 'stats'; updateStats(); showPanel('stats'); });
      btn(doc, 'btn-skins', () => { state = 'skins'; updateSkinsPanel(); showPanel('skins'); });
      btn(doc, 'btn-settings', () => { state = 'settings'; showPanel('settings'); });
      btn(doc, 'btn-help', () => { state = 'help'; showPanel('help'); });
    });

    wirePanel('modes', 'modes', doc => {
      const startMode = (m: GameMode) => () => { mode = m; state = 'difficulty'; showPanel('difficulty'); };
      btn(doc, 'btn-campaign', startMode('campaign'));
      btn(doc, 'btn-endless', startMode('endless'));
      btn(doc, 'btn-speed', startMode('speed'));
      btn(doc, 'btn-practice', startMode('practice'));
      btn(doc, 'btn-daily', startMode('daily'));
      btn(doc, 'btn-zen', startMode('zen'));
      btn(doc, 'btn-gravity', startMode('gravity'));
      btn(doc, 'btn-hardcore', startMode('hardcore'));
      btn(doc, 'btn-modes-back', () => { state = 'title'; showPanel('title'); });
    });

    wirePanel('diff', 'difficulty', doc => {
      btn(doc, 'btn-easy', () => startGame(mode, 'easy'));
      btn(doc, 'btn-medium', () => startGame(mode, 'medium'));
      btn(doc, 'btn-hard', () => startGame(mode, 'hard'));
      btn(doc, 'btn-diff-back', () => { state = 'modes'; showPanel('modes'); });
    });

    wirePanel('hud', 'hud', () => {});

    wirePanel('pause', 'pause', doc => {
      btn(doc, 'btn-resume', () => { state = 'playing'; showPanel('hud'); });
      btn(doc, 'btn-restart', () => { resetPlayer(); countdownNum = 3; countdownTimer = 1; state = 'countdown'; showPanel('countdown'); });
      btn(doc, 'btn-quit', () => { audio.stopMusic(); state = 'title'; showPanel('title'); });
    });

    wirePanel('gameover', 'gameover', doc => {
      btn(doc, 'btn-retry', () => { attempts++; resetPlayer(); countdownNum = 3; countdownTimer = 1; state = 'countdown'; showPanel('countdown'); });
      btn(doc, 'btn-go-menu', () => { audio.stopMusic(); state = 'title'; showPanel('title'); });
    });

    wirePanel('levelcomplete', 'levelcomplete', doc => {
      btn(doc, 'btn-next', () => {
        currentLevel++;
        saveData('campaignLevel', currentLevel);
        startGame(mode, difficulty);
      });
      btn(doc, 'btn-lc-retry', () => { startGame(mode, difficulty); });
      btn(doc, 'btn-lc-menu', () => { audio.stopMusic(); state = 'title'; showPanel('title'); });
    });

    wirePanel('lb', 'leaderboard', doc => {
      btn(doc, 'btn-lb-back', () => { state = 'title'; showPanel('title'); });
    });

    wirePanel('ach', 'achievements', doc => {
      btn(doc, 'btn-ach-prev', () => { if (achPage > 0) { achPage--; updateAchievementsPanel(); } });
      btn(doc, 'btn-ach-next', () => { const total = Math.ceil(ACHIEVEMENTS.length / 15); if (achPage < total - 1) { achPage++; updateAchievementsPanel(); } });
      btn(doc, 'btn-ach-back', () => { state = 'title'; showPanel('title'); });
    });

    wirePanel('settings', 'settings', doc => {
      const updateSettingsUI = () => {
        setText(doc, 'set-master', `Master: ${Math.round(audio.masterVol * 100)}%`);
        setText(doc, 'set-sfx', `SFX: ${Math.round(audio.sfxVol * 100)}%`);
        setText(doc, 'set-music', `Music: ${Math.round(audio.musicVol * 100)}%`);
        setText(doc, 'set-theme', `Theme: ${THEMES[themeIdx % THEMES.length].name}`);
      };
      const volStep = (prop: 'masterVol' | 'sfxVol' | 'musicVol', dir: number) => () => {
        audio.init();
        (audio as any)[prop] = Math.max(0, Math.min(1, (audio as any)[prop] + dir * 0.1));
        audio.updateMusicVolume();
        audio.saveVolumes();
        updateSettingsUI();
      };
      btn(doc, 'btn-master-up', volStep('masterVol', 1));
      btn(doc, 'btn-master-dn', volStep('masterVol', -1));
      btn(doc, 'btn-sfx-up', volStep('sfxVol', 1));
      btn(doc, 'btn-sfx-dn', volStep('sfxVol', -1));
      btn(doc, 'btn-music-up', volStep('musicVol', 1));
      btn(doc, 'btn-music-dn', volStep('musicVol', -1));
      btn(doc, 'btn-theme-prev', () => { themeIdx = (themeIdx - 1 + THEMES.length) % THEMES.length; saveData('theme', themeIdx); applyTheme(); updateSettingsUI(); });
      btn(doc, 'btn-theme-next', () => { themeIdx = (themeIdx + 1) % THEMES.length; saveData('theme', themeIdx); applyTheme(); updateSettingsUI(); });
      btn(doc, 'btn-set-back', () => { state = 'title'; showPanel('title'); });
      updateSettingsUI();
    });

    wirePanel('statsQ', 'stats', doc => {
      btn(doc, 'btn-stats-back', () => { state = 'title'; showPanel('title'); });
    });

    wirePanel('skins', 'skins', doc => {
      for (let i = 0; i < SKINS.length; i++) {
        btn(doc, `skin-${i + 1}`, () => {
          const unlocks = getSkinUnlocks();
          if (unlocks[i]) {
            skinIdx = i;
            saveData('skin', skinIdx);
            // Update player visuals
            const s = SKINS[skinIdx];
            (playerMesh.material as MeshStandardMaterial).color.set(s.color);
            (playerMesh.material as MeshStandardMaterial).emissive.set(s.emissive);
            (playerWireframe.material as LineBasicMaterial).color.set(s.glow);
            (playerGlow.material as MeshBasicMaterial).color.set(s.glow);
            updateSkinsPanel();
          }
        });
      }
      btn(doc, 'btn-skins-back', () => { state = 'title'; showPanel('title'); });
    });

    wirePanel('help', 'help', doc => {
      btn(doc, 'btn-help-back', () => { state = 'title'; showPanel('title'); });
    });

    wirePanel('countdown', 'countdown', () => {});
    wirePanel('toast', 'toast', () => {});
  }

  update(delta: number, _time: number) {
    const dt = Math.min(delta, 0.05);

    // Input
    const kb = world.input.keyboard;
    const rightGP = world.input.xr?.gamepads?.right;
    const jumpInput = kb?.getKeyDown('Space') || kb?.getKeyDown('ArrowUp') || kb?.getKeyDown('KeyW') ||
      rightGP?.getButtonDown(InputComponent.Trigger) || rightGP?.getButtonDown(InputComponent.A_Button) || false;
    const pauseInput = kb?.getKeyDown('Escape') || kb?.getKeyDown('KeyP') ||
      rightGP?.getButtonDown(InputComponent.B_Button) || false;
    const restartInput = kb?.getKeyDown('KeyR') || false;

    // Toast
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0 && panelEntities['toast']?.object3D) {
        panelEntities['toast'].object3D.visible = false;
      }
    }

    // Particles
    particles.update(dt);

    // Trail
    updateTrail(dt);

    // Animate collectibles
    for (const col of collectibleObjects) {
      if (col.collected) continue;
      col.mesh.rotation.y += dt * 2;
      if (col.data.type === 'orb') {
        col.mesh.position.y = col.data.y + Math.sin(_time * 3 + col.data.x) * 0.1;
      }
    }

    // Animate obstacles (saws rotate)
    for (const obs of obstacleObjects) {
      if (obs.data.type === 'saw' && obs.mesh.children[0]) {
        obs.mesh.children[0].rotation.z += dt * 5;
      }
    }

    // Floating decorations
    world.scene.children.forEach((child: any) => {
      if (child.userData.rotSpeed) {
        child.rotation.y += child.userData.rotSpeed * dt;
        child.position.y = child.userData.baseY + Math.sin(_time + child.userData.bobPhase) * 0.15;
      }
    });

    if (state === 'countdown') {
      countdownTimer -= dt;
      if (countdownTimer <= 0) {
        countdownNum--;
        if (countdownNum > 0) {
          countdownTimer = 1;
          const doc = panelDocs['countdown'];
          setText(doc, 'countdown-text', `${countdownNum}`);
          audio.countdown(countdownNum);
        } else {
          // GO!
          const doc = panelDocs['countdown'];
          setText(doc, 'countdown-text', 'DASH!');
          audio.countdown(0);
          setTimeout(() => {
            state = 'playing';
            hideAllPanels();
            if (panelEntities['hud']?.object3D) panelEntities['hud'].object3D.visible = true;
            audio.gameStart();

            // Track modes played
            const played = loadData('modesPlayed', []) as string[];
            if (!played.includes(mode)) { played.push(mode); saveData('modesPlayed', played); }
            const themes = loadData('themesUsed', []) as string[];
            const tName = THEMES[themeIdx % THEMES.length].name;
            if (!themes.includes(tName)) { themes.push(tName); saveData('themesUsed', themes); }
          }, 500);
        }
      }
      return;
    }

    if (state !== 'playing') return;

    // Pause
    if (pauseInput) {
      state = 'paused';
      showPanel('pause');
      return;
    }

    // Restart
    if (restartInput) {
      attempts++;
      resetPlayer();
      countdownNum = 3;
      countdownTimer = 1;
      state = 'countdown';
      showPanel('countdown');
      return;
    }

    if (isDead || isComplete) return;

    levelTime += dt;
    stats.playTime += dt;

    // Speed boost
    if (speedBoostTimer > 0) {
      speedBoostTimer -= dt;
      if (speedBoostTimer <= 0) speedMultiplier = 1;
    }

    // Combo decay
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        if (comboCount > stats.bestStreak) stats.bestStreak = comboCount;
        comboCount = 0;
      }
    }

    // Player movement
    const effectiveSpeed = playerSpeed * speedMultiplier;
    playerX += effectiveSpeed * dt;

    // Jump
    if (jumpInput && isGrounded) {
      playerVY = JUMP_FORCE * (gravityDir === 1 ? 1 : -1);
      isGrounded = false;
      stats.jumps++;
      audio.jump();
    }

    // Gravity
    playerVY -= GRAVITY * gravityDir * dt;
    playerY += playerVY * dt;

    // Ground/ceiling collision
    if (gravityDir === 1) {
      if (playerY <= GROUND_Y) {
        playerY = GROUND_Y;
        playerVY = 0;
        isGrounded = true;
      }
      if (playerY >= CEILING_Y) {
        playerY = CEILING_Y;
        playerVY = 0;
      }
    } else {
      if (playerY >= CEILING_Y) {
        playerY = CEILING_Y;
        playerVY = 0;
        isGrounded = true;
      }
      if (playerY <= GROUND_Y) {
        playerY = GROUND_Y;
        playerVY = 0;
      }
    }

    // Check collectibles
    checkCollectibles();

    // Check collisions
    if (checkCollisions()) {
      isDead = true;
      audio.crash();
      const t = THEMES[themeIdx % THEMES.length];
      particles.emit(playerX, playerY, 0, 20, new Color(t.spike).getHex(), 5);

      stats.games++;
      stats.totalScore += score;
      if (score > stats.bestScore) stats.bestScore = score;
      stats.level = Math.floor(1 + stats.totalScore / 500);
      saveData('stats', stats);

      const key = `${mode}_${difficulty}_${currentLevel}`;
      const pct = level ? Math.floor((playerX / level.length) * 100) : 0;
      if (!bestProgress[key] || pct > bestProgress[key]) bestProgress[key] = pct;
      saveData('bestProgress', bestProgress);

      addToLeaderboard();
      checkAchievements();

      // Update gameover panel
      const doc = panelDocs['gameover'];
      if (doc) {
        setText(doc, 'go-score', `Score: ${score}`);
        setText(doc, 'go-progress', `Progress: ${Math.min(pct, 100)}%`);
        setText(doc, 'go-attempts', `Attempts: ${attempts}`);
        setText(doc, 'go-best', `Best: ${bestProgress[key] || 0}%`);
        setText(doc, 'go-mode', mode.charAt(0).toUpperCase() + mode.slice(1));
      }

      audio.gameOver();
      state = 'gameover';
      showPanel('gameover');
      return;
    }

    // Level complete
    if (level && playerX >= level.length) {
      isComplete = true;
      stats.games++;
      stats.cleared++;
      stats.totalScore += score;
      if (score > stats.bestScore) stats.bestScore = score;
      stats.level = Math.floor(1 + stats.totalScore / 500);
      if (attempts === 1) saveData('perfectRun', true);
      if (level.parTime > 0 && levelTime < level.parTime) saveData('speedClear', true);
      if (mode === 'hardcore') saveData('hardcoreWin', true);
      if (mode === 'daily') saveData('dailyDone', true);
      saveData('stats', stats);
      addToLeaderboard();
      checkAchievements();

      const stars = attempts === 1 ? 3 : attempts <= 3 ? 2 : 1;
      audio.levelComplete();
      particles.emit(playerX, playerY, 0, 30, 0x00ff88, 6);

      const doc = panelDocs['levelcomplete'];
      if (doc) {
        setText(doc, 'lc-level', level.name);
        setText(doc, 'lc-score', `Score: ${score}`);
        setText(doc, 'lc-attempts', `Attempts: ${attempts}`);
        const mins = Math.floor(levelTime / 60);
        const secs = Math.floor(levelTime % 60);
        setText(doc, 'lc-time', `Time: ${mins}:${secs < 10 ? '0' : ''}${secs}`);
        setText(doc, 'lc-stars', '* '.repeat(stars).trim());
      }

      state = 'levelcomplete';
      showPanel('levelcomplete');
      return;
    }

    // Update player position
    playerGroup.position.set(playerX, playerY, 0);
    // Rotation based on velocity
    const rotTarget = gravityDir === 1 ? -effectiveSpeed * 0.08 : effectiveSpeed * 0.08;
    playerGroup.rotation.z += (rotTarget - playerGroup.rotation.z) * dt * 5;

    // Player glow pulse
    (playerGlow.material as MeshBasicMaterial).opacity = 0.1 + Math.sin(_time * 4) * 0.05;

    // Trail
    trailCooldown -= dt;
    if (trailCooldown <= 0) {
      spawnTrail();
      trailCooldown = 0.03;
    }

    // Camera follow
    cameraTargetX += (playerX + 3 - cameraTargetX) * dt * 4;
    world.camera.position.x = cameraTargetX;
    world.camera.position.y = 3;
    world.camera.position.z = 8;
    world.camera.lookAt(new Vector3(cameraTargetX, 1.5, 0));

    // Update HUD
    updateHUD();

    // Progress
    if (level) {
      levelProgress = Math.floor((playerX / level.length) * 100);
    }
  }
}

// ===== INIT =====
createHolodeck();
createPlayer();
world.registerSystem(DashGameSystem);
showPanel('title');
