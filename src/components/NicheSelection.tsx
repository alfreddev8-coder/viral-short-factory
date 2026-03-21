import { useStore } from '../store';
import type { NicheOption } from '../types';
import { Flame, Trophy, Star, Swords, Brain, Microscope, Gamepad2, Music, Banknote, Heart, Plus } from 'lucide-react';
import { useState } from 'react';

const NICHES: NicheOption[] = [
  { id: 'sports', name: 'Sports', emoji: '🏆', description: 'Epic plays, records & athlete stories', color: 'from-orange-500/20 to-amber-500/10', sampleTopics: ['NBA records', 'Soccer goals', 'Boxing knockouts'] },
  { id: 'celebrities', name: 'Celebrities', emoji: '⭐', description: 'Fame, scandals & untold stories', color: 'from-yellow-500/20 to-pink-500/10', sampleTopics: ['Celebrity secrets', 'Rich lifestyles', 'Career comebacks'] },
  { id: 'war-facts', name: 'War Facts', emoji: '⚔️', description: 'History, battles & military secrets', color: 'from-red-500/20 to-gray-500/10', sampleTopics: ['WWII secrets', 'Military tech', 'Famous battles'] },
  { id: 'science', name: 'Science', emoji: '🔬', description: 'Mind-blowing discoveries & facts', color: 'from-cyan-500/20 to-blue-500/10', sampleTopics: ['Space facts', 'Human body', 'Quantum physics'] },
  { id: 'psychology', name: 'Psychology', emoji: '🧠', description: 'Mind tricks, behavior & human nature', color: 'from-purple-500/20 to-indigo-500/10', sampleTopics: ['Dark psychology', 'Body language', 'Manipulation'] },
  { id: 'gaming', name: 'Gaming', emoji: '🎮', description: 'Game facts, speedruns & Easter eggs', color: 'from-green-500/20 to-emerald-500/10', sampleTopics: ['Hidden secrets', 'Speedrun records', 'Game lore'] },
  { id: 'music', name: 'Music', emoji: '🎵', description: 'Artists, industry secrets & hits', color: 'from-pink-500/20 to-rose-500/10', sampleTopics: ['Song meanings', 'Industry secrets', 'Artist stories'] },
  { id: 'money', name: 'Money & Finance', emoji: '💰', description: 'Wealth, investing & money facts', color: 'from-emerald-500/20 to-green-500/10', sampleTopics: ['Billionaire habits', 'Crypto facts', 'Money hacks'] },
  { id: 'relationships', name: 'Relationships', emoji: '❤️', description: 'Love, dating & social dynamics', color: 'from-rose-500/20 to-red-500/10', sampleTopics: ['Dating tips', 'Red flags', 'Love psychology'] },
  { id: 'motivation', name: 'Motivation', emoji: '🔥', description: 'Success stories & hustle culture', color: 'from-amber-500/20 to-orange-500/10', sampleTopics: ['Success quotes', 'Rags to riches', 'Discipline tips'] },
];

const iconMap: Record<string, any> = {
  sports: Trophy, celebrities: Star, 'war-facts': Swords, science: Microscope,
  psychology: Brain, gaming: Gamepad2, music: Music, money: Banknote,
  relationships: Heart, motivation: Flame,
};

export default function NicheSelection() {
  const { project, updateProject, setStep } = useStore();
  const [customNiche, setCustomNiche] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const selectNiche = (niche: NicheOption) => {
    updateProject({ niche: niche.name, nicheEmoji: niche.emoji });
  };

  const handleContinue = () => {
    if (showCustom && customNiche.trim()) {
      updateProject({ niche: customNiche.trim(), nicheEmoji: '🎯' });
      setStep(2);
    } else if (project.niche) {
      setStep(2);
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Choose Your Niche</h1>
        <p className="text-surface-200 text-lg">Select the content category for your viral short</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {NICHES.map((niche) => {
          const Icon = iconMap[niche.id] || Flame;
          const selected = project.niche === niche.name;
          return (
            <button
              key={niche.id}
              onClick={() => { setShowCustom(false); selectNiche(niche); }}
              className={`niche-card relative p-4 rounded-xl text-left transition-all border ${
                selected
                  ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/30'
                  : 'border-surface-600 bg-surface-800 hover:border-surface-400'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${niche.color} flex items-center justify-center mb-3`}>
                <Icon size={20} className={selected ? 'text-brand-400' : 'text-surface-200'} />
              </div>
              <div className="text-sm font-semibold text-white mb-1">{niche.emoji} {niche.name}</div>
              <div className="text-xs text-surface-300 leading-tight">{niche.description}</div>
              {selected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 animate-pulse-glow" />
              )}
            </button>
          );
        })}

        <button
          onClick={() => { setShowCustom(true); updateProject({ niche: '', nicheEmoji: '' }); }}
          className={`niche-card p-4 rounded-xl text-left border transition-all ${
            showCustom
              ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/30'
              : 'border-surface-600 bg-surface-800 hover:border-surface-400 border-dashed'
          }`}
        >
          <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center mb-3">
            <Plus size={20} className="text-surface-300" />
          </div>
          <div className="text-sm font-semibold text-white mb-1">Custom</div>
          <div className="text-xs text-surface-300 leading-tight">Enter your own niche</div>
        </button>
      </div>

      {showCustom && (
        <div className="mb-6 animate-slide-up">
          <input
            type="text"
            value={customNiche}
            onChange={(e) => setCustomNiche(e.target.value)}
            placeholder="Enter your custom niche (e.g., Ancient Mythology, Street Food, etc.)"
            className="w-full bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder-surface-400 text-sm"
          />
        </div>
      )}

      {project.niche && !showCustom && (
        <div className="glass-card rounded-xl p-4 mb-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{project.nicheEmoji}</span>
            <span className="text-white font-semibold">{project.niche}</span>
            <span className="text-xs bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full">Selected</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {NICHES.find(n => n.name === project.niche)?.sampleTopics.map((t) => (
              <span key={t} className="text-xs bg-surface-700 text-surface-200 px-2 py-1 rounded-md">{t}</span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={!project.niche && !(showCustom && customNiche.trim())}
        className="w-full md:w-auto px-8 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm"
      >
        Continue to Script →
      </button>
    </div>
  );
}
