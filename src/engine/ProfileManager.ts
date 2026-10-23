/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PlayerProfile } from '../types/game';

const STORAGE_KEY = 'floormat_profiles_v1';
const ACTIVE_PROFILE_KEY = 'floormat_active_profile_id';

const DEFAULT_AVATARS = [
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
];

class ProfileManagerService {
  private profiles: PlayerProfile[] = [];
  private activeProfileId: string = '';
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  public getProfiles(): PlayerProfile[] {
    return this.profiles;
  }

  public getActiveProfile(): PlayerProfile {
    let p = this.profiles.find((x) => x.id === this.activeProfileId);
    if (!p) {
      if (this.profiles.length > 0) {
        p = this.profiles[0];
        this.activeProfileId = p.id;
      } else {
        p = this.createProfile('Player 1');
      }
    }
    return p;
  }

  public setActiveProfile(id: string): void {
    if (this.profiles.some((p) => p.id === id)) {
      this.activeProfileId = id;
      localStorage.setItem(ACTIVE_PROFILE_KEY, id);
      this.notify();
    }
  }

  public createProfile(name: string): PlayerProfile {
    const trimmed = name.trim() || `Player ${this.profiles.length + 1}`;
    const newProfile: PlayerProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      avatarColor: DEFAULT_AVATARS[this.profiles.length % DEFAULT_AVATARS.length],
      createdAt: Date.now(),
      highScores: {},
    };

    this.profiles.push(newProfile);
    this.activeProfileId = newProfile.id;
    this.save();
    this.notify();
    return newProfile;
  }

  public recordScore(gameId: string, score: number, maxCombo = 0): { isNewBest: boolean; bestScore: number } {
    const profile = this.getActiveProfile();
    const current = profile.highScores[gameId];
    const prevBest = current ? current.score : 0;
    const isNewBest = score > prevBest;

    if (isNewBest || !current) {
      profile.highScores[gameId] = {
        score,
        date: new Date().toISOString().split('T')[0],
        maxCombo: Math.max(maxCombo, current?.maxCombo || 0),
      };
      this.save();
      this.notify();
    }

    return {
      isNewBest,
      bestScore: Math.max(prevBest, score),
    };
  }

  public getBestScore(gameId: string): number {
    const profile = this.getActiveProfile();
    return profile.highScores[gameId]?.score || 0;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.profiles = JSON.parse(raw);
      }
      this.activeProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
    } catch {
      // Ignore
    }

    if (this.profiles.length === 0) {
      this.createProfile('Player 1');
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profiles));
      localStorage.setItem(ACTIVE_PROFILE_KEY, this.activeProfileId);
    } catch {
      // Ignore
    }
  }
}

export const PROFILES = new ProfileManagerService();
