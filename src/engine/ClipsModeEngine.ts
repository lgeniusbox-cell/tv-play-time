/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClipsGameConfig, ClipState, MatAction } from '../types/game';
import { UnifiedInputState } from './InputManager';
import { AUDIO } from './AudioManager';
import { VideoManager } from './VideoManager';

export interface ClipsGameState {
  currentState: ClipState;
  score: number;
  lives: number;
  maxLives: number;
  combo: number;
  maxCombo: number;
  remainingTimeSec: number;
  totalTimeSec: number;
  activePrompt: string | null;
  activeHazardType: 'jump' | 'slide' | null;
  hazardTimeRemaining: number;
  isGameOver: boolean;
  isVictory: boolean;
}

export class ClipsModeEngine {
  private config: ClipsGameConfig;
  private videoMgr: VideoManager;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: ClipsGameState;
  private stateTimer = 0; // Return to run timer
  private nextHazardCountdown = 3.5;

  private onStateChangeCallback?: (state: ClipsGameState) => void;

  constructor(config: ClipsGameConfig, videoMgr: VideoManager, canvas: HTMLCanvasElement) {
    this.config = config;
    this.videoMgr = videoMgr;
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot get 2D context');
    this.ctx = context;

    const totalTime = config.totalTrialTimeSec || 60;
    this.state = {
      currentState: config.defaultState || 'run',
      score: 0,
      lives: 3,
      maxLives: 3,
      combo: 0,
      maxCombo: 0,
      remainingTimeSec: totalTime,
      totalTimeSec: totalTime,
      activePrompt: null,
      activeHazardType: null,
      hazardTimeRemaining: 0,
      isGameOver: false,
      isVictory: false,
    };

    this.videoMgr.setClips(config.clips, config.defaultState || 'run');
  }

  public onStateChange(cb: (state: ClipsGameState) => void): void {
    this.onStateChangeCallback = cb;
  }

  public start(): void {
    AUDIO.startMusic(this.config.audio?.bpm || 110);
    this.switchState('run', true);
  }

  public update(dt: number, input: UnifiedInputState): void {
    if (this.state.isGameOver || this.state.isVictory) return;

    // Advance trial countdown
    this.state.remainingTimeSec = Math.max(0, this.state.remainingTimeSec - dt);
    this.state.score += Math.round(dt * 20 * (1 + this.state.combo * 0.1));

    if (this.state.remainingTimeSec <= 0) {
      this.triggerVictory();
      return;
    }

    // Handle return-to-run state timer
    if (this.stateTimer > 0) {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        if (this.state.currentState !== 'run') {
          this.switchState('run', true);
        }
      }
    }

    // Handle active hazard countdown
    if (this.state.activeHazardType) {
      this.state.hazardTimeRemaining -= dt;

      // Check player response
      if (this.state.activeHazardType === 'jump' && input.triggers.JUMP) {
        this.resolveHazardSuccess('jump');
      } else if (this.state.activeHazardType === 'slide' && input.triggers.SLIDE) {
        this.resolveHazardSuccess('slide');
      } else if (this.state.hazardTimeRemaining <= 0) {
        // Player missed the hazard!
        this.resolveHazardFailure();
      }
    } else {
      // Countdown to next hazard
      this.nextHazardCountdown -= dt;
      if (this.nextHazardCountdown <= 0) {
        this.spawnHazard();
      }

      // Free jump or slide outside of hazard
      if (input.triggers.JUMP && this.state.currentState === 'run') {
        AUDIO.playJump();
        this.switchState('jump', false, 850);
      } else if (input.triggers.SLIDE && this.state.currentState === 'run') {
        AUDIO.playSlide();
        this.switchState('slide', false, 800);
      }
    }

    this.notifyState();
  }

  private spawnHazard(): void {
    const isJump = Math.random() > 0.5;
    this.state.activeHazardType = isJump ? 'jump' : 'slide';
    this.state.hazardTimeRemaining = 2.0; // 2 seconds to react on floor mat
    this.state.activePrompt = isJump ? 'TREE ROOT AHEAD! JUMP NOW!' : 'LOW BRANCH! SLIDE NOW!';
    AUDIO.playUiMove();
  }

  private resolveHazardSuccess(action: 'jump' | 'slide'): void {
    AUDIO.playPerfect();
    this.state.combo += 1;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.state.score += 250 * this.state.combo;
    this.state.activePrompt = 'CLEARED!';
    this.state.activeHazardType = null;
    this.nextHazardCountdown = 3.2 + Math.random() * 2.0;

    const duration = action === 'jump' ? 850 : 800;
    this.switchState(action, false, duration);
  }

  private resolveHazardFailure(): void {
    AUDIO.playHit();
    this.state.lives -= 1;
    this.state.combo = 0;
    this.state.activePrompt = 'STUMBLE!';
    this.state.activeHazardType = null;
    this.nextHazardCountdown = 3.5;

    this.switchState('hit', false, 1100);

    if (this.state.lives <= 0) {
      this.state.isGameOver = true;
    }
  }

  private triggerVictory(): void {
    this.state.isVictory = true;
    AUDIO.playWin();
    this.switchState('win', false, 5000);
    this.notifyState();
  }

  private switchState(state: ClipState, isLoop: boolean, durationMs?: number): void {
    this.state.currentState = state;
    this.videoMgr.playClip(state, isLoop);

    if (durationMs) {
      this.stateTimer = durationMs / 1000;
    } else {
      this.stateTimer = 0;
    }
  }

  public render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Render Hazard Prompt Alert in Center
    if (this.state.activeHazardType && this.state.hazardTimeRemaining > 0) {
      const isJump = this.state.activeHazardType === 'jump';
      const promptColor = isJump ? '#38bdf8' : '#eab308';
      const actionText = isJump ? 'JUMP!' : 'SLIDE!';

      ctx.save();
      ctx.textAlign = 'center';

      // Alert Banner
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(w * 0.2, h * 0.28, w * 0.6, 90);
      ctx.strokeStyle = promptColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(w * 0.2, h * 0.28, w * 0.6, 90);

      // Warning text
      ctx.fillStyle = promptColor;
      ctx.font = '900 36px sans-serif';
      ctx.shadowColor = promptColor;
      ctx.shadowBlur = 16;
      ctx.fillText(`▲ HAZARD INCOMING: ${actionText} ▲`, w * 0.5, h * 0.34);

      // Countdown gauge
      const barWidth = (this.state.hazardTimeRemaining / 2.0) * (w * 0.56);
      ctx.fillStyle = promptColor;
      ctx.fillRect(w * 0.22, h * 0.38, barWidth, 10);

      ctx.restore();
    }
  }

  private notifyState(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ ...this.state });
    }
  }

  public getState(): ClipsGameState {
    return { ...this.state };
  }

  public restart(): void {
    const totalTime = this.config.totalTrialTimeSec || 60;
    this.state = {
      currentState: this.config.defaultState || 'run',
      score: 0,
      lives: 3,
      maxLives: 3,
      combo: 0,
      maxCombo: 0,
      remainingTimeSec: totalTime,
      totalTimeSec: totalTime,
      activePrompt: null,
      activeHazardType: null,
      hazardTimeRemaining: 0,
      isGameOver: false,
      isVictory: false,
    };
    this.nextHazardCountdown = 3.0;
    this.start();
    this.notifyState();
  }
}
