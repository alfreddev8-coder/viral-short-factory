import { useStore } from './store';
import NicheSelection from './components/NicheSelection';
import ScriptCreation from './components/ScriptCreation';
import VoiceSetup from './components/VoiceSetup';
import Production from './components/Production';
import HistoryView from './components/History';
import {
  Clapperboard, ListChecks, FileText, Mic, Rocket,
  CheckCircle2, X, AlertCircle, Info, RotateCcw, History as HistoryIcon
} from 'lucide-react';
import { useState } from 'react';

const STEPS = [
  { num: 1, label: 'Niche', icon: ListChecks },
  { num: 2, label: 'Script', icon: FileText },
  { num: 3, label: 'Voice', icon: Mic },
  { num: 4, label: 'Produce', icon: Rocket },
] as const;

function StepIndicator() {
  const { currentStep, project } = useStore();

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        // Skip voice step indicator if mp3-first mode
        if (step.num === 3 && project.scriptMode === 'mp3-first') return null;
        const Icon = step.icon;
        const isActive = currentStep === step.num;
        const isPast = currentStep > step.num;
        return (
          <div key={step.num} className="flex items-center gap-1">
            {i > 0 && !(step.num === 3 && project.scriptMode === 'mp3-first') && (
              <div className={`w-6 md:w-10 h-0.5 rounded-full ${isPast ? 'bg-brand-500' : 'bg-surface-600'}`} />
            )}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive ? 'bg-brand-600 text-white' :
              isPast ? 'bg-brand-500/15 text-brand-300' :
              'bg-surface-800 text-surface-400'
            }`}>
              {isPast ? <CheckCircle2 size={12} /> : <Icon size={12} />}
              <span className="hidden md:inline">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Toast() {
  const { toast, clearToast } = useStore();
  if (!toast) return null;
  const colors = {
    success: 'border-accent-green bg-accent-green/10 text-accent-green',
    error: 'border-accent-red bg-accent-red/10 text-accent-red',
    info: 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan',
  };
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  const Icon = icons[toast.type];
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border ${colors[toast.type]} animate-slide-up shadow-2xl`}>
      <Icon size={16} />
      <span className="text-sm font-medium">{toast.message}</span>
      <button onClick={clearToast} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

function HistoryButton() {
  const { currentStep, setStep } = useStore();
  return (
    <button
      onClick={() => setStep(currentStep === 'history' ? 1 : 'history')}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
        currentStep === 'history' 
          ? 'bg-brand-600 border-brand-500 text-white' 
          : 'bg-surface-800 border-surface-700 text-surface-300 hover:text-white'
      }`}
    >
      <HistoryIcon size={12} />
      <span className="hidden md:inline">{currentStep === 'history' ? 'Back' : 'History'}</span>
    </button>
  );
}

export default function App() {
  const { currentStep, resetProject, project } = useStore();

  return (
    <div className="min-h-screen bg-surface-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface-900/80 backdrop-blur-xl border-b border-surface-700/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center">
              <Clapperboard size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Viral Shorts Factory</h1>
              <p className="text-[10px] text-surface-400 leading-tight">Automated Editing Workflow</p>
            </div>
          </div>

          <StepIndicator />

          <div className="flex items-center gap-2">
            <HistoryButton />
            <button
              onClick={resetProject}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 text-surface-300 hover:text-white rounded-lg text-xs font-medium transition-all border border-surface-700"
            >
              <RotateCcw size={12} />
              <span className="hidden md:inline">New</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Active niche badge */}
        {project.niche && currentStep > 1 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-surface-800 text-surface-300 px-2 py-1 rounded-md border border-surface-700">
              {project.nicheEmoji} {project.niche}
            </span>
            {project.scriptMode && (
              <span className="text-xs bg-surface-800 text-surface-300 px-2 py-1 rounded-md border border-surface-700">
                {project.scriptMode === 'ai' ? '🤖 AI Script' : project.scriptMode === 'custom' ? '📝 Custom Script' : '🎤 MP3 First'}
              </span>
            )}
            {project.segments.length > 0 && (
              <span className="text-xs bg-surface-800 text-surface-300 px-2 py-1 rounded-md border border-surface-700">
                📊 {project.segments.length} segments
              </span>
            )}
          </div>
        )}

        {currentStep === 1 && <NicheSelection />}
        {currentStep === 2 && <ScriptCreation />}
        {currentStep === 3 && <VoiceSetup />}
        {currentStep === 4 && <Production />}
        {currentStep === 'history' && <HistoryView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-800 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-surface-400">
          <div>Viral Shorts Factory — by Alfred ⚡</div>
          <div className="flex items-center gap-3">
            <span>Groq + MoviePy + yt-dlp + Edge TTS</span>
            <span>→ CapCut Export</span>
          </div>
        </div>
      </footer>

      <Toast />
    </div>
  );
}
