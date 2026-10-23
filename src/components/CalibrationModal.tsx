/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SETTINGS } from '../engine/settings';
import { INPUT, UnifiedInputState } from '../engine/InputManager';
import { AUDIO } from '../engine/AudioManager';
import { MatAction } from '../types/game';

interface CalibrationModalProps {
  onClose: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({ onClose }) => {
  const [settings, setSettings] = useState(SETTINGS.get());
  const [inputState, setInputState] = useState<UnifiedInputState>(INPUT.getState());
  const [bindingAction, setBindingAction] = useState<MatAction | 'INTENSITY' | null>(null);

  useEffect(() => {
    const unsubInput = INPUT.subscribe((st) => {
      setInputState(st);

      // If user is currently rebinding an action and pressed a button
      if (bindingAction) {
        // Check if any button is pressed
        const pressedBtnIdx = st.rawButtons.findIndex(Boolean);
        if (pressedBtnIdx >= 0) {
          applyBinding(bindingAction, pressedBtnIdx);
        }
      }
    });

    return () => unsubInput();
  }, [bindingAction, settings]);

  const applyBinding = (action: MatAction | 'INTENSITY', buttonIndex: number) => {
    AUDIO.playUiSelect();
    const map = { ...settings.input };

    if (action === 'LEFT') map.leftButton = buttonIndex;
    else if (action === 'RIGHT') map.rightButton = buttonIndex;
    else if (action === 'CENTER') map.centerButton = buttonIndex;
    else if (action === 'JUMP') map.jumpButton = buttonIndex;
    else if (action === 'SLIDE') map.slideButton = buttonIndex;

    SETTINGS.update({ input: map });
    setSettings(SETTINGS.get());
    setBindingAction(null);
  };

  const actionsList: { id: MatAction; label: string; current: number; color: string }[] = [
    { id: 'LEFT', label: 'Mat Left Zone', current: settings.input.leftButton, color: 'text-purple-400' },
    { id: 'CENTER', label: 'Mat Center Zone', current: settings.input.centerButton, color: 'text-emerald-400' },
    { id: 'RIGHT', label: 'Mat Right Zone', current: settings.input.rightButton, color: 'text-pink-400' },
    { id: 'JUMP', label: 'Mat Jump (Top)', current: settings.input.jumpButton, color: 'text-cyan-400' },
    { id: 'SLIDE', label: 'Mat Slide (Bottom)', current: settings.input.slideButton, color: 'text-amber-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold tracking-wider text-cyan-400">FLOOR MAT & GAMEPAD CALIBRATION</h2>
            <p className="text-xs text-slate-400">Live axes, button monitoring, and physical mat remapping</p>
          </div>
          <button
            onClick={() => {
              AUDIO.playUiSelect();
              onClose();
            }}
            className="px-5 py-2 text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors focus:ring-4 focus:ring-cyan-300"
          >
            DONE (ESC)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Hardware Status Banner */}
          <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  inputState.hasGamepad ? 'bg-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-amber-400'
                }`}
              />
              <div>
                <div className="text-sm font-bold text-slate-200">
                  {inputState.hasGamepad ? inputState.gamepadId : 'No Floor Mat / Gamepad Detected'}
                </div>
                <div className="text-xs text-slate-400">
                  {inputState.hasGamepad
                    ? 'Gamepad API device connected and active'
                    : 'Using Keyboard Fallback (Arrows / WASD / Space / Shift)'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Running Cadence Intensity:</span>
              <div className="text-lg font-mono font-bold text-cyan-400">
                {Math.round(inputState.intensity * 100)}%
              </div>
            </div>
          </div>

          {/* Action Button Mappings */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">
              Physical Mat Zone Mappings
            </h3>
            {bindingAction && (
              <div className="p-3 mb-3 bg-cyan-950/80 border border-cyan-500 rounded-lg text-cyan-200 text-sm text-center font-bold animate-pulse">
                STEP ON OR PRESS BUTTON FOR: {bindingAction}...
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {actionsList.map((item) => {
                const isCurrentlyActive = inputState.actions[item.id];
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isCurrentlyActive
                        ? 'bg-slate-800 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className={`text-sm font-bold ${item.color}`}>{item.label}</div>
                      <div className="text-xs text-slate-400 font-mono">Button ID: {item.current}</div>
                    </div>
                    <button
                      onClick={() => setBindingAction(item.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-200 transition-colors focus:ring-2 focus:ring-cyan-400"
                    >
                      {bindingAction === item.id ? 'PRESS...' : 'REBIND'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Axes Meters */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">
              Live Gamepad Axes ({inputState.rawAxes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {inputState.rawAxes.map((val, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>AXIS {idx}</span>
                    <span className="text-cyan-400 font-bold">{val.toFixed(2)}</span>
                  </div>
                  <div className="relative h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    {/* Centered zero meter */}
                    <div
                      className="absolute top-0 bottom-0 bg-cyan-400 transition-all duration-75"
                      style={{
                        left: val >= 0 ? '50%' : `${50 + (val * 50)}%`,
                        width: `${Math.abs(val) * 50}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Buttons Grid */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">
              Live Gamepad Buttons ({inputState.rawButtons.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {inputState.rawButtons.map((pressed, idx) => (
                <div
                  key={idx}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg font-mono text-xs font-bold border transition-all duration-75 ${
                    pressed
                      ? 'bg-cyan-500 text-white border-cyan-300 shadow-[0_0_12px_#06b6d4] scale-95'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  {idx}
                </div>
              ))}
            </div>
          </div>

          {/* Settings & Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>CADENCE SENSITIVITY</span>
                <span className="text-cyan-400 font-mono">{settings.input.cadenceSensitivity.toFixed(1)} steps/s</span>
              </label>
              <input
                type="range"
                min="1.0"
                max="6.0"
                step="0.2"
                value={settings.input.cadenceSensitivity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  SETTINGS.update({ input: { ...settings.input, cadenceSensitivity: val } });
                  setSettings(SETTINGS.get());
                }}
                className="w-full accent-cyan-400"
              />
              <span className="text-[11px] text-slate-400">
                Number of floor mat steps per second required to reach maximum running intensity.
              </span>
            </div>

            <div>
              <label className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>AXIS DEADZONE</span>
                <span className="text-cyan-400 font-mono">{Math.round(settings.input.axisDeadzone * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={settings.input.axisDeadzone}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  SETTINGS.update({ input: { ...settings.input, axisDeadzone: val } });
                  setSettings(SETTINGS.get());
                }}
                className="w-full accent-cyan-400"
              />
              <span className="text-[11px] text-slate-400">
                Deadzone threshold for directional axes on floor mat or analog stick.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-t border-slate-800">
          <button
            onClick={() => {
              AUDIO.playUiSelect();
              SETTINGS.resetToDefaults();
              setSettings(SETTINGS.get());
            }}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-700 rounded-lg hover:border-slate-500 transition-colors"
          >
            RESET DEFAULTS
          </button>
          <button
            onClick={() => {
              AUDIO.playUiSelect();
              onClose();
            }}
            className="px-6 py-2 text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors focus:ring-4 focus:ring-cyan-300"
          >
            SAVE & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
