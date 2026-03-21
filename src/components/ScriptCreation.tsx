import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import {
  generateScript, generateTimestamps, generateMetadata,
  extractKeywordsFromSegments, bulkExtractKeywords, fetchGroqModels
} from '../utils/groq';
import type { TimestampedSegment } from '../types';
import {
  Sparkles, FileText, Upload, ArrowLeft, ArrowRight, Loader2,
  Clock, Hash, Trash2, Plus, RefreshCw, Wand2, AlertCircle,
  ChevronDown, Cpu, Zap, ClipboardPaste, SplitSquareVertical,
  CheckCircle2, Copy, Tag
} from 'lucide-react';

type Mode = 'ai' | 'custom' | 'mp3-first';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function parseTimestampedText(raw: string): TimestampedSegment[] {
  const segments: TimestampedSegment[] = [];
  const timestampPattern = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/;
  const hasTimestamps = timestampPattern.test(raw);

  if (hasTimestamps) {
    const regex = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s*[:\-–—]?\s*/g;
    const parts: { start: string; end: string; textStart: number }[] = [];
    let match;
    while ((match = regex.exec(raw)) !== null) {
      parts.push({ start: match[1], end: match[2], textStart: match.index + match[0].length });
    }
    for (let i = 0; i < parts.length; i++) {
      const textEnd = i < parts.length - 1
        ? findSeparator(raw, parts[i].textStart, parts[i + 1].textStart)
        : raw.length;
      const text = raw.substring(parts[i].textStart, textEnd).replace(/^[,\s]+|[,\s]+$/g, '').trim();
      if (text) {
        segments.push({ id: uid(), startTime: parts[i].start, endTime: parts[i].end, text, keywords: [], clipQuery: '' });
      }
    }
  } else {
    const delimiter = raw.includes('\n') ? '\n' : ',';
    const pieces = raw.split(delimiter).map(s => s.trim()).filter(Boolean);
    const segDuration = pieces.length > 0 ? Math.max(3, Math.floor(60 / pieces.length)) : 5;
    pieces.forEach((text, i) => {
      const startSec = i * segDuration;
      const endSec = (i + 1) * segDuration;
      segments.push({ id: uid(), startTime: formatTime(startSec), endTime: formatTime(endSec), text, keywords: [], clipQuery: '' });
    });
  }
  return segments;
}

