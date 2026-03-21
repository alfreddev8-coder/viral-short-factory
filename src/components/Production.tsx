import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store';
import type { ProductionStep } from '../types';
import { triggerWorkflow, getWorkflowRunStatus, listRecentRuns, downloadArtifact } from '../utils/github';
import {
  ArrowLeft, Play, Download, CheckCircle2, XCircle, Loader2,
  FileJson, Copy, RotateCcw, Clock, Clapperboard, Scissors,
  Github, ExternalLink, Video, Tag, FileText, Zap, Settings, AlertCircle
} from 'lucide-react';

const PIPELINE_STEPS: Omit<ProductionStep, 'status' | 'progress' | 'detail'>[] = [
  { id: 'validate', label: 'Validating project data' },
  { id: 'keywords', label: 'Extracting clip search keywords' },
  { id: 'scrape', label: 'Searching TikTok for matching clips' },
  { id: 'download', label: 'Downloading video clips (yt-dlp)' },
  { id: 'voice', label: 'Processing voiceover (Edge TTS / MP3)' },
  { id: 'assemble', label: 'Assembling timeline (MoviePy)' },
  { id: 'render', label: 'Rendering 1080×1920 MP4 (FFmpeg)' },
  { id: 'upload', label: 'Uploading final video & updating DB' },
];

type Tab = 'pipeline' | 'results' | 'capcut' | 'export';

