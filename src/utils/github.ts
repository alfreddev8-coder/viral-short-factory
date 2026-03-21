import JSZip from 'jszip';

const GH_API = 'https://api.github.com';
const clean = (r: string) => r.split('/').pop()?.replace(/\.git$/, '') || r;

interface WorkflowDispatchInput {
  token: string;
  owner: string;
  repo: string;
  workflowFile: string;
  ref?: string;
  inputs: Record<string, string>;
}

interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

export async function triggerWorkflow(opts: WorkflowDispatchInput): Promise<{ success: boolean }> {
  const url = `${GH_API}/repos/${opts.owner}/${clean(opts.repo)}/actions/workflows/${opts.workflowFile}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: opts.ref || 'main',
      inputs: opts.inputs,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API error: ${res.status} – ${err}`);
  }
  return { success: true };
}

export async function getLatestWorkflowRun(
  token: string,
  owner: string,
  repo: string,
  workflowFile: string
): Promise<WorkflowRun | null> {
  const url = `${GH_API}/repos/${owner}/${clean(repo)}/actions/workflows/${workflowFile}/runs?per_page=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.workflow_runs && data.workflow_runs.length > 0) {
    const run = data.workflow_runs[0];
    return {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      created_at: run.created_at,
    };
  }
  return null;
}

export async function getWorkflowRunStatus(
  token: string,
  owner: string,
  repo: string,
  runId: number
): Promise<WorkflowRun | null> {
  const url = `${GH_API}/repos/${owner}/${clean(repo)}/actions/runs/${runId}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) return null;
  const run = await res.json();
  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url,
    created_at: run.created_at,
  };
}

export async function listRecentRuns(
  token: string,
  owner: string,
  repo: string,
  perPage = 5
): Promise<WorkflowRun[]> {
  const url = `${GH_API}/repos/${owner}/${clean(repo)}/actions/runs?per_page=${perPage}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.workflow_runs || []).map((run: any) => ({
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url,
    created_at: run.created_at,
  }));
}

export async function downloadArtifact(
  token: string,
  owner: string,
  repo: string,
  runId: number
): Promise<void> {
  const url = `${GH_API}/repos/${owner}/${clean(repo)}/actions/runs/${runId}/artifacts`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to list artifacts');
  const data = await res.json();
  if (!data.artifacts || data.artifacts.length === 0) throw new Error('No artifacts found for this run');

  // Grab the first artifact (usually the final-video zip)
  const artifactId = data.artifacts[0].id;
  const dlUrl = `${GH_API}/repos/${owner}/${clean(repo)}/actions/artifacts/${artifactId}/zip`;
  
  const dlRes = await fetch(dlUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!dlRes.ok) throw new Error('Failed to download artifact');
  
  const blob = await dlRes.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${data.artifacts[0].name}.zip`;
  a.click();
  a.click();
  window.URL.revokeObjectURL(objectUrl);
}

export async function getVideoBlobFromArtifact(
  token: string,
  owner: string,
  repo: string,
  runId: number
): Promise<{ blob: Blob; filename: string }> {
  const url = `${GH_API}/repos/${owner}/${clean(repo)}/actions/runs/${runId}/artifacts`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error('Failed to list artifacts');
  const data = await res.json();
  if (!data.artifacts || data.artifacts.length === 0) throw new Error('No artifacts found for this run');

  // Grab the first artifact
  const artifactId = data.artifacts[0].id;
  const dlUrl = `${GH_API}/repos/${owner}/${clean(repo)}/actions/artifacts/${artifactId}/zip`;
  
  const dlRes = await fetch(dlUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!dlRes.ok) throw new Error('Failed to download artifact');
  
  const zipBlob = await dlRes.blob();
  const zip = await JSZip.loadAsync(zipBlob);
  
  // Find the mp4 file inside the zip
  const mp4File = Object.values(zip.files).find(f => f.name.endsWith('.mp4'));
  if (!mp4File) throw new Error('No MP4 file found inside artifact');
  
  const videoBlob = await mp4File.async('blob');
  return { blob: videoBlob, filename: mp4File.name };
}
