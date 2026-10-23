/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SETTINGS } from '../engine/settings';
import { AUDIO } from '../engine/AudioManager';

interface SettingsModalProps {
  onClose: () => void;
  onLoadCustomPackage: (url: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onLoadCustomPackage }) => {
  const [settings, setSettings] = useState(SETTINGS.get());
  const [customUrl, setCustomUrl] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      AUDIO.playUiSelect();
      onLoadCustomPackage(customUrl.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold tracking-wider text-cyan-400">ENGINE & TV SETTINGS</h2>
            <p className="text-xs text-slate-400">Display, timing tolerances, and custom game package URL</p>
          </div>
          <button
            onClick={() => {
              AUDIO.playUiSelect();
              onClose();
            }}
            className="px-4 py-2 text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors focus:ring-4 focus:ring-cyan-300"
          >
            CLOSE
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Custom Package URL Loader */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold tracking-wider uppercase text-cyan-400 mb-2">
              LOAD CUSTOM GAME PACKAGE FROM URL
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Load any external game package via URL containing <code className="text-cyan-300">config.json</code>
            </p>
            <form onSubmit={handleCustomSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/my-game/config.json"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm rounded-lg transition-colors"
              >
                LOAD
              </button>
            </form>
          </div>

          {/* TV Display & Overscan */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-300">
              Android TV Display & Safe Zones
            </h3>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>TV OVERSCAN SAFE MARGIN</span>
                <span className="text-cyan-400 font-mono">{settings.tv.overscanPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={settings.tv.overscanPercent}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  SETTINGS.update({ tv: { ...settings.tv, overscanPercent: val } });
                  setSettings(SETTINGS.get());
                }}
                className="w-full accent-cyan-400"
              />
              <span className="text-[11px] text-slate-400">
                Pads UI borders to prevent cropping on legacy TV edges.
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div>
                <div className="text-sm font-bold text-slate-200">Show Glowing Mat Preview in Corner</div>
                <div className="text-xs text-slate-400">Displays real-time foot contact and intensity gauge</div>
              </div>
              <input
                type="checkbox"
                checked={settings.tv.showMatPreview}
                onChange={(e) => {
                  SETTINGS.update({ tv: { ...settings.tv, showMatPreview: e.target.checked } });
                  setSettings(SETTINGS.get());
                }}
                className="w-5 h-5 accent-cyan-500 rounded"
              />
            </div>
          </div>

          {/* Timing Window */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-300">
              Rhythm & Action Timing Tolerance
            </h3>
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>TIMING WINDOW (GOOD / HIT)</span>
                <span className="text-cyan-400 font-mono">±{settings.timing.timingWindowMs} ms</span>
              </div>
              <input
                type="range"
                min="150"
                max="450"
                step="25"
                value={settings.timing.timingWindowMs}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  SETTINGS.update({ timing: { ...settings.timing, timingWindowMs: val } });
                  setSettings(SETTINGS.get());
                }}
                className="w-full accent-cyan-400"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>PERFECT WINDOW</span>
                <span className="text-cyan-400 font-mono">±{settings.timing.perfectWindowMs} ms</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                step="10"
                value={settings.timing.perfectWindowMs}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  SETTINGS.update({ timing: { ...settings.timing, perfectWindowMs: val } });
                  setSettings(SETTINGS.get());
                }}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>

          {/* Audio Levels */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider uppercase text-slate-300">Audio Volume</h3>
              <button
                type="button"
                onClick={() => {
                  const next = !settings.audio.muted;
                  SETTINGS.update({ audio: { ...settings.audio, muted: next } });
                  setSettings(SETTINGS.get());
                  AUDIO.playUiSelect();
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg ${
                  settings.audio.muted ? 'bg-rose-900/80 text-rose-300' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {settings.audio.muted ? 'MUTED' : 'UNMUTED'}
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>SOUND EFFECTS</span>
                <span className="text-cyan-400 font-mono">{Math.round(settings.audio.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.audio.sfxVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  SETTINGS.update({ audio: { ...settings.audio, sfxVolume: val } });
                  setSettings(SETTINGS.get());
                }}
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>DYNAMIC SYNTH MUSIC</span>
                <span className="text-cyan-400 font-mono">{Math.round(settings.audio.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.audio.musicVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  SETTINGS.update({ audio: { ...settings.audio, musicVolume: val } });
                  setSettings(SETTINGS.get());
                }}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