export default function Production() {
  const {
    project, updateProject, setStep, showToast,
    productionSteps, setProductionSteps, updateProductionStep,
    addToHistory,
    ghToken, setGhToken, ghOwner, setGhOwner, ghRepo, setGhRepo,
  } = useStore();

  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('pipeline');
  // const [showGhSetup, setShowGhSetup] = useState(false); // Removed
  const [ghTriggered, setGhTriggered] = useState(false);
  const [ghRunUrl, setGhRunUrl] = useState(project.workflowRunUrl || '');
  const [ghRunStatus, setGhRunStatus] = useState<string>('');
  const [isDownloadingArtifact, setIsDownloadingArtifact] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDownloadVideo = async () => {
    if (!ghToken || !ghOwner || !ghRepo || !project.workflowRunId) return;
    setIsDownloadingArtifact(true);
    try {
      await downloadArtifact(ghToken, ghOwner, ghRepo, project.workflowRunId as number);
      showToast('Downloaded video artifact!', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to download video', 'error');
    } finally {
      setIsDownloadingArtifact(false);
    }
  };

  const initPipeline = useCallback(() => {
    setProductionSteps(
      PIPELINE_STEPS.map((s) => ({ ...s, status: 'pending' as const, progress: 0, detail: '' }))
    );
  }, [setProductionSteps]);

  useEffect(() => {
    initPipeline();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [initPipeline]);

  // Simulate the production pipeline locally (visual demo)
  const simulateProduction = async () => {
    setIsRunning(true);
    setIsComplete(false);
    initPipeline();

    const details = [
      'Checking script, segments, and voice config...',
      `Found ${project.segments.reduce((a, s) => a + s.keywords.length, 0)} keywords across ${project.segments.length} segments`,
      `Searching: ${project.segments.map(s => s.clipQuery).filter(Boolean).slice(0, 3).join(', ')}...`,
      `Downloaded ${project.segments.length} clips matching timestamps`,
      project.voiceMode === 'upload' || project.voiceMode === 'mp3-first'
        ? 'Using uploaded MP3 narration'
        : `Generating voice: Edge TTS (${project.voiceStyle})`,
      'Syncing clips to narration timeline...',
      'Encoding 1080×1920 @ 30fps — YouTube Shorts ready',
      'Video uploaded! Status updated in Turso DB.',
    ];

    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      const stepId = PIPELINE_STEPS[i].id;
      updateProductionStep(stepId, { status: 'running', progress: 0, detail: details[i] });
      for (let p = 0; p <= 100; p += Math.random() * 15 + 5) {
        await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
        updateProductionStep(stepId, { progress: Math.min(p, 100) });
      }
      updateProductionStep(stepId, { status: 'completed', progress: 100 });
    }

    updateProject({ status: 'completed' });
    addToHistory({ ...project, status: 'completed' });
    setIsComplete(true);
    setIsRunning(false);
    setActiveTab('results');
    showToast('🎬 Production complete! Check the Results tab.', 'success');
  };

  // Trigger real GitHub Actions workflow
  const triggerGitHubWorkflow = async () => {
    if (!ghToken || !ghOwner || !ghRepo) {
      showToast('Please configure GH_TOKEN, GH_OWNER, GH_REPO in .env/Vercel', 'error');
      return;
    }

    setGhTriggered(true);
    try {
      let audioUrl = '';
      if ((project.voiceMode === 'upload' || project.voiceMode === 'mp3-first') && project.mp3File) {
        showToast('Uploading custom audio for GitHub Actions...', 'info');
        try {
          const cleanRepo = ghRepo.split('/').pop()?.replace(/\.git$/, '') || ghRepo;
          const reader = new FileReader();
          reader.readAsDataURL(project.mp3File);
          await new Promise((res) => { reader.onload = res });
          const base64data = (reader.result as string).split(',')[1];

          const filename = `uploads/audio-${Date.now()}.mp3`;
          const putRes = await fetch(`https://api.github.com/repos/${ghOwner}/${cleanRepo}/contents/${filename}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Upload custom audio for workflow`,
              content: base64data,
            })
          });

          if (!putRes.ok) throw new Error('GitHub upload failed');
          audioUrl = filename;
        } catch (e) {
          console.error('Audio upload error:', e);
          showToast('Failed to upload audio to temp server. Video might have no sound.', 'error');
        }
      }

      await triggerWorkflow({
        token: ghToken,
        owner: ghOwner,
        repo: ghRepo,
        workflowFile: 'video-automation.yml',
        inputs: {
          project_id: project.id,
          niche: project.niche,
          script: project.rawScript || project.segments.map(s => s.text).join(' '),
          segments_json: JSON.stringify(project.segments.map(s => ({
            start: s.startTime, end: s.endTime, text: s.text,
            keywords: s.keywords, clipQuery: s.clipQuery,
          }))),
          voice_mode: project.voiceMode,
          voice_style: project.voiceStyle,
          audio_url: audioUrl,
          title: project.title,
          description: project.description,
          tags: project.tags.join(','),
        },
      });
      showToast('✅ GitHub Actions workflow triggered!', 'success');

      // Start polling for the run
      setTimeout(async () => {
        try {
          const runs = await listRecentRuns(ghToken, ghOwner, ghRepo, 1);
          if (runs.length > 0) {
            const run = runs[0];
            setGhRunUrl(run.html_url);
            setGhRunStatus(run.status);
            updateProject({ workflowRunId: run.id, workflowRunUrl: run.html_url });

            // Poll every 10 seconds
            pollingRef.current = setInterval(async () => {
              try {
                const status = await getWorkflowRunStatus(ghToken, ghOwner, ghRepo, run.id);
                if (status) {
                  setGhRunStatus(status.status);
                  if (status.status === 'completed') {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    if (status.conclusion === 'success') {
                      showToast('🎬 GitHub Actions workflow completed!', 'success');
                      updateProject({ status: 'completed' });
                      setIsComplete(true);
                      setActiveTab('results');
                    } else {
                      showToast(`Workflow finished: ${status.conclusion}`, 'error');
                      updateProject({ status: 'failed' });
                    }
                  }
                }
              } catch { /* ignore polling errors */ }
            }, 10000);
          }
        } catch { /* ignore */ }
      }, 5000); // Wait 5s for the run to register
    } catch (e: any) {
      showToast(e.message || 'Failed to trigger workflow', 'error');
      setGhTriggered(false);
    }
  };

  const getProjectExport = () => {
    return JSON.stringify({
      project: {
        id: project.id,
        niche: project.niche,
        title: project.title,
        description: project.description,
        tags: project.tags,
        scriptMode: project.scriptMode,
        voiceMode: project.voiceMode,
        voiceStyle: project.voiceStyle,
        createdAt: project.createdAt,
      },
      script: project.rawScript,
      segments: project.segments.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        text: s.text,
        keywords: s.keywords,
        clipQuery: s.clipQuery,
      })),
      metadata: {
        selectedTitle: project.title,
        selectedDescription: project.description,
        allTitles: project.metadataOptions?.titles || [],
        allDescriptions: project.metadataOptions?.descriptions || [],
        tags: project.tags,
      },
      automation: {
        pipeline: ['extract_keywords', 'search_tiktok', 'download_clips', 'generate_voice', 'assemble_video', 'render_final'],
        voiceConfig: {
          mode: project.voiceMode,
          style: project.voiceStyle,
          edgeTTSVoice: project.voiceStyle === 'friendly' ? 'en-US-GuyNeural'
            : project.voiceStyle === 'bold' ? 'en-US-DavisNeural'
            : project.voiceStyle === 'energetic' ? 'en-US-JasonNeural'
            : project.voiceStyle === 'dramatic' ? 'en-GB-RyanNeural'
            : project.voiceStyle === 'female-warm' ? 'en-US-JennyNeural'
            : 'en-US-AriaNeural',
        },
        output: { resolution: '1080x1920', fps: 30, format: 'mp4' },
      },
    }, null, 2);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  const downloadJSON = (data: string, filename: string) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'success');
  };

  return (
    <div className="animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setStep(project.scriptMode === 'mp3-first' ? 2 : 3)} className="text-surface-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">Production Pipeline</h1>
          <p className="text-surface-200">{project.nicheEmoji} {project.niche} — {project.title || 'Untitled Video'}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="glass-card rounded-xl p-4 mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <div className="text-xs text-surface-400 mb-1">Segments</div>
          <div className="text-xl font-bold text-white">{project.segments.length}</div>
        </div>
        <div>
          <div className="text-xs text-surface-400 mb-1">Keywords</div>
          <div className="text-xl font-bold text-white">{project.segments.reduce((a, s) => a + s.keywords.length, 0)}</div>
        </div>
        <div>
          <div className="text-xs text-surface-400 mb-1">Voice</div>
          <div className="text-sm font-semibold text-white capitalize">{project.voiceMode === 'mp3-first' || project.voiceMode === 'upload' ? 'Uploaded MP3' : project.voiceStyle}</div>
        </div>
        <div>
          <div className="text-xs text-surface-400 mb-1">Output</div>
          <div className="text-sm font-semibold text-accent-cyan">1080×1920</div>
        </div>
        <div>
          <div className="text-xs text-surface-400 mb-1">Status</div>
          <div className={`text-sm font-semibold ${isComplete ? 'text-accent-green' : isRunning || ghTriggered ? 'text-accent-orange' : 'text-surface-200'}`}>
            {isComplete ? '✅ Done' : isRunning ? '⏳ Running' : ghTriggered ? '🔄 GH Actions' : '⏸️ Ready'}
          </div>
        </div>
      </div>

      {/* GitHub Settings */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white w-full mb-3">
          <Settings size={16} className="text-surface-400" />
          GitHub Actions Settings
          {ghToken && ghOwner && ghRepo ? (
            <span className="text-xs text-accent-green font-normal ml-2 flex items-center gap-1">
              <CheckCircle2 size={12} /> Configured via .env
            </span>
          ) : (
            <span className="text-xs text-accent-orange font-normal ml-2 flex items-center gap-1">
              <AlertCircle size={12} /> Missing details
            </span>
          )}
        </div>
        
        {(!ghToken || !ghOwner || !ghRepo) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-surface-400 uppercase tracking-wider mb-1 block">GitHub Token</label>
              <input 
                type="password" 
                placeholder="ghp_..." 
                value={ghToken} 
                onChange={(e) => setGhToken(e.target.value)}
                className="w-full bg-surface-800 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500" 
              />
            </div>
            <div>
              <label className="text-[10px] text-surface-400 uppercase tracking-wider mb-1 block">Repo Owner</label>
              <input 
                type="text" 
                placeholder="Username or Org" 
                value={ghOwner} 
                onChange={(e) => setGhOwner(e.target.value)}
                className="w-full bg-surface-800 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500" 
              />
            </div>
            <div>
              <label className="text-[10px] text-surface-400 uppercase tracking-wider mb-1 block">Repository Name</label>
              <input 
                type="text" 
                placeholder="repo-name" 
                value={ghRepo} 
                onChange={(e) => setGhRepo(e.target.value)}
                className="w-full bg-surface-800 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500" 
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 rounded-xl p-1 mb-6 overflow-x-auto">
        {([
          { key: 'pipeline' as Tab, label: '🔧 Pipeline' },
          { key: 'results' as Tab, label: '🎬 Results' },
          { key: 'capcut' as Tab, label: '✂️ CapCut' },
          { key: 'export' as Tab, label: '📦 Export' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'bg-brand-600 text-white' : 'text-surface-300 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== PIPELINE TAB ===== */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4 mb-6">
          {!isRunning && !isComplete && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={simulateProduction}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-brand-600 to-accent-purple hover:opacity-90 text-white font-bold rounded-xl transition-all text-base"
              >
                <Play size={20} fill="white" />
                Simulate Pipeline (Demo)
              </button>
              <button
                onClick={triggerGitHubWorkflow}
                disabled={ghTriggered}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-surface-800 border-2 border-surface-600 hover:border-brand-500 text-white font-bold rounded-xl transition-all text-base disabled:opacity-40"
              >
                <Github size={20} />
                {ghTriggered ? 'Workflow Triggered ✓' : 'Trigger GitHub Actions'}
              </button>
            </div>
          )}

          {/* GitHub Actions status */}
          {ghTriggered && ghRunUrl && (
            <div className="glass-card rounded-xl p-4 border border-accent-cyan/30">
              <div className="flex items-center gap-3">
                <Github size={20} className="text-white" />
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">GitHub Actions Workflow</div>
                  <div className="text-xs text-surface-400">
                    Status: <span className={`font-semibold ${ghRunStatus === 'completed' ? 'text-accent-green' : 'text-accent-orange'}`}>{ghRunStatus || 'queued'}</span>
                  </div>
                </div>
                <a href={ghRunUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-surface-700 text-accent-cyan hover:bg-surface-600 rounded-lg text-xs transition-all">
                  <ExternalLink size={12} /> View Run
                </a>
              </div>
            </div>
          )}

          {isRunning && (
            <div className="text-center text-surface-300 text-sm flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Production in progress...
            </div>
          )}

          <div className="space-y-2">
            {productionSteps.map((step, i) => (
              <div key={step.id} className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
                    background: step.status === 'completed' ? 'rgba(18,183,106,0.15)' :
                      step.status === 'running' ? 'rgba(97,114,243,0.15)' :
                      step.status === 'failed' ? 'rgba(240,68,56,0.15)' : 'rgba(53,56,73,0.5)'
                  }}>
                    {step.status === 'completed' && <CheckCircle2 size={16} className="text-accent-green" />}
                    {step.status === 'running' && <Loader2 size={16} className="text-brand-400 animate-spin" />}
                    {step.status === 'failed' && <XCircle size={16} className="text-accent-red" />}
                    {step.status === 'pending' && <span className="text-xs text-surface-400 font-mono">{i + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{step.label}</div>
                    {step.detail && <div className="text-xs text-surface-400 mt-0.5">{step.detail}</div>}
                  </div>
                  {step.status === 'completed' && <span className="text-xs text-accent-green font-medium">Done</span>}
                </div>
                {(step.status === 'running' || step.status === 'completed') && (
                  <div className="w-full bg-surface-700 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{
                      width: `${step.progress}%`,
                      background: step.status === 'completed' ? 'var(--color-accent-green)' : 'linear-gradient(90deg, var(--color-brand-500), var(--color-accent-purple))',
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {isComplete && (
            <div className="text-center py-4 animate-slide-up">
              <button onClick={() => { setIsComplete(false); setGhTriggered(false); initPipeline(); }} className="flex items-center gap-2 mx-auto px-4 py-2 bg-surface-700 text-surface-200 hover:bg-surface-600 rounded-lg text-sm transition-all">
                <RotateCcw size={14} /> Reset Pipeline
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== RESULTS TAB — Final video + copyable metadata ===== */}
      {activeTab === 'results' && (
        <div className="space-y-4 mb-6">
          {/* Final Result Card */}
          <div className="glass-card rounded-xl p-6 border border-accent-green/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent-green/15 flex items-center justify-center">
                <Video size={24} className="text-accent-green" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">🎬 Final Result</h3>
                <p className="text-xs text-surface-400">Your video is ready for CapCut finishing</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-surface-800 rounded-lg p-3">
                <div className="text-[10px] text-surface-400 uppercase tracking-wider">Format</div>
                <div className="text-sm font-bold text-white mt-0.5">MP4</div>
              </div>
              <div className="bg-surface-800 rounded-lg p-3">
                <div className="text-[10px] text-surface-400 uppercase tracking-wider">Resolution</div>
                <div className="text-sm font-bold text-accent-cyan mt-0.5">1080×1920</div>
              </div>
              <div className="bg-surface-800 rounded-lg p-3">
                <div className="text-[10px] text-surface-400 uppercase tracking-wider">Duration</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {project.segments.length > 0 ? project.segments[project.segments.length - 1].endTime : '~60s'}
                </div>
              </div>
              <div className="bg-surface-800 rounded-lg p-3">
                <div className="text-[10px] text-surface-400 uppercase tracking-wider">Ready For</div>
                <div className="text-sm font-bold text-accent-orange mt-0.5">YouTube Shorts</div>
              </div>
            </div>

            <div className="bg-surface-800 rounded-lg p-4 text-center">
              <Clapperboard size={32} className="text-surface-500 mx-auto mb-2" />
              <p className="text-sm text-surface-300 mb-3">
                {isComplete || project.status === 'completed'
                  ? 'Video pipeline completed. Download your generated video directly to your device.'
                  : 'Run the pipeline first to generate your video. Use "Simulate Pipeline" for a demo or trigger GitHub Actions for real production.'}
              </p>
              {(isComplete || project.status === 'completed') && project.workflowRunId ? (
                <button
                  onClick={handleDownloadVideo}
                  disabled={isDownloadingArtifact}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-purple to-brand-500 text-white font-bold rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {isDownloadingArtifact ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  {isDownloadingArtifact ? 'Downloading...' : 'Download Final Video'}
                </button>
              ) : (isComplete || project.status === 'completed') ? (
                <button
                  onClick={() => downloadJSON(getProjectExport(), `viral-shorts-${project.id}.json`)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-green to-accent-cyan text-white font-bold rounded-xl transition-all hover:opacity-90"
                >
                  <Download size={18} />
                  Download Full Project
                </button>
              ) : null}
            </div>
          </div>

          {/* Copyable Metadata Section */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-white font-bold text-base mb-4 flex items-center gap-2">
              📋 Copy Your Metadata
              <span className="text-xs text-surface-400 font-normal">— click any field to copy</span>
            </h3>

            {/* Selected Title */}
            <div className="mb-4">
              <div className="text-xs text-surface-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Zap size={10} /> Selected Title
              </div>
              <button
                onClick={() => copyToClipboard(project.title)}
                className="w-full text-left p-3 bg-surface-800 hover:bg-surface-700 rounded-xl transition-all group border border-surface-600"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium text-sm">{project.title || 'No title set'}</span>
                  <Copy size={14} className="text-surface-400 group-hover:text-accent-green transition-colors" />
                </div>
              </button>
            </div>

            {/* Selected Description */}
            <div className="mb-4">
              <div className="text-xs text-surface-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <FileText size={10} /> Selected Description
              </div>
              <button
                onClick={() => copyToClipboard(project.description)}
                className="w-full text-left p-3 bg-surface-800 hover:bg-surface-700 rounded-xl transition-all group border border-surface-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-white text-sm leading-relaxed">{project.description || 'No description set'}</span>
                  <Copy size={14} className="text-surface-400 group-hover:text-accent-green transition-colors shrink-0 mt-0.5" />
                </div>
              </button>
            </div>

            {/* Tags */}
            <div className="mb-4">
              <div className="text-xs text-surface-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1"><Tag size={10} /> Tags</span>
                <button onClick={() => copyToClipboard(project.tags.map(t => `#${t}`).join(' '))} className="text-accent-cyan hover:text-accent-cyan/80 text-[10px] flex items-center gap-1">
                  <Copy size={9} /> Copy All
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 p-3 bg-surface-800 rounded-xl border border-surface-600">
                {project.tags.length > 0 ? project.tags.map((tag, i) => (
                  <button
                    key={i}
                    onClick={() => copyToClipboard(`#${tag}`)}
                    className="text-xs bg-accent-orange/10 text-accent-orange px-2 py-1 rounded-lg border border-accent-orange/20 hover:bg-accent-orange/20 transition-all"
                  >
                    #{tag}
                  </button>
                )) : <span className="text-surface-400 text-xs">No tags set</span>}
              </div>
            </div>

            {/* All Title Options */}
            {project.metadataOptions && project.metadataOptions.titles.length > 1 && (
              <div className="mb-4">
                <div className="text-xs text-surface-400 uppercase tracking-wider mb-1.5">All Title Options</div>
                <div className="space-y-1">
                  {project.metadataOptions.titles.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => copyToClipboard(t)}
                      className="w-full text-left p-2 bg-surface-800 hover:bg-surface-700 rounded-lg transition-all flex items-center justify-between gap-2 group border border-surface-700"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${i === project.selectedTitleIndex ? 'bg-accent-green/20 text-accent-green' : 'bg-surface-700 text-surface-400'}`}>
                          {i === project.selectedTitleIndex ? '✓' : i + 1}
                        </span>
                        <span className="text-xs text-white truncate">{t}</span>
                      </div>
                      <Copy size={11} className="text-surface-500 group-hover:text-white transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* All Description Options */}
            {project.metadataOptions && project.metadataOptions.descriptions.length > 1 && (
              <div>
                <div className="text-xs text-surface-400 uppercase tracking-wider mb-1.5">All Description Options</div>
                <div className="space-y-1">
                  {project.metadataOptions.descriptions.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => copyToClipboard(d)}
                      className="w-full text-left p-2 bg-surface-800 hover:bg-surface-700 rounded-lg transition-all flex items-start justify-between gap-2 group border border-surface-700"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${i === project.selectedDescriptionIndex ? 'bg-accent-green/20 text-accent-green' : 'bg-surface-700 text-surface-400'}`}>
                          {i === project.selectedDescriptionIndex ? '✓' : i + 1}
                        </span>
                        <span className="text-xs text-white leading-relaxed">{d}</span>
                      </div>
                      <Copy size={11} className="text-surface-500 group-hover:text-white transition-colors shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Script with Timestamps */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                <Clock size={14} className="text-brand-400" />
                Script Timeline
              </h3>
              <button
                onClick={() => {
                  const text = project.segments.map(s =>
                    `[${s.startTime} → ${s.endTime}]\n${s.text}\nKeywords: ${s.keywords.join(', ')}\nClip: ${s.clipQuery}\n`
                  ).join('\n');
                  copyToClipboard(text);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-surface-700 text-surface-300 hover:text-white rounded-md text-xs transition-all"
              >
                <Copy size={10} /> Copy
              </button>
            </div>
            <div className="bg-surface-900 rounded-lg p-3 max-h-48 overflow-auto space-y-3">
              {project.segments.map((seg) => (
                <div key={seg.id} className="text-xs">
                  <div className="text-brand-400 font-mono font-semibold">[{seg.startTime} → {seg.endTime}]</div>
                  <div className="text-white mt-0.5">{seg.text}</div>
                  <div className="text-surface-400 mt-0.5">🔑 {seg.keywords.join(', ')} | 🎬 {seg.clipQuery}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== CAPCUT TAB ===== */}
      {activeTab === 'capcut' && (
        <div className="space-y-4 mb-6">
          <div className="glass-card rounded-xl p-5 border-l-4 border-accent-cyan">
            <h3 className="text-white font-bold text-lg flex items-center gap-2 mb-3">
              <Scissors size={20} className="text-accent-cyan" />
              CapCut Finishing Guide
            </h3>
            <div className="space-y-3 text-sm text-surface-200">
              {[
                ['Open CapCut → New project → ', '9:16 aspect ratio', ' (1080×1920)'],
                ['Import the generated ', 'video MP4', ' or the narration MP3'],
                ['Import all ', 'TikTok clips', ' into the media library'],
                ['Place clips on video track matching ', 'timestamps', ' from the timeline'],
                ['Use CapCut\'s ', 'Auto Captions', ' for subtitles'],
                ['Add ', 'transitions', ' (0.3s cross-dissolve), memes, SFX, and export!'],
              ].map(([before, bold, after], i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center shrink-0 text-xs text-white font-bold">{i + 1}</span>
                  <p>{before}<strong className="text-white">{bold}</strong>{after}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                <Clapperboard size={14} className="text-accent-orange" />
                Timeline Reference
              </h3>
            </div>
            <div className="space-y-2">
              {project.segments.map((seg, i) => (
                <div key={seg.id} className="flex items-start gap-3 p-3 bg-surface-900 rounded-lg">
                  <div className="w-16 shrink-0">
                    <div className="text-xs font-mono text-brand-400 font-semibold">{seg.startTime}</div>
                    <div className="text-[10px] font-mono text-surface-400">→ {seg.endTime}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white leading-relaxed">{seg.text}</div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <Clock size={10} className="text-surface-400" />
                      <span className="text-[10px] text-accent-cyan font-medium">Clip: {seg.clipQuery}</span>
                    </div>
                  </div>
                  <div className="text-xs text-surface-400 shrink-0">#{i + 1}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== EXPORT TAB ===== */}
      {activeTab === 'export' && (
        <div className="space-y-4 mb-6">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FileJson size={16} className="text-accent-cyan" />
                Full Project JSON
              </h3>
              <div className="flex gap-2">
                <button onClick={() => copyToClipboard(getProjectExport())} className="flex items-center gap-1 px-3 py-1.5 bg-surface-700 text-surface-200 hover:bg-surface-600 rounded-lg text-xs transition-all">
                  <Copy size={12} /> Copy
                </button>
                <button onClick={() => downloadJSON(getProjectExport(), `viral-shorts-${project.id}.json`)} className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white hover:bg-brand-500 rounded-lg text-xs transition-all">
                  <Download size={12} /> Download
                </button>
              </div>
            </div>
            <pre className="bg-surface-900 rounded-lg p-3 text-xs text-surface-200 font-mono overflow-auto max-h-72 leading-relaxed">
              {getProjectExport()}
            </pre>
          </div>

          {/* Tools Used */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              🔧 Tools Used in Automation
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { name: 'Python', desc: 'Main scripting', color: 'text-accent-cyan' },
                { name: 'MoviePy', desc: 'Video editing', color: 'text-accent-green' },
                { name: 'yt-dlp', desc: 'TikTok download', color: 'text-accent-orange' },
                { name: 'Edge TTS', desc: 'AI voice gen', color: 'text-accent-purple' },
                { name: 'FFmpeg', desc: 'Video processing', color: 'text-accent-red' },
                { name: 'Turso', desc: 'Database', color: 'text-accent-cyan' },
                { name: 'GitHub Actions', desc: 'Cloud execution', color: 'text-white' },
                { name: 'Groq AI', desc: 'Script & metadata', color: 'text-brand-400' },
              ].map((tool) => (
                <div key={tool.name} className="bg-surface-800 rounded-lg p-2.5">
                  <div className={`text-xs font-bold ${tool.color}`}>{tool.name}</div>
                  <div className="text-[10px] text-surface-400">{tool.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setStep(project.scriptMode === 'mp3-first' ? 2 : 3)} className="px-6 py-3 bg-surface-700 text-surface-200 hover:bg-surface-600 rounded-xl text-sm font-medium transition-all">
          ← Back
        </button>
        {(isComplete || project.status === 'completed') && (
          <button
            onClick={() => downloadJSON(getProjectExport(), `viral-shorts-${project.id}.json`)}
            className="px-6 py-3 bg-gradient-to-r from-accent-green to-accent-cyan text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition-all hover:opacity-90"
          >
            <Download size={16} /> Download Project
          </button>
        )}
      </div>
    </div>
  );
}
