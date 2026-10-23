/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PROFILES } from '../engine/ProfileManager';
import { AUDIO } from '../engine/AudioManager';
import { PlayerProfile } from '../types/game';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const [profiles, setProfiles] = useState<PlayerProfile[]>(PROFILES.getProfiles());
  const [activeProfile, setActiveProfile] = useState<PlayerProfile>(PROFILES.getActiveProfile());
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      AUDIO.playUiSelect();
      const p = PROFILES.createProfile(newName.trim());
      setProfiles(PROFILES.getProfiles());
      setActiveProfile(p);
      setNewName('');
      setIsCreating(false);
    }
  };

  const handleSelect = (p: PlayerProfile) => {
    AUDIO.playUiSelect();
    PROFILES.setActiveProfile(p.id);
    setActiveProfile(p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-6">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold tracking-wider text-cyan-400">PLAYER PROFILES</h2>
            <p className="text-xs text-slate-400">Switch profile, view high scores, and create new runner</p>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Profile Card */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-black shadow-lg"
                style={{ backgroundColor: activeProfile.avatarColor }}
              >
                {activeProfile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">{activeProfile.name}</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 rounded">
                    ACTIVE
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Games with recorded scores: {Object.keys(activeProfile.highScores).length}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-600 rounded-lg transition-colors"
            >
              {isCreating ? 'CANCEL' : '+ NEW PROFILE'}
            </button>
          </div>

          {/* New Profile Form */}
          {isCreating && (
            <form onSubmit={handleCreate} className="p-4 bg-slate-950 rounded-xl border border-cyan-800 flex gap-2">
              <input
                type="text"
                placeholder="Enter player name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={18}
                autoFocus
                className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white rounded-lg transition-colors"
              >
                SAVE
              </button>
            </form>
          )}

          {/* Profiles List */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">Available Profiles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profiles.map((p) => {
                const isActive = p.id === activeProfile.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'bg-slate-800 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-2 ring-cyan-400'
                        : 'bg-slate-950 border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: p.avatarColor }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-bold text-slate-200 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {Object.keys(p.highScores).length} high scores
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Profile Best Scores */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-400 mb-3">
              High Scores for {activeProfile.name}
            </h3>
            {Object.keys(activeProfile.highScores).length === 0 ? (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                No high scores recorded yet. Play a game to set a record!
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(activeProfile.highScores).map(([gameId, record]) => (
                  <div
                    key={gameId}
                    className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-200 uppercase">{gameId}</div>
                      <div className="text-[10px] text-slate-500">Date: {record.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-mono font-black text-cyan-400">
                        {record.score.toLocaleString()} PTS
                      </div>
                      {record.maxCombo && record.maxCombo > 0 && (
                        <div className="text-[10px] text-amber-400 font-bold">{record.maxCombo}x COMBO</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
