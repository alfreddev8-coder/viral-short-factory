export interface TimestampedSegment {
  id: string;
  startTime: string;
  endTime: string;
  text: string;
  keywords: string[];
  clipQuery: string;
}

export interface MetadataOptions {
  titles: string[];
  descriptions: string[];
  tags: string[];
}

export interface ProjectData {
  id: string;
  niche: string;
  nicheEmoji: string;
  scriptMode: 'ai' | 'custom' | 'mp3-first';
  rawScript: string;
  segments: TimestampedSegment[];
  voiceMode: 'upload' | 'ai-tts' | 'mp3-first';
  voiceStyle: string;
  mp3File: File | null;
  mp3Url: string;
  // Metadata — user picks from AI-generated options
  metadataOptions: MetadataOptions | null;
  selectedTitleIndex: number;
  selectedDescriptionIndex: number;
  title: string;
  description: string;
  tags: string[];
  status: 'draft' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  // GitHub Actions
  workflowRunId: number | null;
  workflowRunUrl: string;
  videoUrl: string;
  // Advanced Settings
  scraperMode: 'auto' | 'pexels' | 'tiktok';
  captionColor: string;
  captionFont: string;
  captionSize: number;
  showMemes: boolean;
}

export type Step = 1 | 2 | 3 | 4 | 'history';

export interface NicheOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  sampleTopics: string[];
}

export interface ProductionStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  detail: string;
}
