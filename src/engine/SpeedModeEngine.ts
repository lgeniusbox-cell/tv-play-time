/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpeedGameConfig } from '../types/game';
import { UnifiedInputState } from './InputManager';
import { AUDIO } from './AudioManager';
import { VideoManager } from './VideoManager';

export interface SpeedGameState {
  score: number;
  distance: number;
  coins: number;
  combo: number;
  maxCombo: number;
  lives: number;
  speed: number;
  isGameOver: boolean;
  isVictory: boolean;
}

interface ObstacleInstance {
  id: number;
  type: 'hurdle' | 'beam' | 'drone' | 'pylon';
  action: 'jump' | 'slide' | 'dodge';
  lane: number; // 0: Left, 1: Center, 2: Right, -1: all lanes
  z: number; // 1.0 (distant horizon) to 0.0 (player line)
  cleared: boolean;
  color: string;
}

interface CoinInstance {
  id: number;
  lane: number;
  z: number;
  collected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export class SpeedModeEngine {
  private config: SpeedGameConfig;
  private videoMgr: VideoManager;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: SpeedGameState = {
    score: 0,
    distance: 0,
    coins: 0,
    combo: 0,
    maxCombo: 0,
    lives: 3,
    speed: 1.0,
    isGameOver: false,
    isVictory: false,
  };

  private obstacles: ObstacleInstance[] = [];
  private coins: CoinInstance[] = [];
  private particles: Particle[] = [];

  private nextObstacleTime = 0;
  private nextCoinTime = 0;
  private instanceCounter = 0;

  // Player animation state
  private playerLane = 1; // 0: left, 1: center, 2: right
  private playerVisualX = 0.5;
  private playerElevation = 0; // jump height
  private playerCrouch = 0; // slide crouch
  private invulnerableTimer = 0;

  private onStateChangeCallback?: (state: SpeedGameState) => void;

  constructor(config: SpeedGameConfig, videoMgr: VideoManager, canvas: HTMLCanvasElement) {
    this.config = config;
    this.videoMgr = videoMgr;
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot get 2D context');
    this.ctx = context;

    this.videoMgr.setSpeedRange(config.speedRange || [0.5, 2.5]);
    this.videoMgr.loadLoop(config.videoUrl);
  }

  public onStateChange(cb: (state: SpeedGameState) => void): void {
    this.onStateChangeCallback = cb;
  }

  public update(dt: number, input: UnifiedInputState): void {
    if (this.state.isGameOver || this.state.isVictory) return;

    // 1. Modulate playbackRate and speed from INTENSITY
    this.videoMgr.setIntensity(input.intensity);
    const speed = this.videoMgr.getPlaybackRate();
    this.state.speed = speed;
    AUDIO.setMusicSpeed(speed);

    // 2. Advance distance and score
    this.state.distance += dt * speed * 25;
    this.state.score += Math.round(dt * speed * 15 * (1 + this.state.combo * 0.1));

    // Check Victory condition
    const targetDist = this.config.targetDistance || 2000;
    if (this.state.distance >= targetDist) {
      this.state.isVictory = true;
      AUDIO.playWin();
      this.notifyState();
      return;
    }

    // 3. Update Player Lane and Moves
    this.playerLane = input.activeLane;
    const targetVisualX = (this.playerLane + 0.5) / 3;
    this.playerVisualX += (targetVisualX - this.playerVisualX) * 0.25;

    // Jump mechanics
    if (input.actions.JUMP && this.playerElevation === 0) {
      this.playerElevation = 1.0;
      AUDIO.playJump();
    }
    if (this.playerElevation > 0) {
      this.playerElevation = Math.max(0, this.playerElevation - dt * 2.5);
    }

    // Slide mechanics
    if (input.actions.SLIDE && this.playerCrouch === 0) {
      this.playerCrouch = 1.0;
      AUDIO.playSlide();
    }
    if (this.playerCrouch > 0) {
      this.playerCrouch = Math.max(0, this.playerCrouch - dt * 2.8);
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    // 4. Spawn Obstacles
    const spawnRate = (this.config.spawnRate || 1.2) * (this.config.difficulty || 1.0);
    this.nextObstacleTime -= dt * speed;
    if (this.nextObstacleTime <= 0) {
      this.spawnObstacle();
      this.nextObstacleTime = Math.max(1.1, (2.6 / spawnRate) + (Math.random() * 0.8));
    }

    // 5. Spawn Coins
    this.nextCoinTime -= dt * speed;
    if (this.nextCoinTime <= 0) {
      this.spawnCoinRing();
      this.nextCoinTime = 1.4 + Math.random() * 1.5;
    }

    // 6. Update and Collision Detect Obstacles
    const obstacleSpeed = 0.45 * speed;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.z -= dt * obstacleSpeed;

      // Check collision window (z near player: 0.12 to 0.0)
      if (!obs.cleared && obs.z <= 0.12 && obs.z >= -0.04) {
        const inLane = obs.lane === -1 || obs.lane === this.playerLane;

        if (inLane) {
          let evaded = false;
          if (obs.action === 'jump' && this.playerElevation > 0.3) {
            evaded = true;
          } else if (obs.action === 'slide' && this.playerCrouch > 0.3) {
            evaded = true;
          } else if (obs.action === 'dodge' && obs.lane !== this.playerLane) {
            evaded = true;
          }

          if (evaded) {
            obs.cleared = true;
            this.state.combo += 1;
            this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
            this.state.score += 50 * this.state.combo;
            AUDIO.playGood();
            this.createBurst(this.playerVisualX, 0.8, '#38bdf8');
          } else if (this.invulnerableTimer <= 0) {
            // Player Hit!
            obs.cleared = true;
            this.state.lives -= 1;
            this.state.combo = 0;
            this.invulnerableTimer = 1.2;
            AUDIO.playHit();
            this.createBurst(this.playerVisualX, 0.8, '#f43f5e', 25);

            if (this.state.lives <= 0) {
              this.state.isGameOver = true;
              this.notifyState();
              return;
            }
          }
        }
      }

      // Remove passed obstacles
      if (obs.z < -0.2) {
        this.obstacles.splice(i, 1);
      }
    }

    // 7. Update and Collect Coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.z -= dt * obstacleSpeed;

      if (!coin.collected && coin.z <= 0.14 && coin.z >= -0.05 && coin.lane === this.playerLane) {
        coin.collected = true;
        this.state.coins += 1;
        this.state.score += 100;
        AUDIO.playCoin();
        this.createBurst((coin.lane + 0.5) / 3, 0.85, '#facc15');
      }

      if (coin.z < -0.2) {
        this.coins.splice(i, 1);
      }
    }

    // 8. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.notifyState();
  }

