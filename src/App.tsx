/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameCatalogItem, AnyGameConfig, SpeedGameConfig, TimelineGameConfig, ClipsGameConfig } from './types/game';
import { SETTINGS } from './engine/settings';
import { INPUT, UnifiedInputState, UiNavDirection } from './engine/InputManager';
import { AUDIO } from './engine/AudioManager';
import { PROFILES } from './engine/ProfileManager';
import { PACKAGE_LOADER } from './engine/PackageLoader';
import { VideoManager, VideoErrorEvent } from './engine/VideoManager';
import { SpeedModeEngine } from './engine/SpeedModeEngine';
import { TimelineModeEngine } from './engine/TimelineModeEngine';
import { ClipsModeEngine } from './engine/ClipsModeEngine';

import { GameCard } from './components/GameCard';
import { MatPreview } from './components/MatPreview';
import { HUDOverlay } from './components/HUDOverlay';
import { CalibrationModal } from './components/CalibrationModal';
import { PauseModal } from './components/PauseModal';
import { SettingsModal } from './components/SettingsModal';
import { ProfileModal } from './components/ProfileModal';
import { ErrorModal } from './components/ErrorModal';

type AppScreen = 'menu' | 'loading' | 'playing' | 'gameover' | 'victory';

export default function App() {
  const [appSettings, setAppSettings] = useState(SETTINGS.get());
  const [catalog, setCatalog] = useState<GameCatalogItem[]>([]);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('menu');

  // Modals
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ title: string; message: string; url?: string } | null>(null);

  // Live Input & Profile
  const [inputState, setInputState] = useState<UnifiedInputState>(INPUT.getState());
  const [activeProfile, setActiveProfile] = useState(PROFILES.getActiveProfile());

  // Active Game Session State
  const [activeGameItem, setActiveGameItem] = useState<GameCatalogItem | null>(null);
  const [hudData, setHudData] = useState({
    score: 0,
    lives: 3,
    maxLives: 3,
    combo: 0,
    speedOrTime: '1.0x',
    speedOrTimeLabel: 'SPEED',
  });
  const [finalGameStats, setFinalGameStats] = useState({
    score: 0,
    bestScore: 0,
    isNewRecord: false,
    maxCombo: 0,
  });

  // DOM Refs for Video & Canvas
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement>(null);

  // Engine references
  const videoManagerRef = useRef<VideoManager | null>(null);
  const speedEngineRef = useRef<SpeedModeEngine | null>(null);
  const timelineEngineRef = useRef<TimelineModeEngine | null>(null);
  const clipsEngineRef = useRef<ClipsModeEngine | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isPausedRef = useRef(false);

  // Keep isPausedRef synced
  isPausedRef.current = isPauseOpen;

  // Load Catalog on mount
  useEffect(() => {
    const unsubSettings = SETTINGS.subscribe((s) => setAppSettings(s));
    const unsubInput = INPUT.subscribe((st) => setInputState(st));
    const unsubProfiles = PROFILES.subscribe(() => setActiveProfile(PROFILES.getActiveProfile()));

    loadGamesCatalog('/games/games.json');

    return () => {
      unsubSettings();
      unsubInput();
      unsubProfiles();
      stopGameLoop();
      if (videoManagerRef.current) {
        videoManagerRef.current.destroy();
      }
    };
  }, []);

  const loadGamesCatalog = async (url: string) => {
    try {
      const items = await PACKAGE_LOADER.loadCatalog(url);
      setCatalog(items);
      if (items.length > 0) {
        PACKAGE_LOADER.preloadNext(items, 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorDetails({
        title: 'Catalog Load Failure',
        message: `Could not load games list: ${msg}`,
        url,
      });
    }
  };

  // TV D-Pad & Keyboard Navigation in Main Menu
  useEffect(() => {
    const unsubNav = INPUT.onUiNav((dir: UiNavDirection) => {
      // If a modal is open, let that modal handle navigation
      if (isCalibrationOpen || isPauseOpen || isSettingsOpen || isProfileOpen || errorDetails) {
        return;
      }

      if (currentScreen === 'menu') {
        if (dir === 'LEFT') {
          AUDIO.playUiMove();
          setSelectedGameIndex((prev) => (prev > 0 ? prev - 1 : catalog.length - 1));
        } else if (dir === 'RIGHT') {
          AUDIO.playUiMove();
          setSelectedGameIndex((prev) => (prev < catalog.length - 1 ? prev + 1 : 0));
        } else if (dir === 'SELECT') {
          if (catalog[selectedGameIndex]) {
            AUDIO.playUiSelect();
            launchGame(catalog[selectedGameIndex]);
          }
        }
      } else if (currentScreen === 'playing') {
        if (dir === 'PAUSE' || dir === 'BACK') {
          AUDIO.playUiSelect();
          setIsPauseOpen(true);
        }
      } else if (currentScreen === 'gameover' || currentScreen === 'victory') {
        if (dir === 'SELECT') {
          if (activeGameItem) {
            launchGame(activeGameItem);
          }
        } else if (dir === 'BACK') {
          returnToMenu();
        }
      }
    });

    return () => unsubNav();
  }, [currentScreen, selectedGameIndex, catalog, isCalibrationOpen, isPauseOpen, isSettingsOpen, isProfileOpen, errorDetails, activeGameItem]);

  // Launch and Initialize Game Mode
  const launchGame = async (gameItem: GameCatalogItem) => {
    stopGameLoop();
    setActiveGameItem(gameItem);
    setCurrentScreen('loading');
    setIsPauseOpen(false);

    try {
      const config = await PACKAGE_LOADER.loadGamePackage(gameItem);

      // Preload next game in background
      const currentIndex = catalog.findIndex((g) => g.id === gameItem.id);
      if (currentIndex >= 0) {
        PACKAGE_LOADER.preloadNext(catalog, currentIndex);
      }

      setCurrentScreen('playing');

      // Initialize Video Manager
      setTimeout(() => {
        initGameSession(gameItem, config);
      }, 50);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorDetails({
        title: 'Game Launch Error',
        message: `Failed to initialize package: ${msg}`,
        url: gameItem.packageUrl,
      });
      setCurrentScreen('menu');
    }
  };

  const handleVideoError = useCallback((err: VideoErrorEvent) => {
    console.warn('VideoManager error event:', err);
    if (err.isFatal) {
      setErrorDetails({
        title: 'Video Stream Error',
        message: err.message,
        url: err.sourceUrl,
      });
    }
  }, []);

  const initGameSession = (item: GameCatalogItem, config: AnyGameConfig) => {
    if (!videoContainerRef.current || !gameCanvasRef.current) return;

    // Reset video manager
    if (videoManagerRef.current) {
      videoManagerRef.current.destroy();
    }
    const videoMgr = new VideoManager();
    videoMgr.attach(videoContainerRef.current, handleVideoError);
    videoManagerRef.current = videoMgr;

    // Canvas resolution setup (1280x720 internal rendering)
    const canvas = gameCanvasRef.current;
    canvas.width = 1280;
    canvas.height = 720;

    // Unmute video on first interaction
    INPUT.onFirstInteraction(() => {
      videoMgr.unmute();
    });

    // Reset Engine refs
    speedEngineRef.current = null;
    timelineEngineRef.current = null;
    clipsEngineRef.current = null;

    if (config.mode === 'speed') {
      const speedEngine = new SpeedModeEngine(config as SpeedGameConfig, videoMgr, canvas);
      speedEngine.onStateChange((st) => {
        setHudData({
          score: st.score,
          lives: st.lives,
          maxLives: 3,
          combo: st.combo,
          speedOrTime: `${st.speed.toFixed(1)}x`,
          speedOrTimeLabel: 'INTENSITY SPEED',
        });

        if (st.isGameOver) {
          endGameSession(item.id, st.score, st.maxCombo, false);
        } else if (st.isVictory) {
          endGameSession(item.id, st.score, st.maxCombo, true);
        }
      });
      speedEngineRef.current = speedEngine;
      AUDIO.startMusic(config.audio?.bpm || 128);
    } else if (config.mode === 'timeline') {
      const timelineEngine = new TimelineModeEngine(config as TimelineGameConfig, videoMgr, canvas);
      timelineEngine.onStateChange((st) => {
        setHudData({
          score: st.score,
          lives: st.lives,
          maxLives: st.maxLives,
          combo: st.combo,
          speedOrTime: `${st.accuracy}%`,
          speedOrTimeLabel: 'ACCURACY',
        });

        if (st.isGameOver) {
          endGameSession(item.id, st.score, st.maxCombo, false);
        } else if (st.isVictory) {
          endGameSession(item.id, st.score, st.maxCombo, true);
        }
      });
      timelineEngineRef.current = timelineEngine;
      timelineEngine.start();
    } else if (config.mode === 'clips') {
      const clipsEngine = new ClipsModeEngine(config as ClipsGameConfig, videoMgr, canvas);
      clipsEngine.onStateChange((st) => {
        setHudData({
          score: st.score,
          lives: st.lives,
          maxLives: st.maxLives,
          combo: st.combo,
          speedOrTime: `${Math.ceil(st.remainingTimeSec)}s`,
          speedOrTimeLabel: 'TIME LEFT',
        });

        if (st.isGameOver) {
          endGameSession(item.id, st.score, st.maxCombo, false);
        } else if (st.isVictory) {
          endGameSession(item.id, st.score, st.maxCombo, true);
        }
      });
      clipsEngineRef.current = clipsEngine;
      clipsEngine.start();
    }

    startGameLoop();
  };

  const startGameLoop = () => {
    stopGameLoop();
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      if (!isPausedRef.current) {
        const input = INPUT.getState();

        if (speedEngineRef.current) {
          speedEngineRef.current.update(dt, input);
          speedEngineRef.current.render();
        } else if (timelineEngineRef.current) {
          timelineEngineRef.current.update(dt, input);
          timelineEngineRef.current.render();
        } else if (clipsEngineRef.current) {
          clipsEngineRef.current.update(dt, input);
          clipsEngineRef.current.render();
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const stopGameLoop = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    AUDIO.stopMusic();
  };

  const endGameSession = (gameId: string, score: number, maxCombo: number, isVictory: boolean) => {
    stopGameLoop();
    const result = PROFILES.recordScore(gameId, score, maxCombo);

    setFinalGameStats({
      score,
      bestScore: result.bestScore,
      isNewRecord: result.isNewBest,
      maxCombo,
    });

    setCurrentScreen(isVictory ? 'victory' : 'gameover');
  };

  const restartCurrentGame = () => {
    setIsPauseOpen(false);
    if (activeGameItem) {
      launchGame(activeGameItem);
    }
  };

  const returnToMenu = () => {
    stopGameLoop();
    setIsPauseOpen(false);
    if (videoManagerRef.current) {
      videoManagerRef.current.destroy();
    }
    setCurrentScreen('menu');
  };

  // Safe area overscan styling
  const overscanMargin = `${appSettings.tv.overscanPercent}%`;

  return (
    <div
      className="relative w-full h-full bg-slate-950 text-white overflow-hidden select-none"
      style={{ padding: overscanMargin }}
    >
      {/* 1. MAIN MENU SCREEN */}
      {currentScreen === 'menu' && (
        <div className="relative w-full h-full flex flex-col justify-between p-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-black text-xl shadow-[0_0_15px_#06b6d4]">
                ▶
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-widest text-white">FLOORMAT STUDIO TV</h1>
                <p className="text-xs text-slate-400">Video-Reactive Body-Controlled Game Engine</p>
              </div>
            </div>

            {/* TV Menu Actions: Profile, Calibration, Settings */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  AUDIO.playUiSelect();
                  setIsProfileOpen(true);
                }}
                className="flex items-center gap-2.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: activeProfile.avatarColor }}
                >
                  {activeProfile.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-200">{activeProfile.name}</span>
              </button>

              <button
                onClick={() => {
                  AUDIO.playUiSelect();
                  setIsCalibrationOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-cyan-400 transition-all flex items-center gap-1.5"
              >
                <span>CALIBRATE MAT</span>
              </button>

              <button
                onClick={() => {
                  AUDIO.playUiSelect();
                  setIsSettingsOpen(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all"
              >
                SETTINGS
              </button>
            </div>
          </div>

          {/* Game Catalog Cards Carousel */}
          <div className="my-auto">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
              Select Game Package ({catalog.length} Available)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {catalog.map((game, idx) => (
                <GameCard
                  key={game.id}
                  game={game}
                  isSelected={selectedGameIndex === idx}
                  onSelect={() => {
                    AUDIO.playUiSelect();
                    launchGame(game);
                  }}
                  onHover={() => setSelectedGameIndex(idx)}
                />
              ))}
            </div>
          </div>

          {/* Bottom TV Controller Guide */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono py-2 border-t border-slate-800">
            <div className="flex items-center gap-4">
              <span>🎮 D-PAD / ARROWS: Navigate</span>
              <span>•</span>
              <span>A / ENTER: Select</span>
              <span>•</span>
              <span>MAT: Left / Mid / Right / Jump / Slide</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${inputState.hasGamepad ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{inputState.hasGamepad ? 'Floor Mat Active' : 'Keyboard Active'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. LOADING SCREEN */}
      {currentScreen === 'loading' && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-black tracking-widest text-white mb-2">LOADING GAME PACKAGE</h2>
          <p className="text-sm text-slate-400">Buffering video stream and initializing mat tracking...</p>
        </div>
      )}

      {/* 3. ACTIVE GAMEPLAY SCREEN */}
      {currentScreen === 'playing' && (
        <div className="relative w-full h-full overflow-hidden bg-black rounded-xl">
          {/* Background Video Layer */}
          <div ref={videoContainerRef} className="absolute inset-0 w-full h-full overflow-hidden" />

          {/* Overlay Canvas (Perspective Lanes / Timeline Track / Action Indicators) */}
          <canvas
            ref={gameCanvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />

          {/* Top HUD */}
          {activeGameItem && (
            <HUDOverlay
              title={activeGameItem.title}
              mode={activeGameItem.mode}
              score={hudData.score}
              lives={hudData.lives}
              maxLives={hudData.maxLives}
              combo={hudData.combo}
              speedOrTime={hudData.speedOrTime}
              speedOrTimeLabel={hudData.speedOrTimeLabel}
              isMuted={appSettings.audio.muted}
              onToggleMute={() => {
                const next = !appSettings.audio.muted;
                SETTINGS.update({ audio: { ...appSettings.audio, muted: next } });
                AUDIO.playUiSelect();
              }}
              onPause={() => {
                AUDIO.playUiSelect();
                setIsPauseOpen(true);
              }}
            />
          )}
        </div>
      )}

      {/* 4. GAME OVER & VICTORY SCREENS */}
      {(currentScreen === 'gameover' || currentScreen === 'victory') && (
        <div className="w-full h-full flex items-center justify-center p-8 bg-slate-950/90 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-8 text-center shadow-2xl">
            <div
              className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl mb-4 font-black ${
                currentScreen === 'victory'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500 shadow-[0_0_20px_#f59e0b]'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500 shadow-[0_0_20px_#f43f5e]'
              }`}
            >
              {currentScreen === 'victory' ? '🏆' : '💀'}
            </div>

            <h2 className="text-3xl font-black tracking-widest text-white mb-1">
              {currentScreen === 'victory' ? 'STAGE CLEARED!' : 'GAME OVER'}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {currentScreen === 'victory' ? 'Fantastic physical performance!' : 'Ran out of lives. Step back up!'}
            </p>

            {/* Score Stats */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-bold">FINAL SCORE</span>
                <span className="text-2xl font-mono font-black text-cyan-400">
                  {finalGameStats.score.toLocaleString()} PTS
                </span>
              </div>

              {finalGameStats.isNewRecord && (
                <div className="py-1 px-3 bg-amber-950/60 border border-amber-600 rounded-lg text-amber-300 text-xs font-bold">
                  ★ NEW PERSONAL BEST RECORD! ★
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>MAX COMBO</span>
                <span className="font-mono font-bold text-slate-200">{finalGameStats.maxCombo}x</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>PLAYER PROFILE</span>
                <span className="font-bold text-slate-200">{activeProfile.name}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  AUDIO.playUiSelect();
                  if (activeGameItem) launchGame(activeGameItem);
                }}
                className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-2 ring-cyan-400"
              >
                PLAY AGAIN (A / ENTER)
              </button>
              <button
                onClick={() => {
                  AUDIO.playUiSelect();
                  returnToMenu();
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs tracking-wider rounded-xl border border-slate-700 transition-colors"
              >
                RETURN TO MENU (B / ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Glowing Mat Preview in Bottom-Right Corner */}
      {appSettings.tv.showMatPreview && (
        <div className="fixed bottom-6 right-6 z-30 pointer-events-none">
          <MatPreview input={inputState} />
        </div>
      )}

      {/* Calibration Modal */}
      {isCalibrationOpen && <CalibrationModal onClose={() => setIsCalibrationOpen(false)} />}

      {/* TV Pause Menu Modal */}
      {isPauseOpen && (
        <PauseModal
          onResume={() => setIsPauseOpen(false)}
          onRestart={restartCurrentGame}
          onOpenCalibration={() => setIsCalibrationOpen(true)}
          onQuitToMenu={returnToMenu}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onLoadCustomPackage={(url) => {
            // Load custom game package directly
            const customItem: GameCatalogItem = {
              id: `custom_${Date.now()}`,
              title: 'Custom External Game',
              mode: 'speed',
              description: url,
              packageUrl: url,
              cover: '',
            };
            launchGame(customItem);
          }}
        />
      )}

      {/* Profile Modal */}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}

      {/* Error Modal */}
      {errorDetails && (
        <ErrorModal
          title={errorDetails.title}
          message={errorDetails.message}
          sourceUrl={errorDetails.url}
          onRetry={() => {
            setErrorDetails(null);
            if (activeGameItem) launchGame(activeGameItem);
            else loadGamesCatalog('/games/games.json');
          }}
          onFallbackToProcedural={() => {
            setErrorDetails(null);
            if (activeGameItem) {
              launchGame({
                ...activeGameItem,
                packageUrl: '/games/neon-velocity/config.json',
              });
            }
          }}
          onExitToMenu={() => {
            setErrorDetails(null);
            returnToMenu();
          }}
        />
      )}
    </div>
  );
}
