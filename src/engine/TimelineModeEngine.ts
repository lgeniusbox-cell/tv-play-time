/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimelineGameConfig, TimelineEvent, MatAction } from '../types/game';
import { UnifiedInputState } from './InputManager';
import { AUDIO } from './AudioManager';
import { SETTINGS } from './settings';
import { VideoManager } from './VideoManager';

export interface FloatingRating {
  id: number;
  rating: 'PERFECT' | 'GOOD' | 'MISS';
  offsetMs: number;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface TimelineGameState {
  score: number;
  combo: number;
  maxCombo: number;
  lives: number;
  maxLives: number;
  perfectCount: number;
  goodCount: number;
  missCount: number;
  accuracy: number;
  isGameOver: boolean;
  isVictory: boolean;
  currentTimeMs: number;
  totalEvents: number;
  clearedEvents: number;
}

interface EventRuntime extends TimelineEvent {
  processed: boolean;
  result?: 'PERFECT' | 'GOOD' | 'MISS';
}

export class TimelineModeEngine {
  private config: TimelineGameConfig;
  private videoMgr: VideoManager;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private events: EventRuntime[] = [];
  private ratings: FloatingRating[] = [];
  private ratingCounter = 0;

  private state: TimelineGameState = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    lives: 4,
    maxLives: 4,
    perfectCount: 0,
    goodCount: 0,
    missCount: 0,
    accuracy: 100,
    isGameOver: false,
    isVictory: false,
    currentTimeMs: 0,
    totalEvents: 0,
    clearedEvents: 0,
  };

  private startTime = 0;
  private isRunning = false;
  private leadTimeMs = 2000; // Time target is visible before hitting strike line

  private onStateChangeCallback?: (state: TimelineGameState) => void;

  constructor(config: TimelineGameConfig, videoMgr: VideoManager, canvas: HTMLCanvasElement) {
    this.config = config;
    this.videoMgr = videoMgr;
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot get 2D context');
    this.ctx = context;

    this.videoMgr.setPlaybackRate(1.0);
    this.videoMgr.loadLoop(config.videoUrl);

    this.initEvents();
  }

  public initEvents(): void {
    const rawEvents = this.config.timelineData?.events || [];
    this.events = rawEvents.map((e) => ({ ...e, processed: false }));
    this.state.totalEvents = this.events.length;
    this.state.maxLives = this.config.lives || 4;
    this.state.lives = this.state.maxLives;
  }

  public start(): void {
    this.startTime = performance.now();
    this.isRunning = true;
    AUDIO.startMusic(this.config.bpm || 130);
  }

  public onStateChange(cb: (state: TimelineGameState) => void): void {
    this.onStateChangeCallback = cb;
  }

  public update(dt: number, input: UnifiedInputState): void {
    if (!this.isRunning || this.state.isGameOver || this.state.isVictory) return;

    const now = performance.now();
    this.state.currentTimeMs = now - this.startTime;
    const currentMs = this.state.currentTimeMs;

    const appSettings = SETTINGS.get();
    const timingWindow = this.config.timingWindowMs || appSettings.timing.timingWindowMs || 250;
    const perfectWindow = this.config.perfectWindowMs || appSettings.timing.perfectWindowMs || 90;

    // Check Player Triggers on floor mat
    const actions: MatAction[] = ['LEFT', 'RIGHT', 'CENTER', 'JUMP', 'SLIDE'];
    for (const act of actions) {
      if (input.triggers[act]) {
        this.evaluatePlayerAction(act, currentMs, timingWindow, perfectWindow);
      }
    }

    // Check for Missed Events that passed the timing window
    for (const ev of this.events) {
      if (!ev.processed && currentMs > ev.timeMs + timingWindow) {
        ev.processed = true;
        ev.result = 'MISS';
        this.handleMiss(ev, timingWindow);
      }
    }

    // Update floating ratings
    for (let i = this.ratings.length - 1; i >= 0; i--) {
      const r = this.ratings[i];
      r.life -= dt;
      r.y -= dt * 45;
      if (r.life <= 0) this.ratings.splice(i, 1);
    }

    // Check victory condition: all events processed
    const unprocessed = this.events.some((e) => !e.processed);
    if (!unprocessed && this.events.length > 0) {
      // Allow last rating to display
      const lastEventTime = this.events[this.events.length - 1].timeMs;
      if (currentMs > lastEventTime + 1200) {
        this.state.isVictory = true;
        AUDIO.playWin();
        this.notifyState();
      }
    }

    this.notifyState();
  }

  private evaluatePlayerAction(act: MatAction, currentMs: number, timingWindow: number, perfectWindow: number): void {
    // Find unhit events within timing window
    let bestEvent: EventRuntime | null = null;
    let minDiff = Infinity;

    for (const ev of this.events) {
      if (ev.processed) continue;
      if (ev.action === act) {
        const diff = Math.abs(currentMs - ev.timeMs);
        if (diff <= timingWindow && diff < minDiff) {
          minDiff = diff;
          bestEvent = ev;
        }
      }
    }

    if (bestEvent) {
      bestEvent.processed = true;
      this.state.clearedEvents += 1;
      const offsetMs = Math.round(currentMs - bestEvent.timeMs);

      const targetX = this.getEventScreenX(bestEvent);
      const strikeY = this.canvas.height * 0.78;

      if (minDiff <= perfectWindow) {
        bestEvent.result = 'PERFECT';
        this.state.perfectCount += 1;
        this.state.combo += 1;
        this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
        this.state.score += 300 * Math.min(4, 1 + Math.floor(this.state.combo / 5));
        AUDIO.playPerfect();
        this.spawnRating('PERFECT', offsetMs, targetX, strikeY, '#22c55e');
      } else {
        bestEvent.result = 'GOOD';
        this.state.goodCount += 1;
        this.state.combo += 1;
        this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
        this.state.score += 150 * Math.min(4, 1 + Math.floor(this.state.combo / 5));
        AUDIO.playGood();
        this.spawnRating('GOOD', offsetMs, targetX, strikeY, '#38bdf8');
      }

      this.updateAccuracy();
    }
  }

