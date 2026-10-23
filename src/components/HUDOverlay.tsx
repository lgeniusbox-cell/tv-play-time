/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameMode } from '../types/game';

interface HUDOverlayProps {
  title: string;
  mode: GameMode;
  score: number;
  lives: number;
  maxLives: number;
  combo: number;
  speedOrTime: string;
  speedOrTimeLabel: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
  title,
  mode,
  score,
  lives,
  maxLives,
  combo,
  speedOrTime,
  speedOrTimeLabel,
  isMuted,
  onToggleMute,
  onPause,
}) => {
  return (
    <div className="absolute inset-x-0 top-0 p-4 pointer-events-none select-none flex items-start justify-between z-20">
      {/* Left: Game Title, Mode, and Lives */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black tracking-wider text-white drop-shadow-md">
            {title}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-slate-900/80 text-cyan-400 border border-cyan-800 backdrop-blur-md">
            {mode}
          </span>
        </div>

        {/* Lives Hearts */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: maxLives }).map((_, i) => (
            <span
              key={i}
              className={`text-lg transition-transform duration-150 ${
                i < lives ? 'text-rose-500 scale-100 drop-shadow-[0_0_8px_#f43f5e]' : 'text-slate-700 scale-90'
              }`}
            >
              ♥
            </span>
          ))}
        </div>
      </div>

      {/* Center: Score & Combo Multiplier */}
      <div className="text-center">
        <div className="text-3xl font-mono font-black text-white tracking-widest drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
          {score.toLocaleString()}
        </div>
        {combo > 1 && (
          <div className="text-xs font-black tracking-wider text-amber-400 animate-bounce drop-shadow-[0_0_8px_#f59e0b]">
            {combo}x COMBO
          </div>
        )}
      </div>

      {/* Right: Mode Dynamic Metric (Speed / Time / BPM) & TV Pause prompt */}
      <div className="flex items-center gap-3">
        <div className="text-right bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {speedOrTimeLabel}
          </div>
          <div className="text-sm font-mono font-bold text-cyan-400">{speedOrTime}</div>
        </div>

        {/* Controls: Mute & Pause */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onToggleMute}
            title="Toggle Mute"
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 backdrop-blur-md text-xs font-bold transition-colors"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={onPause}
            className="px-3 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 backdrop-blur-md text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span>PAUSE</span>
            <span className="text-[10px] text-slate-400 font-mono">(P / START)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
