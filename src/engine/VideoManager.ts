/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClipState } from '../types/game';
import { SETTINGS } from './settings';
import { ProceduralVideoGenerator } from './ProceduralVideoGenerator';

export interface VideoErrorEvent {
  message: string;
  sourceUrl: string;
  isFatal: boolean;
}

export class VideoManager {
  private container: HTMLElement | null = null;
  private videoA: HTMLVideoElement | null = null;
  private videoB: HTMLVideoElement | null = null;
  private activeVideoIndex: 'A' | 'B' = 'A';

  private proceduralGen: ProceduralVideoGenerator;
  private proceduralCanvas: HTMLCanvasElement;
  private isProceduralMode = false;
  private proceduralType = 'highway';
  private proceduralAnimId: number | null = null;

  private currentPlaybackRate = 1.0;
  private minRate = 0.5;
  private maxRate = 2.5;

  private currentClipState: ClipState = 'run';
  private clipsMap: Partial<Record<ClipState, string>> = {};

  private preloadedUrls: Set<string> = new Set();
  private onErrorCallback?: (err: VideoErrorEvent) => void;

  constructor() {
    this.proceduralGen = new ProceduralVideoGenerator(1280, 720);
    this.proceduralCanvas = this.proceduralGen.getCanvas();
    this.proceduralCanvas.style.width = '100%';
    this.proceduralCanvas.style.height = '100%';
    this.proceduralCanvas.style.objectFit = 'cover';
  }

  public attach(container: HTMLElement, onError?: (err: VideoErrorEvent) => void): void {
    this.container = container;
    this.onErrorCallback = onError;
    this.container.innerHTML = '';

    // Create dual video elements for smooth crossfades
    this.videoA = this.createVideoElement('video-layer-a');
    this.videoB = this.createVideoElement('video-layer-b');
    this.videoB.style.opacity = '0';

    this.container.appendChild(this.videoA);
    this.container.appendChild(this.videoB);
    this.container.appendChild(this.proceduralCanvas);

    // Initial state
    this.proceduralCanvas.style.display = 'none';
  }

  private createVideoElement(id: string): HTMLVideoElement {
    const v = document.createElement('video');
    v.id = id;
    v.style.position = 'absolute';
    v.style.top = '0';
    v.style.left = '0';
    v.style.width = '100%';
    v.style.height = '100%';
    v.style.objectFit = 'cover';
    v.style.transition = 'opacity 0.25s ease-in-out';
    v.autoplay = true;
    v.muted = true; // Required for WebView autoplay!
    v.playsInline = true;
    v.loop = true;

    v.addEventListener('error', () => {
      this.handleVideoError(v.src);
    });

    return v;
  }

  public unmute(): void {
    if (this.videoA) this.videoA.muted = false;
    if (this.videoB) this.videoB.muted = false;
  }

  public setMute(muted: boolean): void {
    if (this.videoA) this.videoA.muted = muted;
    if (this.videoB) this.videoB.muted = muted;
  }

  public setSpeedRange(range: [number, number]): void {
    this.minRate = range[0];
    this.maxRate = range[1];
  }

  public setIntensity(intensity: number): void {
    const rate = this.minRate + intensity * (this.maxRate - this.minRate);
    this.setPlaybackRate(rate);
  }

