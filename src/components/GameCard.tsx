/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameCatalogItem } from '../types/game';
import { PROFILES } from '../engine/ProfileManager';

interface GameCardProps {
  game: GameCatalogItem;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, isSelected, onSelect, onHover }) => {
  const bestScore = PROFILES.getBestScore(game.id);

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'speed':
        return 'text-cyan-400 bg-cyan-950/70 border-cyan-800';
      case 'timeline':
        return 'text-purple-400 bg-purple-950/70 border-purple-800';
      case 'clips':
        return 'text-emerald-400 bg-emerald-950/70 border-emerald-800';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-700';
    }
  };

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`group relative flex flex-col text-left rounded-2xl overflow-hidden border transition-all duration-200 focus:outline-none ${
        isSelected
          ? 'scale-[1.04] bg-slate-800/90 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.45)] ring-4 ring-cyan-400/80 z-10'
          : 'scale-100 bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
      }`}
    >
      {/* Cover Image */}
      <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
        <img
          src={game.cover}
          alt={game.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // Fallback placeholder if image fails
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />

        {/* Mode Tag Overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span
            className={`px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-md border backdrop-blur-md ${getModeColor(
              game.mode
            )}`}
          >
            {game.mode} MODE
          </span>
        </div>

        {/* Difficulty */}
        {game.difficulty && (
          <div className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-bold text-slate-300 bg-slate-950/80 rounded border border-slate-700/60 backdrop-blur-md">
            {game.difficulty}
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide group-hover:text-cyan-300 transition-colors">
            {game.title}
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
            {game.description}
          </p>
        </div>

        {/* Best Score & Play Action */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Best Record</span>
            <span className="font-mono font-bold text-cyan-400 text-sm">
              {bestScore > 0 ? `${bestScore.toLocaleString()} PTS` : '---'}
            </span>
          </div>

          <div
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
              isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isSelected ? 'PRESS TO PLAY' : 'VIEW'}
          </div>
        </div>
      </div>
    </button>
  );
};
