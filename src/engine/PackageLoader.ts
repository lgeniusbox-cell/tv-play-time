/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameCatalogItem, AnyGameConfig, TimelineGameConfig } from '../types/game';

export interface CatalogResponse {
  version: string;
  engineVersion: string;
  games: GameCatalogItem[];
}

export class PackageLoaderService {
  private cachedConfigs: Map<string, AnyGameConfig> = new Map();
  private catalogCache: GameCatalogItem[] | null = null;

  public async loadCatalog(catalogUrl = '/games/games.json'): Promise<GameCatalogItem[]> {
    try {
      const res = await fetch(catalogUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch catalog from ${catalogUrl}`);
      }
      const data: CatalogResponse = await res.json();
      if (!data || !Array.isArray(data.games)) {
        throw new Error('Invalid catalog format: expected "games" array');
      }
      this.catalogCache = data.games;
      return data.games;
    } catch (err) {
      console.error('Error loading games catalog:', err);
      throw err;
    }
  }

  public async loadGamePackage(item: GameCatalogItem): Promise<AnyGameConfig> {
    if (this.cachedConfigs.has(item.packageUrl)) {
      return this.cachedConfigs.get(item.packageUrl)!;
    }

    try {
      const res = await fetch(item.packageUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch game package from ${item.packageUrl}`);
      }

      const config: AnyGameConfig = await res.json();
      if (!config.mode) {
        throw new Error('Game package is missing required field: "mode"');
      }

      // If mode is timeline and has a timelineUrl, load timeline.json
      if (config.mode === 'timeline') {
        const timelineUrl = config.timelineUrl || item.timelineUrl;
        if (timelineUrl && !config.timelineData) {
          try {
            const timeRes = await fetch(timelineUrl);
            if (timeRes.ok) {
              const timelineData = await timeRes.json();
              (config as TimelineGameConfig).timelineData = timelineData;
            }
          } catch (tErr) {
            console.warn(`Failed to fetch timeline from ${timelineUrl}`, tErr);
          }
        }
      }

      this.cachedConfigs.set(item.packageUrl, config);
      return config;
    } catch (err) {
      console.error(`Failed to load game package for ${item.title}:`, err);
      throw err;
    }
  }

  public preloadNext(items: GameCatalogItem[], currentIndex: number): void {
    if (items.length <= 1) return;
    const nextIndex = (currentIndex + 1) % items.length;
    const nextItem = items[nextIndex];

    this.loadGamePackage(nextItem)
      .then((cfg) => {
        console.log(`Preloaded package: ${cfg.title}`);
      })
      .catch((e) => {
        console.warn('Preload failed for next game', e);
      });
  }
}

export const PACKAGE_LOADER = new PackageLoaderService();