  private spawnObstacle(): void {
    const list = this.config.obstacles || [
      { type: 'hurdle', action: 'jump', color: '#f43f5e' },
      { type: 'beam', action: 'slide', color: '#eab308' },
      { type: 'drone', action: 'dodge', color: '#06b6d4' },
    ];

    const template = list[Math.floor(Math.random() * list.length)];
    let lane = Math.floor(Math.random() * 3);

    // Hurdle or beam can span all lanes or a single lane
    if (template.action === 'jump' || template.action === 'slide') {
      if (Math.random() > 0.4) lane = -1; // Spans all 3 lanes!
    }

    this.obstacles.push({
      id: ++this.instanceCounter,
      type: template.type,
      action: template.action,
      lane,
      z: 1.0,
      cleared: false,
      color: template.color || '#f43f5e',
    });
  }

  private spawnCoinRing(): void {
    const lane = Math.floor(Math.random() * 3);
    for (let c = 0; c < 3; c++) {
      this.coins.push({
        id: ++this.instanceCounter,
        lane,
        z: 1.0 + c * 0.08,
        collected: false,
      });
    }
  }

  private createBurst(normX: number, normY: number, color: string, count = 12): void {
    const x = normX * this.canvas.width;
    const y = normY * this.canvas.height;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 250;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color,
      });
    }
  }

  public render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const horizonY = h * 0.42;
    const roadTopLeft = w * 0.42;
    const roadTopRight = w * 0.58;
    const roadBottomLeft = w * 0.08;
    const roadBottomRight = w * 0.92;

    // Helper for perspective projection
    const project = (laneNorm: number, z: number) => {
      // z: 1.0 (far horizon) -> 0.0 (near bottom)
      const p = Math.pow(1 - z, 2.2);
      const y = horizonY + (h - horizonY) * p;
      const leftAtY = roadTopLeft + (roadBottomLeft - roadTopLeft) * p;
      const rightAtY = roadTopRight + (roadBottomRight - roadTopRight) * p;
      const x = leftAtY + (rightAtY - leftAtY) * laneNorm;
      const scale = 0.15 + 0.85 * p;
      return { x, y, scale, width: (rightAtY - leftAtY) / 3 };
    };

    // Render Coins (sorted far to near)
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const pt = project((coin.lane + 0.5) / 3, coin.z);
      const radius = 24 * pt.scale;

      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 15 * pt.scale, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 10 * pt.scale;
      ctx.fill();

      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3 * pt.scale;
      ctx.stroke();
      ctx.restore();
    }

    // Render Obstacles (sorted far to near)
    for (const obs of this.obstacles) {
      const z = obs.z;
      const normLane = obs.lane === -1 ? 0.5 : (obs.lane + 0.5) / 3;
      const pt = project(normLane, z);

      ctx.save();
      ctx.shadowBlur = 14 * pt.scale;
      ctx.shadowColor = obs.color;

      if (obs.action === 'jump') {
        // Hurdle on the ground (requires JUMP)
        const hurdleWidth = obs.lane === -1 ? pt.width * 2.9 : pt.width * 0.85;
        const hurdleHeight = 40 * pt.scale;
        ctx.fillStyle = obs.color;
        ctx.fillRect(pt.x - hurdleWidth / 2, pt.y - hurdleHeight, hurdleWidth, hurdleHeight);

        // Warning striped pattern
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(18 * pt.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('▲ JUMP ▲', pt.x, pt.y - hurdleHeight * 0.3);
      } else if (obs.action === 'slide') {
        // Overhead beam (requires SLIDE)
        const beamWidth = obs.lane === -1 ? pt.width * 2.9 : pt.width * 0.9;
        const beamHeight = 35 * pt.scale;
        const beamElevation = 90 * pt.scale;

        ctx.fillStyle = obs.color;
        ctx.fillRect(pt.x - beamWidth / 2, pt.y - beamElevation, beamWidth, beamHeight);

        // Support pillars
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(pt.x - beamWidth / 2, pt.y - beamElevation, 6 * pt.scale, beamElevation);
        ctx.fillRect(pt.x + beamWidth / 2 - 6 * pt.scale, pt.y - beamElevation, 6 * pt.scale, beamElevation);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(18 * pt.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('▼ SLIDE ▼', pt.x, pt.y - beamElevation + beamHeight * 0.7);
      } else {
        // Drone hazard (requires DODGE)
        const droneSize = 55 * pt.scale;
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - 50 * pt.scale, droneSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * pt.scale;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(14 * pt.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('DODGE', pt.x, pt.y - 45 * pt.scale);
      }

      ctx.restore();
    }

    // Render Player Avatar / Mat Zone indicator
    const playerPt = project(this.playerVisualX, 0.05);
    const jumpOffset = this.playerElevation * 110;
    const slideScaleY = this.playerCrouch > 0 ? 0.45 : 1.0;

    ctx.save();
    // Flash if invulnerable
    if (this.invulnerableTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }

    // Shadow on the road
    ctx.beginPath();
    ctx.ellipse(playerPt.x, playerPt.y, 45 * playerPt.scale, 16 * playerPt.scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    // Player Glow Footprint on lane
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;
    ctx.stroke();

    // Running Runner Silhouette
    const avatarY = playerPt.y - jumpOffset;
    ctx.translate(playerPt.x, avatarY);
    ctx.scale(playerPt.scale, playerPt.scale * slideScaleY);

    // Torso / Suit
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.roundRect(-24, -90, 48, 65, 12);
    ctx.fill();

    // Helmet / Visor
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, -108, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-12, -112, 24, 8);

    // Dynamic feet / energy pads
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-20, -25, 14, 25);
    ctx.fillRect(6, -25, 14, 25);

    ctx.restore();

    // Render Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private notifyState(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ ...this.state });
    }
  }

  public getState(): SpeedGameState {
    return { ...this.state };
  }

  public restart(): void {
    this.state = {
      score: 0,
      distance: 0,
      coins: 0,
      combo: 0,
      maxCombo: 0,
      lives: 3,
      speed: 1.0,
      isGameOver: false,
      isVictory: false,
    };
    this.obstacles = [];
    this.coins = [];
    this.particles = [];
    this.nextObstacleTime = 1.5;
    this.nextCoinTime = 1.0;
    this.notifyState();
  }
}
