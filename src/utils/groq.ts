import type { TimestampedSegment, MetadataOptions } from '../types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELS_URL = 'https://api.groq.com/openai/v1/models';

export interface GroqModel {
  id: string;
  object: string;
  owned_by: string;
  active: boolean;
}

export async function fetchGroqModels(apiKey: string): Promise<GroqModel[]> {
  const res = await fetch(MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch models: ${res.status} – ${err}`);
  }
  const data = await res.json();
  const models: GroqModel[] = (data.data || [])
    .filter((m: any) => m.active !== false)
    .sort((a: any, b: any) => a.id.localeCompare(b.id));
  return models;
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature = 0.8
) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${res.status} – ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content as string;
}

export async function generateScript(apiKey: string, model: string, niche: string): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: `You are a viral YouTube Shorts scriptwriter. Write engaging, fast-paced scripts under 60 seconds. Use hooks, surprising facts, and emotional language. The script should be suitable for a vertical short-form video.`,
    },
    {
      role: 'user',
      content: `Write a viral YouTube Shorts script about "${niche}". Make it 45-60 seconds long when read aloud. Include a strong hook in the first 3 seconds. Use short punchy sentences. Don't include any stage directions or camera notes — just the narration text.`,
    },
  ];
  return callGroq(apiKey, model, messages);
}

export async function generateTimestamps(
  apiKey: string,
  model: string,
  script: string,
  niche: string
): Promise<TimestampedSegment[]> {
  const messages = [
    {
      role: 'system',
      content: `You are a video editor assistant. Given a script, break it into timestamped segments for a 45-60 second video. Each segment should be 3-7 seconds. For each segment, extract 2-3 search keywords that would find matching B-roll clips on TikTok/stock footage sites related to the "${niche}" niche. Also create a short clip search query.

Return ONLY valid JSON array with this format:
[
  {
    "startTime": "0:00",
    "endTime": "0:05",
    "text": "segment text here",
    "keywords": ["keyword1", "keyword2"],
    "clipQuery": "short search query for finding matching video clip"
  }
]

No markdown, no explanation, just the JSON array.`,
    },
    {
      role: 'user',
      content: `Break this script into timestamped segments:\n\n${script}`,
    },
  ];
  const raw = await callGroq(apiKey, model, messages, 0.3);
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse timestamps from AI response');
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.map((seg: any) => ({
    id: Math.random().toString(36).slice(2, 10),
    startTime: seg.startTime || '0:00',
    endTime: seg.endTime || '0:05',
    text: seg.text || '',
    keywords: seg.keywords || [],
    clipQuery: seg.clipQuery || '',
  }));
}

export async function generateMetadata(
  apiKey: string,
  model: string,
  script: string,
  niche: string
): Promise<MetadataOptions> {
  const messages = [
    {
      role: 'system',
      content: `You are a YouTube Shorts SEO expert and viral content strategist. Given a video script and niche, generate multiple metadata options so the creator can pick the best one.

Generate EXACTLY:
- 3 different viral video titles (attention-grabbing, clickbait-style, with emojis, under 70 chars each). Make each one a different angle/hook style.
- 3 different SEO-optimized video descriptions (each 150-250 chars, different style — one curiosity-driven, one fact-based, one emotional). Include relevant hashtags in descriptions.
- 15-20 relevant tags for YouTube/TikTok SEO

Return ONLY valid JSON:
{
  "titles": ["title1", "title2", "title3"],
  "descriptions": ["desc1", "desc2", "desc3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"]
}

No markdown, no explanation, just the JSON object.`,
    },
    {
      role: 'user',
      content: `Niche: ${niche}\n\nScript:\n${script}`,
    },
  ];
  const raw = await callGroq(apiKey, model, messages, 0.7);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse metadata from AI response');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    titles: parsed.titles || [],
    descriptions: parsed.descriptions || [],
    tags: parsed.tags || [],
  };
}

export async function extractKeywordsFromSegments(
  apiKey: string,
  model: string,
  text: string,
  niche: string
): Promise<{ keywords: string[]; clipQuery: string }> {
  const messages = [
    {
      role: 'system',
      content: `Extract 2-3 visual keywords and a short clip search query from this text segment for finding matching B-roll clips in the "${niche}" niche. Return ONLY valid JSON: {"keywords": ["k1","k2"], "clipQuery": "query"}`,
    },
    {
      role: 'user',
      content: text,
    },
  ];
  const raw = await callGroq(apiKey, model, messages, 0.3);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { keywords: [], clipQuery: text.slice(0, 30) };
  return JSON.parse(jsonMatch[0]);
}

export async function bulkExtractKeywords(
  apiKey: string,
  model: string,
  segments: TimestampedSegment[],
  niche: string
): Promise<TimestampedSegment[]> {
  const segTexts = segments.map((s, i) => `Segment ${i + 1} [${s.startTime}-${s.endTime}]: ${s.text}`).join('\n');
  const messages = [
    {
      role: 'system',
      content: `You are a video editor assistant. Given multiple timestamped script segments for a "${niche}" video, extract 2-3 visual search keywords and a clip search query for EACH segment. These keywords should help find matching B-roll clips on TikTok or stock footage sites.

Return ONLY a valid JSON array with one entry per segment:
[
  { "keywords": ["keyword1", "keyword2"], "clipQuery": "search query" },
  { "keywords": ["keyword1", "keyword2"], "clipQuery": "search query" }
]

Return exactly ${segments.length} entries in the same order. No markdown, no explanation.`,
    },
    {
      role: 'user',
      content: segTexts,
    },
  ];
  const raw = await callGroq(apiKey, model, messages, 0.3);
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse keywords from AI response');
  const parsed = JSON.parse(jsonMatch[0]);
  return segments.map((seg, i) => ({
    ...seg,
    keywords: parsed[i]?.keywords || seg.keywords,
    clipQuery: parsed[i]?.clipQuery || seg.clipQuery,
  }));
}
