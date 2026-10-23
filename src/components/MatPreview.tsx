/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UnifiedInputState } from '../engine/InputManager';

interface MatPreviewProps {
  input: UnifiedInputState;
}

export const MatPreview: React.FC<MatPreviewProps> = ({ input }) => {
  const { actions, intensity, hasGamepad, gamepadId } = input;

  return (
    <div className="flex flex-col items-center bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl p-3 shadow-2xl text-xs select-none pointer-events-none transition-all">
      <div className="flex items-center justify-between w-full mb-2 px-1">
        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
          <span className={`w-2 h-2 rounded-full ${hasGamepad ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="truncate max-w-[110px]">{hasGamepad ? 'FLOOR MAT' : 'KEYBOARD'}</span>
        </div>
        <span className="text-cyan-400 font-mono font-bold">{Math.round(intensity * 100)}%</span>
      </div>

      {/* Physical 5-Zone Floor Mat Grid */}
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-32 h-32 p-1.5 bg-slate-950/90 rounded-lg border border-slate-800">
        {/* Row 1: Top Jump Zone in Center */}
        <div />
        <div
          className={`flex items-center justify-center rounded font-bold text-[10px] transition-all duration-75 ${
            actions.JUMP
              ? 'bg-cyan-500 text-white shadow-[0_0_15px_#06b6d4] scale-95'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/40'
          }`}
        >
          JUMP
        </div>
        <div />

        {/* Row 2: Left, Center, Right */}
        <div
          className={`flex items-center justify-center rounded font-bold text-[10px] transition-all duration-75 ${
            actions.LEFT
              ? 'bg-purple-500 text-white shadow-[0_0_15px_#a855f7] scale-95'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/40'
          }`}
        >
          LEFT
        </div>
        <div
          className={`flex items-center justify-center rounded font-bold text-[10px] transition-all duration-75 ${
            actions.CENTER
              ? 'bg-emerald-500 text-white shadow-[0_0_15px_#10b981] scale-95'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/40'
          }`}
        >
          MID
        </div>
        <div
          className={`flex items-center justify-center rounded font-bold text-[10px] transition-all duration-75 ${
            actions.RIGHT
              ? 'bg-pink-500 text-white shadow-[0_0_15px_#ec4899] scale-95'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/40'
          }`}
        >
          RIGHT
        </div>

        {/* Row 3: Bottom Slide Zone in Center */}
        <div />
        <div
          className={`flex items-center justify-center rounded font-bold text-[10px] transition-all duration-75 ${
            actions.SLIDE
              ? 'bg-amber-500 text-white shadow-[0_0_15px_#f59e0b] scale-95'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/40'
          }`}
        >
          SLIDE
        </div>
        <div />
      </div>

      {/* Analog Intensity Bar */}
      <div className="w-full mt-2">
        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
          <span>INTENSITY</span>
          <span>SPEED</span>
        </div>
        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-rose-500 transition-all duration-100"
            style={{ width: `${Math.round(intensity * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
