import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { listRecentRuns, getWorkflowRunStatus } from '../utils/github';
import { History as HistoryIcon, ExternalLink, Play, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';

export default function History() {
  const { ghToken, ghOwner, ghRepo, showToast, updateProject, setStep } = useStore();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!ghToken || !ghOwner || !ghRepo) return;
    setLoading(true);
    try {
      const recent = await listRecentRuns(ghToken, ghOwner, ghRepo, 15);
      setRuns(recent);
    } catch (e: any) {
      showToast(e.message || 'Failed to fetch history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [ghToken, ghOwner, ghRepo]);

  if (!ghToken) {
    return (
      <div className="text-center py-20 bg-surface-800/50 rounded-2xl border border-surface-700">
        <HistoryIcon size={48} className="mx-auto text-surface-600 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No History Available</h3>
        <p className="text-surface-400 max-w-sm mx-auto">Configure your GitHub settings in the Produce tab to see your persistent video history.</p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Video History</h1>
          <p className="text-surface-200 text-lg">Manage and view your previously generated shorts</p>
        </div>
        <button 
          onClick={fetchHistory}
          disabled={loading}
          className="p-2 bg-surface-800 text-surface-300 hover:text-white rounded-lg border border-surface-700 transition-all"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid gap-4">
        {runs.length === 0 && !loading && (
          <div className="text-center py-12 bg-surface-800/30 rounded-xl border border-dashed border-surface-700 text-surface-400">
            No recent workflow runs found.
          </div>
        )}
        
        {runs.map((run) => (
          <div key={run.id} className="glass-card p-4 rounded-xl border border-surface-700 hover:border-surface-500 transition-all group">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                run.conclusion === 'success' ? 'bg-accent-green/10 text-accent-green' :
                run.conclusion === 'failure' ? 'bg-accent-red/10 text-accent-red' :
                'bg-accent-orange/10 text-accent-orange'
              }`}>
                {run.status === 'completed' ? (
                  run.conclusion === 'success' ? <CheckCircle2 size={24} /> : <XCircle size={24} />
                ) : <Loader2 size={24} className="animate-spin" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-bold truncate">Project Run #{run.id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                    run.status === 'completed' ? 'bg-surface-700 text-surface-300' : 'bg-accent-orange/20 text-accent-orange'
                  }`}>
                    {run.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-surface-400">
                  <span className="flex items-center gap-1"><Clock size={12} /> {new Date(run.created_at).toLocaleString()}</span>
                  {run.conclusion && <span className="flex items-center gap-1">• {run.conclusion}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a 
                  href={run.html_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2.5 bg-surface-800 text-surface-300 hover:text-white rounded-lg border border-surface-700 transition-all hover:bg-surface-700"
                  title="View GitHub Run"
                >
                  <ExternalLink size={18} />
                </a>
                {run.conclusion === 'success' && (
                  <button 
                    onClick={() => {
                      updateProject({ workflowRunId: run.id, workflowRunUrl: run.html_url, status: 'completed' });
                      setStep(4);
                      showToast('Project loaded for preview!', 'success');
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-lg transition-all"
                  >
                    <Play size={16} fill="white" />
                    Preview
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
