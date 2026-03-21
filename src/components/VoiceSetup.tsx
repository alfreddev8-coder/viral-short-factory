import { useState } from 'react';
import { useStore } from '../store';
import { ArrowLeft, ArrowRight, Upload, Volume2, Mic, Zap, Smile, Shield } from 'lucide-react';

const VOICE_STYLES = [
  { id: 'friendly', name: 'Friendly', icon: Smile, desc: 'Warm, conversational tone', voice: 'en-US-GuyNeural', color: 'text-accent-green' },
  { id: 'bold', name: 'Bold', icon: Shield, desc: 'Strong, authoritative voice', voice: 'en-US-DavisNeural', color: 'text-accent-orange' },
  { id: 'energetic', name: 'Energetic', icon: Zap, desc: 'Fast-paced, exciting delivery', voice: 'en-US-JasonNeural', color: 'text-accent-cyan' },
  { id: 'dramatic', name: 'Dramatic', icon: Volume2, desc: 'Deep, cinematic narration', voice: 'en-GB-RyanNeural', color: 'text-accent-purple' },
  { id: 'female-warm', name: 'Female Warm', icon: Mic, desc: 'Gentle female narrator', voice: 'en-US-JennyNeural', color: 'text-pink-400' },
  { id: 'female-bold', name: 'Female Bold', icon: Zap, desc: 'Confident female voice', voice: 'en-US-AriaNeural', color: 'text-rose-400' },
];

export default function VoiceSetup() {
  const { project, updateProject, setStep, showToast } = useStore();
  const [voiceMode, setVoiceMode] = useState<'upload' | 'ai-tts'>(
    (project.voiceMode === 'upload' ? 'upload' : 'ai-tts') as 'upload' | 'ai-tts'
  );
  const [mp3FileName, setMp3FileName] = useState(project.mp3File?.name || '');

  const handleMp3Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateProject({ mp3File: file, mp3Url: URL.createObjectURL(file), voiceMode: 'upload' });
      setMp3FileName(file.name);
      showToast('Narration MP3 uploaded!', 'success');
    }
  };

  const handleContinue = () => {
    updateProject({ voiceMode });
    setStep(4);
  };

  const canContinue = () => {
    if (voiceMode === 'upload') return !!project.mp3File;
    return !!project.voiceStyle;
  };

  return (
    <div className="animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep(2)} className="text-surface-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">Voice Setup</h1>
          <p className="text-surface-200">Choose how to narrate your video</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => setVoiceMode('ai-tts')}
          className={`p-5 rounded-xl text-left border transition-all ${
            voiceMode === 'ai-tts'
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-surface-600 bg-surface-800 hover:border-surface-400'
          }`}
        >
          <Volume2 size={24} className={voiceMode === 'ai-tts' ? 'text-brand-400 mb-3' : 'text-surface-300 mb-3'} />
          <div className="text-white font-semibold mb-1">AI Voice (Edge TTS)</div>
          <div className="text-xs text-surface-300">Generate narration from your script using free AI voices</div>
        </button>
        <button
          onClick={() => setVoiceMode('upload')}
          className={`p-5 rounded-xl text-left border transition-all ${
            voiceMode === 'upload'
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-surface-600 bg-surface-800 hover:border-surface-400'
          }`}
        >
          <Upload size={24} className={voiceMode === 'upload' ? 'text-brand-400 mb-3' : 'text-surface-300 mb-3'} />
          <div className="text-white font-semibold mb-1">Upload MP3</div>
          <div className="text-xs text-surface-300">Use your own pre-recorded narration file</div>
        </button>
      </div>

      {/* AI Voice Selection */}
      {voiceMode === 'ai-tts' && (
        <div className="mb-8 animate-slide-up">
          <h3 className="text-lg font-bold text-white mb-4">Select Voice Style</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {VOICE_STYLES.map((style) => {
              const Icon = style.icon;
              const selected = project.voiceStyle === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => updateProject({ voiceStyle: style.id })}
                  className={`p-4 rounded-xl text-left border transition-all ${
                    selected
                      ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/20'
                      : 'border-surface-600 bg-surface-800 hover:border-surface-400'
                  }`}
                >
                  <Icon size={20} className={`${style.color} mb-2`} />
                  <div className="text-sm font-semibold text-white">{style.name}</div>
                  <div className="text-xs text-surface-300 mt-0.5">{style.desc}</div>
                  <div className="text-[10px] font-mono text-surface-400 mt-1">{style.voice}</div>
                </button>
              );
            })}
          </div>

          <div className="glass-card rounded-xl p-4 mt-4">
            <h4 className="text-sm font-semibold text-white mb-2">Preview Script</h4>
            <div className="text-xs text-surface-300 leading-relaxed max-h-24 overflow-y-auto">
              {project.rawScript || 'No script generated yet'}
            </div>
            <p className="text-[10px] text-surface-400 mt-2">
              💡 Edge TTS will be used in the automation pipeline (GitHub Actions) to generate the voiceover MP3 from your script
            </p>
          </div>
        </div>
      )}

      {/* Upload MP3 */}
      {voiceMode === 'upload' && (
        <div className="mb-8 animate-slide-up">
          <div className="glass-card rounded-xl p-6 border border-dashed border-surface-500 text-center">
            <Upload size={32} className="text-surface-400 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">
              {mp3FileName || 'Drop or select your narration MP3'}
            </p>
            <p className="text-xs text-surface-400 mb-4">Supports MP3 and audio files</p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 rounded-xl cursor-pointer transition-colors text-white text-sm font-medium">
              <Upload size={14} />
              Choose File
              <input type="file" accept="audio/mp3,audio/mpeg,audio/*" onChange={handleMp3Upload} className="hidden" />
            </label>
            {project.mp3Url && (
              <div className="mt-4">
                <audio controls src={project.mp3Url} className="w-full h-10 rounded-lg" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => setStep(2)} className="px-6 py-3 bg-surface-700 text-surface-200 hover:bg-surface-600 rounded-xl text-sm font-medium transition-all">
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!canContinue()}
          className="px-8 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm flex items-center gap-2"
        >
          Start Production
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