  private handleMiss(ev: EventRuntime, timingWindow: number): void {
    this.state.clearedEvents += 1;
    this.state.missCount += 1;
    this.state.combo = 0;
    this.state.lives -= 1;
    AUDIO.playMiss();

    const targetX = this.getEventScreenX(ev);
    const strikeY = this.canvas.height * 0.78;
    this.spawnRating('MISS', timingWindow, targetX, strikeY, '#ef4444');

    this.updateAccuracy();

    if (this.state.lives <= 0) {
      this.state.isGameOver = true;
      AUDIO.playHit();
    }
  }

  private updateAccuracy(): void {
    const totalJudged = this.state.perfectCount + this.state.goodCount + this.state.missCount;
    if (totalJudged > 0) {
      const weighted = this.state.perfectCount * 1.0 + this.state.goodCount * 0.6;
      this.state.accuracy = Math.round((weighted / totalJudged) * 100);
    }
  }

  private spawnRating(rating: 'PERFECT' | 'GOOD' | 'MISS', offsetMs: number, x: number, y: number, color: string): void {
    this.ratings.push({
      id: ++this.ratingCounter,
      rating,
      offsetMs,
      x,
      y,
      life: 0.9,
      maxLife: 0.9,
      color,
    });
  }

  private getEventScreenX(ev: TimelineEvent): number {
    const w = this.canvas.width;
    const lane = ev.lane !== undefined ? ev.lane : 1;
    const laneWidth = w * 0.6 / 3;
    const startX = w * 0.2;
    return startX + lane * laneWidth + laneWidth / 2;
  }

  public render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const strikeY = h * 0.78;
    const trackStartX = w * 0.2;
    const trackWidth = w * 0.6;
    const laneWidth = trackWidth / 3;

    // Draw Track Lanes
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(trackStartX, 0, trackWidth, h);

    ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
    ctx.lineWidth = 2;
    for (let l = 0; l <= 3; l++) {
      const lx = trackStartX + l * laneWidth;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, h);
      ctx.stroke();
    }

    // Strike Zone Bar
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(trackStartX, strikeY);
    ctx.lineTo(trackStartX + trackWidth, strikeY);
    ctx.stroke();

    // Strike targets per lane
    for (let l = 0; l < 3; l++) {
      const lx = trackStartX + l * laneWidth + laneWidth / 2;
      ctx.beginPath();
      ctx.arc(lx, strikeY, 32, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Draw Incoming Timeline Events
    const currentMs = this.state.currentTimeMs;
    for (const ev of this.events) {
      if (ev.processed) continue;

      const timeUntilStrike = ev.timeMs - currentMs;
      if (timeUntilStrike > this.leadTimeMs || timeUntilStrike < -250) continue;

      // Calculate Y position (interpolated from top to strikeY)
      const progress = 1 - timeUntilStrike / this.leadTimeMs;
      const evY = progress * strikeY;
      const evX = this.getEventScreenX(ev);

      this.renderEventPill(ctx, ev, evX, evY);
    }

    // Draw Floating Ratings
    for (const r of this.ratings) {
      const alpha = Math.min(1, r.life / 0.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = r.color;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 16;

      ctx.fillText(r.rating, r.x, r.y);

      // Offset timing in ms (e.g. "+35ms")
      ctx.font = '700 14px sans-serif';
      ctx.fillStyle = '#f8fafc';
      const offsetSign = r.offsetMs > 0 ? `+${r.offsetMs}ms` : `${r.offsetMs}ms`;
      ctx.fillText(offsetSign, r.x, r.y + 18);

      ctx.restore();
    }

    ctx.restore();
  }

  private renderEventPill(ctx: CanvasRenderingContext2D, ev: TimelineEvent, x: number, y: number): void {
    ctx.save();
    let color = '#38bdf8';
    let icon = '▲';

    if (ev.action === 'JUMP') {
      color = '#38bdf8';
      icon = 'JUMP ⬆';
    } else if (ev.action === 'SLIDE') {
      color = '#f59e0b';
      icon = 'SLIDE ⬇';
    } else if (ev.action === 'LEFT') {
      color = '#a855f7';
      icon = 'LEFT ⬅';
    } else if (ev.action === 'RIGHT') {
      color = '#ec4899';
      icon = 'RIGHT ➡';
    } else if (ev.action === 'CENTER') {
      color = '#06b6d4';
      icon = 'CENTER ◆';
    }

    // Event circular target
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Icon text
    ctx.fillStyle = '#030712';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);

    ctx.restore();
  }

  private notifyState(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ ...this.state });
    }
  }

  public getState(): TimelineGameState {
    return { ...this.state };
  }

  public restart(): void {
    this.initEvents();
    this.ratings = [];
    this.state = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      lives: this.state.maxLives,
      maxLives: this.state.maxLives,
      perfectCount: 0,
      goodCount: 0,
      missCount: 0,
      accuracy: 100,
      isGameOver: false,
      isVictory: false,
      currentTimeMs: 0,
      totalEvents: this.events.length,
      clearedEvents: 0,
    };
    this.start();
    this.notifyState();
  }
}
