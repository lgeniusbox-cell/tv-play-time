/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MatAction = 'LEFT' | 'RIGHT' | 'CENTER' | 'JUMP' | 'SLIDE';

export type GameMode = 'speed' | 'timeline' | 'clips';

export interface GameCatalogItem {
  id: string;
  title: string;
  mode: GameMode;
  description: string;
  packageUrl: string;
  timelineUrl?: string;
  cover: string;
  difficulty?: string;
  themeColor?: string;
}

export interface SpeedGameConfig {
  id: string;
  title: string;
  mode: 'speed';
  version?: string;
  videoUrl: string;
  speedRange: [number, number];
  baseSpeed?: number;
  difficulty?: number;
  spawnRate?: number;
  laneCount?: number;
  targetDistance?: number;
  obstacles?: Array<{
    type: 'hurdle' | 'beam' | 'drone' | 'pylon';
    action: 'jump' | 'slide' | 'dodge';
    width?: number;
    color?: string;
  }>;
  coins?: {
    enabled: boolean;
    spawnRate: number;
    points: number;
  };
  audio?: {
    theme?: string;
    bpm?: number;
  };
}

export interface TimelineEvent {
  id: number;
  timeMs: number;
  action: MatAction;
  lane?: number; // 0: Left, 1: Center, 2: Right
  prompt?: string;
}

export interface TimelineGameConfig {
  id: string;
  title: string;
  mode: 'timeline';
  version?: string;
  videoUrl: string;
  timelineUrl?: string;
  timingWindowMs?: number; // Default 250ms (+/- 250ms)
  perfectWindowMs?: number; // Default 90ms (+/- 90ms)
  lives?: number;
  bpm?: number;
  laneCount?: number;
  leadTimeMs?: number;
  audio?: {
    theme?: string;
    bpm?: number;
  };
  timelineData?: {
    songTitle?: string;
    bpm?: number;
    events: TimelineEvent[];
  };
}

export type ClipState = 'run' | 'jump' | 'slide' | 'hit' | 'win';

export interface ClipsGameConfig {
  id: string;
  title: string;
  mode: 'clips';
  version?: string;
  clips: Record<ClipState, string>;
  defaultState?: ClipState;
  actionDurationMs?: Partial<Record<ClipState, number>>;
  totalTrialTimeSec?: number;
  hazardIntervalSec?: number;
  audio?: {
    theme?: string;
    bpm?: number;
  };
}

export type AnyGameConfig = SpeedGameConfig | TimelineGameConfig | ClipsGameConfig;

export interface InputMappingConfig {
  gamepadIndex: number;
  leftButton: number;
  rightButton: number;
  centerButton: number;
  jumpButton: number;
  slideButton: number;
  // Axes mapping
  axisX: number;
  axisY: number;
  axisIntensity: number; // -1 if not mapped to axis
  axisDeadzone: number;
  cadenceSensitivity: number; // steps per second to reach intensity 1.0
  invertAxisY: boolean;
  intensityMode: 'axis' | 'cadence' | 'trigger';
}

export interface PlayerProfile {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: number;
  highScores: Record<string, { score: number; date: string; maxCombo?: number }>;
}

export interface HitRating {
  rating: 'PERFECT' | 'GOOD' | 'MISS';
  offsetMs: number;
  timestamp: number;
}
