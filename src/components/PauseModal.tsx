/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SETTINGS } from '../engine/settings';
import { AUDIO } from '../engine/AudioManager';
import { INPUT, UiNavDirection } from '../engine/InputManager';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenCalibration: () => void;
  onQuitToMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onOpenCalibration,
  onQuitToMenu,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(SETTINGS.get().audio.muted);

  const menuOptions = [
    { label: 'RESUME GAME', action: onResume },
    { label: 'RESTART GAME', action: onRestart },
    { label: 'CALIBRATE FLOOR MAT', action: onOpenCalibration },
    {
      label: isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO',
      action: () => {
        const nextMute = !isMuted;
        SETTINGS.update({ audio: { ...SETTINGS.get().audio, muted: nextMute } });
        setIsMuted(nextMute);
        AUDIO.playUiSelect();
      },
    },
    { label: 'QUIT TO MAIN MENU', action: onQuitToMenu },
  ];

  useEffect(() => {
    const unsub = INPUT.onUiNav((dir: UiNavDirection) => {
      if (dir === 'UP') {
        AUDIO.playUiMove();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuOptions.length - 1));
      } else if (dir === 'DOWN') {
        AUDIO.playUiMove();
        setSelectedIndex((prev) => (prev < menuOptions.length - 1 ? prev + 1 : 0));
      } else if (dir === 'SELECT') {
        AUDIO.playUiSelect();
        menuOptions[selectedIndex].action();
      } else if (dir === 'BACK' || dir === 'PAUSE') {
        AUDIO.playUiSelect();
        onResume();
      }
    });

    return () => unsub();
  }, [selectedIndex, isMuted]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden p-6 text-center">
        <h2 className="text-2xl font-black tracking-widest text-white mb-1">GAME PAUSED</h2>
        <p className="text-xs text-slate-400 mb-6">Use Gamepad D-Pad or Arrow Keys to Navigate</p>

        <div className="space-y-3">
          {menuOptions.map((opt, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={opt.label}
                onClick={() => {
                  AUDIO.playUiSelect();
                  opt.action();
                }}
                onMouseEnter={() => {
                  setSelectedIndex(idx);
                  AUDIO.playUiMove();
                }}
                className={`w-full py-3.5 px-6 rounded-xl font-bold tracking-wider text-sm transition-all duration-100 border ${
                  isSelected
                    ? 'bg-cyan-600 text-white border-cyan-400 scale-[1.03] shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-2 ring-cyan-300'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
