/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AUDIO } from '../engine/AudioManager';

interface ErrorModalProps {
  title: string;
  message: string;
  sourceUrl?: string;
  onRetry: () => void;
  onFallbackToProcedural?: () => void;
  onExitToMenu: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  title,
  message,
  sourceUrl,
  onRetry,
  onFallbackToProcedural,
  onExitToMenu,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-6">
      <div className="w-full max-w-lg bg-slate-900 border border-rose-500/50 rounded-2xl shadow-2xl p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-950/80 border border-rose-500 flex items-center justify-center text-rose-400 text-2xl font-black">
          !
        </div>

        <h2 className="text-2xl font-black tracking-wider text-rose-400 mb-2">{title}</h2>
        <p className="text-sm text-slate-300 mb-4">{message}</p>

        {sourceUrl && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left font-mono text-xs text-slate-400 break-all mb-6">
            <span className="text-slate-500">Resource:</span> {sourceUrl}
          </div>
        )}

        <div className="space-y-3">
          {onFallbackToProcedural && (
            <button
              onClick={() => {
                AUDIO.playUiSelect();
                onFallbackToProcedural();
              }}
              className="w-full py-3 px-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] focus:ring-4 focus:ring-cyan-300"
            >
              PLAY WITH PROCEDURAL VIDEO STREAM (RECOMMENDED)
            </button>
          )}

          <button
            onClick={() => {
              AUDIO.playUiSelect();
              onRetry();
            }}
            className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 rounded-xl transition-all"
          >
            RETRY LOADING RESOURCE
          </button>

          <button
            onClick={() => {
              AUDIO.playUiSelect();
              onExitToMenu();
            }}
            className="w-full py-2.5 px-6 text-slate-400 hover:text-white font-bold text-xs transition-colors"
          >
            RETURN TO MENU
          </button>
        </div>
      </div>
    </div>
  );
};
