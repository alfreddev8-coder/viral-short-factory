import { create } from 'zustand';
import type { Step, ProjectData, TimestampedSegment, ProductionStep } from './types';
import type { GroqModel } from './utils/groq';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface AppStore {
  // Navigation
  currentStep: Step;
  setStep: (s: Step) => void;

  // Project
  project: ProjectData;
  updateProject: (partial: Partial<ProjectData>) => void;
  resetProject: () => void;

  // Script segments
  addSegment: () => void;
  updateSegment: (id: string, partial: Partial<TimestampedSegment>) => void;
  removeSegment: (id: string) => void;
  setSegments: (segments: TimestampedSegment[]) => void;

  // Production
  productionSteps: ProductionStep[];
  setProductionSteps: (steps: ProductionStep[]) => void;
  updateProductionStep: (id: string, partial: Partial<ProductionStep>) => void;

  // API
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  pexelsApiKey: string;
  setPexelsApiKey: (key: string) => void;
  groqModel: string;
  setGroqModel: (model: string) => void;
  groqModels: GroqModel[];
  setGroqModels: (models: GroqModel[]) => void;
  modelsLoading: boolean;
  setModelsLoading: (v: boolean) => void;

  // GitHub
  ghToken: string;
  setGhToken: (v: string) => void;
  ghOwner: string;
  setGhOwner: (v: string) => void;
  ghRepo: string;
  setGhRepo: (v: string) => void;

  // UI
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // History
  history: ProjectData[];
  addToHistory: (project: ProjectData) => void;
}

const emptyProject: ProjectData = {
  id: uid(),
  niche: '',
  nicheEmoji: '',
  scriptMode: 'ai',
  rawScript: '',
  segments: [],
  voiceMode: 'ai-tts',
  voiceStyle: 'friendly',
  mp3File: null,
  mp3Url: '',
  metadataOptions: null,
  selectedTitleIndex: 0,
  selectedDescriptionIndex: 0,
  title: '',
  description: '',
  tags: [],
  status: 'draft',
  createdAt: new Date().toISOString(),
  workflowRunId: null,
  workflowRunUrl: '',
  videoUrl: '',
};

export const useStore = create<AppStore>((set, get) => ({
  currentStep: 1,
  setStep: (s) => set({ currentStep: s }),

  project: { ...emptyProject },
  updateProject: (partial) =>
    set((state) => ({ project: { ...state.project, ...partial } })),
  resetProject: () =>
    set({ project: { ...emptyProject, id: uid(), createdAt: new Date().toISOString() }, currentStep: 1 }),

  addSegment: () =>
    set((state) => {
      const segs = state.project.segments;
      const lastEnd = segs.length > 0 ? segs[segs.length - 1].endTime : '0:00';
      const newSeg: TimestampedSegment = {
        id: uid(),
        startTime: lastEnd,
        endTime: '',
        text: '',
        keywords: [],
        clipQuery: '',
      };
      return { project: { ...state.project, segments: [...segs, newSeg] } };
    }),
  updateSegment: (id, partial) =>
    set((state) => ({
      project: {
        ...state.project,
        segments: state.project.segments.map((s) =>
          s.id === id ? { ...s, ...partial } : s
        ),
      },
    })),
  removeSegment: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        segments: state.project.segments.filter((s) => s.id !== id),
      },
    })),
  setSegments: (segments) =>
    set((state) => ({ project: { ...state.project, segments } })),

  productionSteps: [],
  setProductionSteps: (steps) => set({ productionSteps: steps }),
  updateProductionStep: (id, partial) =>
    set((state) => ({
      productionSteps: state.productionSteps.map((s) =>
        s.id === id ? { ...s, ...partial } : s
      ),
    })),

  groqApiKey: import.meta.env.GROQ_API_KEY || '',
  setGroqApiKey: (key) => set({ groqApiKey: key }),
  pexelsApiKey: import.meta.env.PEXELS_API_KEY || '',
  setPexelsApiKey: (key) => set({ pexelsApiKey: key }),
  groqModel: '',
  setGroqModel: (model) => set({ groqModel: model }),
  groqModels: [],
  setGroqModels: (models) => set({ groqModels: models }),
  modelsLoading: false,
  setModelsLoading: (v) => set({ modelsLoading: v }),

  ghToken: import.meta.env.GH_TOKEN || '',
  setGhToken: (v) => set({ ghToken: v }),
  ghOwner: import.meta.env.GH_OWNER || '',
  setGhOwner: (v) => set({ ghOwner: v }),
  ghRepo: import.meta.env.GH_REPO || '',
  setGhRepo: (v) => set({ ghRepo: v }),

  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),
  toast: null,
  showToast: (message, type) => {
    set({ toast: { message, type } });
    setTimeout(() => get().clearToast(), 4000);
  },
  clearToast: () => set({ toast: null }),

  history: [],
  addToHistory: (project) =>
    set((state) => ({ history: [project, ...state.history].slice(0, 20) })),
}));