function findSeparator(raw: string, from: number, before: number): number {
  let pos = before;
  for (let i = before - 1; i >= from; i--) {
    if (raw[i] === ',' || raw[i] === '\n') { pos = i; break; }
  }
  return pos;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ScriptCreation() {
  const {
    project, updateProject, setStep,
    groqApiKey, setGroqApiKey,
    groqModel, setGroqModel,
    groqModels, setGroqModels,
    modelsLoading, setModelsLoading,
    isGenerating, setIsGenerating, showToast,
    addSegment, updateSegment, removeSegment, setSegments
  } = useStore();

  const [mode, setMode] = useState<Mode>(project.scriptMode || 'ai');
  const [localScript, setLocalScript] = useState(project.rawScript || '');
  const [mp3FileName, setMp3FileName] = useState(project.mp3File?.name || '');
  const [timestampPaste, setTimestampPaste] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);

  const loadModels = useCallback(async (key: string) => {
    if (!key || key.length < 10) return;
    setModelsLoading(true);
    try {
      const models = await fetchGroqModels(key);
      setGroqModels(models);
      if (!groqModel && models.length > 0) {
        const preferred = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768'];
        const found = preferred.find(p => models.some(m => m.id === p));
        setGroqModel(found || models[0].id);
      }
    } catch (e: any) {
      showToast('Failed to load models: ' + (e.message || 'Unknown error'), 'error');
    }
    setModelsLoading(false);
  }, [groqModel, setGroqModel, setGroqModels, setModelsLoading, showToast]);

  useEffect(() => {
    if (groqApiKey && groqModels.length === 0 && !modelsLoading) {
      loadModels(groqApiKey);
    }
  }, [groqApiKey, groqModels.length, modelsLoading, loadModels]);

  const handleApiKeyChange = (key: string) => {
    setGroqApiKey(key);
    if (key.length >= 20) {
      setGroqModels([]);
      setGroqModel('');
      loadModels(key);
    }
  };

  const handleModeSelect = (m: Mode) => {
    setMode(m);
    updateProject({ scriptMode: m });
  };

  const handleGenerateScript = async () => {
    if (!groqApiKey) { showToast('Please set GROQ_API_KEY in .env/Vercel', 'error'); return; }
    if (!groqModel) { showToast('Please select a model', 'error'); return; }
    setIsGenerating(true);
    try {
      const script = await generateScript(groqApiKey, groqModel, project.niche);
      setLocalScript(script);
      updateProject({ rawScript: script });
      showToast('Script generated successfully!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to generate script', 'error');
    }
    setIsGenerating(false);
  };

  const handleGenerateTimestamps = async () => {
    if (!groqApiKey || !groqModel) { showToast('Check API key in .env and model', 'error'); return; }
    const scriptText = localScript || project.rawScript;
    if (!scriptText.trim()) { showToast('Script is empty', 'error'); return; }
    setIsGenerating(true);
    try {
      const segments = await generateTimestamps(groqApiKey, groqModel, scriptText, project.niche);
      setSegments(segments);
      showToast('Timestamps generated!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to generate timestamps', 'error');
    }
    setIsGenerating(false);
  };

  const handleGenerateMetadata = async () => {
    if (!groqApiKey || !groqModel) { showToast('Set API key and model first', 'error'); return; }
    const scriptText = localScript || project.rawScript || project.segments.map(s => s.text).join(' ');
    if (!scriptText.trim()) { showToast('Script is empty', 'error'); return; }
    setMetaLoading(true);
    try {
      const meta = await generateMetadata(groqApiKey, groqModel, scriptText, project.niche);
      updateProject({
        metadataOptions: meta,
        selectedTitleIndex: 0,
        selectedDescriptionIndex: 0,
        title: meta.titles[0] || '',
        description: meta.descriptions[0] || '',
        tags: meta.tags || [],
      });
      showToast('🔥 Generated 3 viral titles, 3 descriptions & tags!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to generate metadata', 'error');
    }
    setMetaLoading(false);
  };

  const selectTitle = (idx: number) => {
    if (!project.metadataOptions) return;
    updateProject({
      selectedTitleIndex: idx,
      title: project.metadataOptions.titles[idx] || '',
    });
  };

  const selectDescription = (idx: number) => {
    if (!project.metadataOptions) return;
    updateProject({
      selectedDescriptionIndex: idx,
      description: project.metadataOptions.descriptions[idx] || '',
    });
  };

  const handleAutoExtractKeywords = async (segId: string, text: string) => {
    if (!groqApiKey || !groqModel || !text.trim()) return;
    try {
      const result = await extractKeywordsFromSegments(groqApiKey, groqModel, text, project.niche);
      updateSegment(segId, { keywords: result.keywords, clipQuery: result.clipQuery });
    } catch { /* silent */ }
  };

  const handleBulkExtractKeywords = async () => {
    if (!groqApiKey || !groqModel) { showToast('Set API key and model first', 'error'); return; }
    const segsWithText = project.segments.filter(s => s.text.trim());
    if (segsWithText.length === 0) { showToast('No segments with text', 'error'); return; }
    setBulkLoading(true);
    try {
      const updated = await bulkExtractKeywords(groqApiKey, groqModel, project.segments, project.niche);
      setSegments(updated);
      showToast(`Keywords extracted for ${updated.length} segments!`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to extract keywords', 'error');
    }
    setBulkLoading(false);
  };

  const handleMp3Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateProject({ mp3File: file, mp3Url: URL.createObjectURL(file), voiceMode: 'mp3-first' });
      setMp3FileName(file.name);
      showToast('MP3 uploaded! Now paste your timestamped script below.', 'info');
    }
  };

  const handleParseTimestamps = () => {
    if (!timestampPaste.trim()) { showToast('Paste your timestamped script first', 'error'); return; }
    const parsed = parseTimestampedText(timestampPaste);
    if (parsed.length === 0) { showToast('Could not parse any segments', 'error'); return; }
    setSegments(parsed);
    const fullScript = parsed.map(s => s.text).join(' ');
    setLocalScript(fullScript);
    updateProject({ rawScript: fullScript });
    showToast(`Parsed ${parsed.length} segments! Click "AI Auto-fill Keywords" next.`, 'success');
  };

  const handleContinue = () => {
    updateProject({ rawScript: localScript, scriptMode: mode });
    if (mode === 'mp3-first') {
      updateProject({ voiceMode: 'mp3-first' });
      setStep(4);
    } else {
      setStep(3);
    }
  };

  const canContinue = () => {
    if (mode === 'mp3-first') return project.mp3File && project.segments.length > 0;
    return (localScript.trim() || project.rawScript.trim()) && project.segments.length > 0;
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied!', 'success');
  };

  return (
    <div className="animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep(1)} className="text-surface-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">Create Your Script</h1>
          <p className="text-surface-200">
            {project.nicheEmoji} {project.niche} – Choose how to create your content
          </p>
        </div>
      </div>

      {/* API Key + Model */}
      <div className="glass-card rounded-xl p-4 mb-6 space-y-3">
        <div className="flex items-start gap-3 flex-col sm:flex-row">
          {/* API Key removed from UI as per requirements, relying on .env */}
          <div className="flex-1 w-full">
            <label className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 block">
              <Cpu size={11} /> Model
              {modelsLoading && <Loader2 size={11} className="animate-spin text-brand-400" />}
            </label>
            <div className="relative">
              <button
                onClick={() => groqModels.length > 0 && setShowModelDropdown(!showModelDropdown)}
                className={`w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between transition-colors ${
                  groqModels.length === 0 ? 'text-surface-500 cursor-not-allowed' : 'text-white hover:border-surface-400 cursor-pointer'
                }`}
                disabled={groqModels.length === 0}
              >
                <span className="truncate font-mono text-xs">
                  {modelsLoading ? 'Loading models...' : groqModel ? groqModel : groqApiKey ? 'Select a model...' : 'Enter API key first'}
                </span>
                <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showModelDropdown && groqModels.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
                  {groqModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setGroqModel(m.id); setShowModelDropdown(false); showToast(`Model: ${m.id}`, 'info'); }}
                      className={`w-full px-3 py-2.5 text-left text-sm hover:bg-surface-700 transition-colors flex items-center gap-2 border-b border-surface-700/50 last:border-0 ${
                        groqModel === m.id ? 'bg-brand-600/15 text-brand-300' : 'text-white'
                      }`}
                    >
                      {groqModel === m.id && <Zap size={12} className="text-brand-400 flex-shrink-0" />}
                      <div className="min-w-0">
                        <div className="font-mono text-xs truncate">{m.id}</div>
                        <div className="text-[10px] text-surface-400">{m.owned_by}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {groqApiKey && !modelsLoading && groqModels.length === 0 && (
              <button onClick={() => loadModels(groqApiKey)} className="text-xs text-brand-400 hover:text-brand-300 mt-1 flex items-center gap-1">
                <RefreshCw size={10} /> Retry loading models
              </button>
            )}
          </div>
        </div>
        {groqModel && (
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-brand-500/15 text-brand-300 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
              <Zap size={10} /> {groqModel}
            </span>
            <span className="text-surface-400">ready</span>
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {([
          { key: 'ai', icon: Sparkles, label: 'AI Generated', desc: 'Let AI write your script' },
          { key: 'custom', icon: FileText, label: 'Paste Script', desc: 'Use your own script' },
          { key: 'mp3-first', icon: Upload, label: 'Upload MP3 First', desc: 'Add narration, then timestamps' },
        ] as const).map(({ key, icon: Icon, label, desc }) => (
          <button
            key={key}
            onClick={() => handleModeSelect(key)}
            className={`p-4 rounded-xl text-left border transition-all ${
              mode === key ? 'border-brand-500 bg-brand-500/10' : 'border-surface-600 bg-surface-800 hover:border-surface-400'
            }`}
          >
            <Icon size={20} className={mode === key ? 'text-brand-400 mb-2' : 'text-surface-300 mb-2'} />
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="text-xs text-surface-300">{desc}</div>
          </button>
        ))}
      </div>

      {/* AI Mode */}
      {mode === 'ai' && (
        <div className="space-y-4 mb-6">
          <button
            onClick={handleGenerateScript}
            disabled={isGenerating || !groqApiKey || !groqModel}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-90 disabled:opacity-40 text-white font-semibold rounded-xl transition-all text-sm"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Generate Script with AI
          </button>
          <textarea
            value={localScript}
            onChange={(e) => setLocalScript(e.target.value)}
            placeholder="Your AI-generated script will appear here. You can also edit it..."
            className="w-full h-48 bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder-surface-400 text-sm leading-relaxed resize-none"
          />
        </div>
      )}

      {/* Custom Mode */}
      {mode === 'custom' && (
        <div className="space-y-4 mb-6">
          <textarea
            value={localScript}
            onChange={(e) => setLocalScript(e.target.value)}
            placeholder="Paste your script here..."
            className="w-full h-48 bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder-surface-400 text-sm leading-relaxed resize-none"
          />
        </div>
      )}

      {/* MP3-First Mode */}
      {mode === 'mp3-first' && (
        <div className="space-y-4 mb-6">
          <div className="glass-card rounded-xl p-5 border border-dashed border-surface-500">
            <div className="flex items-start gap-3 mb-3">
              <AlertCircle size={18} className="text-accent-cyan mt-0.5 flex-shrink-0" />
              <div className="text-sm text-surface-200">
                <strong className="text-white">Step 1:</strong> Upload your pre-recorded narration MP3.
              </div>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 rounded-lg cursor-pointer transition-colors">
              <Upload size={16} className="text-accent-cyan" />
              <span className="text-sm text-white font-medium">{mp3FileName || 'Choose MP3 File'}</span>
              <input type="file" accept="audio/mp3,audio/mpeg,audio/*" onChange={handleMp3Upload} className="hidden" />
            </label>
            {project.mp3Url && (
              <div className="mt-3">
                <audio controls src={project.mp3Url} className="w-full h-10 rounded-lg" />
              </div>
            )}
          </div>

          <div className="glass-card rounded-xl p-5 border border-surface-600">
            <div className="flex items-start gap-3 mb-3">
              <ClipboardPaste size={18} className="text-accent-purple mt-0.5 flex-shrink-0" />
              <div className="text-sm text-surface-200">
                <strong className="text-white">Step 2:</strong> Paste your full timestamped script. Separate by{' '}
                <code className="text-brand-300 bg-surface-700 px-1 rounded">comma</code> or{' '}
                <code className="text-brand-300 bg-surface-700 px-1 rounded">new line</code>.
              </div>
            </div>
            <div className="bg-surface-800 rounded-lg p-3 mb-3 text-xs font-mono text-surface-400 space-y-1.5">
              <div className="text-surface-300 font-sans font-semibold text-[11px] mb-2">📋 Supported formats:</div>
              <div>
                <span className="text-accent-green">With timestamps:</span><br />
                <span className="text-surface-300">0:00-0:05 This is the hook, 0:05-0:12 Then the main point</span>
              </div>
              <div className="border-t border-surface-700 pt-1.5">
                <span className="text-accent-green">Just text (auto-timestamps):</span><br />
                <span className="text-surface-300">This is the hook, Then the main point, Another fact</span>
              </div>
            </div>
            <textarea
              value={timestampPaste}
              onChange={(e) => setTimestampPaste(e.target.value)}
              placeholder="Paste your full timestamped script here..."
              className="w-full h-36 bg-surface-800 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder-surface-400 text-sm leading-relaxed resize-none font-mono"
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleParseTimestamps}
                disabled={!timestampPaste.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 disabled:opacity-40 rounded-lg text-sm font-medium transition-all"
              >
                <SplitSquareVertical size={14} /> Split into Segments
              </button>
              {project.segments.length > 0 && groqApiKey && groqModel && (
                <button
                  onClick={handleBulkExtractKeywords}
                  disabled={bulkLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 disabled:opacity-40 rounded-lg text-sm font-medium transition-all"
                >
                  {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  AI Auto-fill All Keywords
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Segments */}
      {(localScript.trim() || mode === 'mp3-first') && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock size={18} className="text-brand-400" />
              Timestamped Segments
              {project.segments.length > 0 && (
                <span className="text-xs bg-surface-700 text-surface-300 px-2 py-0.5 rounded-md font-normal">
                  {project.segments.length} segments
                </span>
              )}
            </h3>
            {mode !== 'mp3-first' && localScript.trim() && (
              <button
                onClick={handleGenerateTimestamps}
                disabled={isGenerating || !groqApiKey || !groqModel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 disabled:opacity-40 rounded-lg text-xs font-medium transition-all"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                Auto-Generate Timestamps
              </button>
            )}
            {project.segments.length > 0 && groqApiKey && groqModel && mode !== 'mp3-first' && (
              <button
                onClick={handleBulkExtractKeywords}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-cyan/15 text-accent-cyan hover:bg-accent-cyan/25 disabled:opacity-40 rounded-lg text-xs font-medium transition-all"
              >
                {bulkLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                AI Auto-fill All Keywords
              </button>
            )}
            <button
              onClick={() => addSegment()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 text-surface-200 hover:bg-surface-600 rounded-lg text-xs font-medium transition-all"
            >
              <Plus size={12} /> Add Segment
            </button>
          </div>

          {project.segments.length === 0 && (
            <div className="text-center py-8 text-surface-400 text-sm">
              {mode === 'mp3-first' ? 'Paste your timestamped script above and click "Split into Segments"' : 'Click "Auto-Generate Timestamps" or add segments manually'}
            </div>
          )}

          <div className="space-y-3">
            {project.segments.map((seg, i) => (
              <div key={seg.id} className="glass-card rounded-xl p-4 animate-slide-up">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md">#{i + 1}</span>
                  <div className="flex items-center gap-1">
                    <input type="text" value={seg.startTime} onChange={(e) => updateSegment(seg.id, { startTime: e.target.value })} placeholder="0:00" className="w-14 bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-white text-xs font-mono text-center" />
                    <span className="text-surface-400 text-xs">→</span>
                    <input type="text" value={seg.endTime} onChange={(e) => updateSegment(seg.id, { endTime: e.target.value })} placeholder="0:05" className="w-14 bg-surface-700 border border-surface-600 rounded-md px-2 py-1 text-white text-xs font-mono text-center" />
                  </div>
                  <button onClick={() => removeSegment(seg.id)} className="ml-auto text-surface-400 hover:text-accent-red transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={seg.text}
                  onChange={(e) => updateSegment(seg.id, { text: e.target.value })}
                  placeholder="Narration text..."
                  className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-white placeholder-surface-400 text-sm resize-none h-16 mb-2"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Hash size={12} className="text-surface-400" />
                  <input
                    type="text"
                    value={seg.keywords.join(', ')}
                    onChange={(e) => updateSegment(seg.id, { keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Keywords (comma separated)"
                    className="flex-1 bg-surface-800 border border-surface-600 rounded-md px-2 py-1 text-xs text-white placeholder-surface-400 font-mono"
                  />
                  <input
                    type="text"
                    value={seg.clipQuery}
                    onChange={(e) => updateSegment(seg.id, { clipQuery: e.target.value })}
                    placeholder="Clip search query"
                    className="flex-1 bg-surface-800 border border-surface-600 rounded-md px-2 py-1 text-xs text-white placeholder-surface-400"
                  />
                  {groqApiKey && groqModel && seg.text.trim() && (
                    <button onClick={() => handleAutoExtractKeywords(seg.id, seg.text)} className="text-xs text-accent-cyan hover:text-accent-cyan/80 flex items-center gap-1" title="Auto-extract keywords">
                      <RefreshCw size={10} /> AI
                    </button>
                  )}
                </div>
                {seg.keywords.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {seg.keywords.map((kw, ki) => (
                      <span key={ki} className="text-[10px] bg-brand-500/10 text-brand-300 px-1.5 py-0.5 rounded-md">{kw}</span>
                    ))}
                    {seg.clipQuery && (
                      <span className="text-[10px] bg-accent-cyan/10 text-accent-cyan px-1.5 py-0.5 rounded-md ml-1">🔍 {seg.clipQuery}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== VIDEO METADATA — 3 Titles, 3 Descriptions, Tags ===== */}
      {project.segments.length > 0 && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🎬 Video Metadata
            </h3>
            <button
              onClick={handleGenerateMetadata}
              disabled={metaLoading || !groqApiKey || !groqModel}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-90 disabled:opacity-40 text-white font-semibold rounded-xl transition-all text-sm"
            >
              {metaLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Generate 3 Viral Titles + 3 Descriptions + Tags
            </button>
          </div>

          {/* Viral Titles */}
          {project.metadataOptions && project.metadataOptions.titles.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                🏆 Choose Your Viral Title
                <span className="text-xs text-surface-400 font-normal">— click to select</span>
              </h4>
              <div className="space-y-2">
                {project.metadataOptions.titles.map((title, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectTitle(idx)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 group ${
                      project.selectedTitleIndex === idx
                        ? 'border-accent-green bg-accent-green/10 ring-2 ring-accent-green/20'
                        : 'border-surface-600 bg-surface-800 hover:border-surface-400'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      project.selectedTitleIndex === idx ? 'bg-accent-green text-white' : 'bg-surface-700 text-surface-400'
                    }`}>
                      {project.selectedTitleIndex === idx ? <CheckCircle2 size={14} /> : <span className="text-xs">{idx + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium">{title}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyText(title); }}
                      className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-white transition-all"
                    >
                      <Copy size={14} />
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Viral Descriptions */}
          {project.metadataOptions && project.metadataOptions.descriptions.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                📝 Choose Your SEO Description
                <span className="text-xs text-surface-400 font-normal">— click to select</span>
              </h4>
              <div className="space-y-2">
                {project.metadataOptions.descriptions.map((desc, idx) => {
                  const labels = ['🎯 Curiosity-Driven', '📊 Fact-Based', '💥 Emotional'];
                  return (
                    <button
                      key={idx}
                      onClick={() => selectDescription(idx)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 group ${
                        project.selectedDescriptionIndex === idx
                          ? 'border-accent-green bg-accent-green/10 ring-2 ring-accent-green/20'
                          : 'border-surface-600 bg-surface-800 hover:border-surface-400'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        project.selectedDescriptionIndex === idx ? 'bg-accent-green text-white' : 'bg-surface-700 text-surface-400'
                      }`}>
                        {project.selectedDescriptionIndex === idx ? <CheckCircle2 size={14} /> : <span className="text-xs">{idx + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-surface-400 mb-1 uppercase tracking-wider">{labels[idx] || `Option ${idx + 1}`}</div>
                        <div className="text-sm text-white leading-relaxed">{desc}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyText(desc); }}
                        className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-white transition-all"
                      >
                        <Copy size={14} />
                      </button>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {project.metadataOptions && project.metadataOptions.tags.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag size={14} className="text-accent-orange" /> Tags ({project.tags.length})
                </h4>
                <button
                  onClick={() => copyText(project.tags.join(', '))}
                  className="flex items-center gap-1 px-2 py-1 bg-surface-700 text-surface-300 hover:text-white rounded-md text-xs transition-all"
                >
                  <Copy size={10} /> Copy All
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag, i) => (
                  <span key={i} className="text-xs bg-accent-orange/10 text-accent-orange px-2 py-1 rounded-lg border border-accent-orange/20">
                    #{tag}
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={project.tags.join(', ')}
                onChange={(e) => updateProject({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="Edit tags (comma separated)"
                className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-white placeholder-surface-400 text-xs mt-3"
              />
            </div>
          )}

          {/* Manual title/desc if no AI generated yet */}
          {!project.metadataOptions && (
            <div className="glass-card rounded-xl p-5 border border-dashed border-surface-500 text-center text-surface-400">
              <Wand2 size={24} className="mx-auto mb-2 text-surface-500" />
              <p className="text-sm">Click the button above to generate 3 viral titles, 3 SEO descriptions, and tags using AI</p>
              <p className="text-xs mt-1 text-surface-500">Or fill them manually below</p>
              <div className="grid grid-cols-1 gap-3 mt-4 text-left">
                <input type="text" value={project.title} onChange={(e) => updateProject({ title: e.target.value })} placeholder="Video title" className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-white placeholder-surface-400 text-sm" />
                <textarea value={project.description} onChange={(e) => updateProject({ description: e.target.value })} placeholder="Video description" className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-white placeholder-surface-400 text-sm resize-none h-16" />
                <input type="text" value={project.tags.join(', ')} onChange={(e) => updateProject({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="Tags (comma separated)" className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-white placeholder-surface-400 text-sm" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => setStep(1)} className="px-6 py-3 bg-surface-700 text-surface-200 hover:bg-surface-600 rounded-xl text-sm font-medium transition-all">
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!canContinue()}
          className="px-8 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm flex items-center gap-2"
        >
          {mode === 'mp3-first' ? 'Skip to Production' : 'Voice Setup'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
