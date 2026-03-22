import { create } from 'zustand';

export interface OutputLine {
    id: number;
    content: string;
    type: 'stdout' | 'stderr' | 'info' | 'success' | 'error';
}

interface OutputState {
    lines: OutputLine[];
    addLine: (content: string, type?: OutputLine['type']) => void;
    clear: () => void;
}

let outputCounter = 0;

export const useOutputStore = create<OutputState>((set) => ({
    lines: [],
    addLine: (content, type = 'stdout') => set((state) => ({
        lines: [...state.lines, { id: ++outputCounter, content, type }]
    })),
    clear: () => set({ lines: [] })
}));
