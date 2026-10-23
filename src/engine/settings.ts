/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputMappingConfig } from '../types/game';

/**
 * Top-level application settings with customizable floor mat mappings,
 * TV safe margins, audio volume, and timing thresholds.
 */
export interface AppSettings {
  tv: {
    overscanPercent: number; // 0 to 8% safe area margin for TV screens
    showFps: boolean;
    showMatPreview: boolean;
  };
  input: InputMappingConfig;
  timing: {
    timingWindowMs: number; // Default +/- 250ms
    perfectWindowMs: number; // Default +/- 90ms
  };
  audio: {
    masterVolume: number; // 0 to 1
    sfxVolume: number;
    musicVolume: number;
    muted: boolean;
  };
  engine: {
    fallbackToProceduralOnVideoError: boolean;
    preloadNextGame: boolean;
  };
}

const STORAGE_KEY = 'floormat_studio_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  tv: {
    overscanPercent: 3,
    showFps: false,
    showMatPreview: true,
  },
  input: {
    gamepadIndex: 0,
    // Typical floor mat button assignments:
    // Left: Dpad-Left (btn 14) or btn 2 (X)
    // Right: Dpad-Right (btn 15) or btn 1 (B)
    // Center: btn 0 (A) or btn 3 (Y)
    // Jump: Dpad-Up (btn 12) or btn 4 (LB)
    // Slide: Dpad-Down (btn 13) or btn 5 (RB)
    leftButton: 14,
    rightButton: 15,
    centerButton: 0,
    jumpButton: 12,
    slideButton: 13,
    // Standard left analog stick
    axisX: 0,
    axisY: 1,
    axisIntensity: 5, // Right trigger or simulated cadence
    axisDeadzone: 0.35,
    cadenceSensitivity: 3.5, // Steps per second for max intensity
    invertAxisY: false,
    intensityMode: 'cadence', // 'cadence' (rapid stepping), 'axis', or 'trigger'
  },
  timing: {
    timingWindowMs: 250,
    perfectWindowMs: 90,
  },
  audio: {
    masterVolume: 0.85,
    sfxVolume: 0.9,
    musicVolume: 0.65,
    muted: false,
  },
  engine: {
    fallbackToProceduralOnVideoError: true,
    preloadNextGame: true,
  },
};

class SettingsManager {
  private currentSettings: AppSettings;
  private listeners: Set<(settings: AppSettings) => void> = new Set();

  constructor() {
    this.currentSettings = this.load();
  }

  public get(): AppSettings {
    return this.currentSettings;
  }

  public update(partial: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)): void {
    if (typeof partial === 'function') {
      this.currentSettings = partial(this.currentSettings);
    } else {
      this.currentSettings = {
        ...this.currentSettings,
        ...partial,
        tv: { ...this.currentSettings.tv, ...(partial.tv || {}) },
        input: { ...this.currentSettings.input, ...(partial.input || {}) },
        timing: { ...this.currentSettings.timing, ...(partial.timing || {}) },
        audio: { ...this.currentSettings.audio, ...(partial.audio || {}) },
        engine: { ...this.currentSettings.engine, ...(partial.engine || {}) },
      };
    }
    this.save();
    this.notify();
  }

  public resetToDefaults(): void {
    this.currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.save();
    this.notify();
  }

  public subscribe(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.currentSettings));
  }

  private load(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          tv: { ...DEFAULT_SETTINGS.tv, ...(parsed.tv || {}) },
          input: { ...DEFAULT_SETTINGS.input, ...(parsed.input || {}) },
          timing: { ...DEFAULT_SETTINGS.timing, ...(parsed.timing || {}) },
          audio: { ...DEFAULT_SETTINGS.audio, ...(parsed.audio || {}) },
          engine: { ...DEFAULT_SETTINGS.engine, ...(parsed.engine || {}) },
        };
      }
    } catch {
      // Ignore storage errors in restrictive environments
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSettings));
    } catch {
      // Ignore storage quota errors
    }
  }
}

export const SETTINGS = new SettingsManager();