  public setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.2, Math.min(4.0, rate));
    this.currentPlaybackRate = clamped;

    if (this.isProceduralMode) {
      this.proceduralGen.setPlaybackRate(clamped);
    } else {
      const active = this.getActiveVideo();
      if (active) {
        active.playbackRate = clamped;
      }
    }
  }

  public getPlaybackRate(): number {
    return this.currentPlaybackRate;
  }

  public loadLoop(url: string): void {
    this.stopProcedural();

    if (url.startsWith('procedural://')) {
      this.startProcedural(url.replace('procedural://', ''));
      return;
    }

    const active = this.getActiveVideo();
    if (!active) return;

    this.isProceduralMode = false;
    this.proceduralCanvas.style.display = 'none';

    active.src = url;
    active.loop = true;
    active.playbackRate = this.currentPlaybackRate;
    active.play().catch(() => {
      this.handleVideoError(url);
    });
  }

  public setClips(clips: Record<ClipState, string>, defaultState: ClipState = 'run'): void {
    this.clipsMap = { ...clips };
    this.currentClipState = defaultState;
    this.playClip(defaultState, true);
  }

  public playClip(state: ClipState, isLoop = false): void {
    this.currentClipState = state;
    const url = this.clipsMap[state];

    if (!url || url.startsWith('procedural://')) {
      this.startProcedural(url ? url.replace('procedural://', '') : state);
      return;
    }

    this.stopProcedural();
    this.isProceduralMode = false;
    this.proceduralCanvas.style.display = 'none';

    // Cross-fade to next video element
    const nextIndex = this.activeVideoIndex === 'A' ? 'B' : 'A';
    const currentVideo = this.getActiveVideo();
    const nextVideo = nextIndex === 'A' ? this.videoA : this.videoB;

    if (!nextVideo) return;

    nextVideo.src = url;
    nextVideo.loop = isLoop;
    nextVideo.playbackRate = this.currentPlaybackRate;

    nextVideo.play().then(() => {
      nextVideo.style.opacity = '1';
      if (currentVideo) {
        currentVideo.style.opacity = '0';
        setTimeout(() => {
          currentVideo.pause();
        }, 300);
      }
      this.activeVideoIndex = nextIndex;
    }).catch(() => {
      this.handleVideoError(url);
    });
  }

  public getCurrentClipState(): ClipState {
    return this.currentClipState;
  }

  private startProcedural(type: string): void {
    this.isProceduralMode = true;
    this.proceduralType = type;
    this.proceduralCanvas.style.display = 'block';

    if (this.videoA) {
      this.videoA.style.opacity = '0';
      this.videoA.pause();
    }
    if (this.videoB) {
      this.videoB.style.opacity = '0';
      this.videoB.pause();
    }

    if (this.proceduralAnimId) {
      cancelAnimationFrame(this.proceduralAnimId);
    }

    let lastTime = performance.now();
    const renderLoop = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;
      this.proceduralGen.render(this.proceduralType, dt);
      this.proceduralAnimId = requestAnimationFrame(renderLoop);
    };
    this.proceduralAnimId = requestAnimationFrame(renderLoop);
  }

  public stopProcedural(): void {
    if (this.proceduralAnimId) {
      cancelAnimationFrame(this.proceduralAnimId);
      this.proceduralAnimId = null;
    }
  }

  public preload(url: string): void {
    if (!url || url.startsWith('procedural://') || this.preloadedUrls.has(url)) return;
    this.preloadedUrls.add(url);

    // Warm cache with hidden video or link preload
    const preloader = document.createElement('video');
    preloader.preload = 'auto';
    preloader.src = url;
    preloader.load();
  }

  private handleVideoError(sourceUrl: string): void {
    const settings = SETTINGS.get();
    if (settings.engine.fallbackToProceduralOnVideoError) {
      console.warn(`Video load failed for ${sourceUrl}. Falling back to procedural engine.`);
      this.startProcedural('highway');
    }

    if (this.onErrorCallback) {
      this.onErrorCallback({
        message: `Failed to load video stream: ${sourceUrl}`,
        sourceUrl,
        isFatal: !settings.engine.fallbackToProceduralOnVideoError,
      });
    }
  }

  private getActiveVideo(): HTMLVideoElement | null {
    return this.activeVideoIndex === 'A' ? this.videoA : this.videoB;
  }

  public pause(): void {
    if (this.videoA) this.videoA.pause();
    if (this.videoB) this.videoB.pause();
  }

  public resume(): void {
    const active = this.getActiveVideo();
    if (active && !this.isProceduralMode) {
      active.play().catch(() => {});
    }
  }

  public destroy(): void {
    this.stopProcedural();
    if (this.videoA) {
      this.videoA.pause();
      this.videoA.src = '';
    }
    if (this.videoB) {
      this.videoB.pause();
      this.videoB.src = '';
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
