import { create } from 'zustand';
import type { AIMode } from '@/config/aiModes';

export interface AIResponse {
    mode: AIMode;
    response: string;
    timestamp: number;
    codeAnalyzed: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: number;
}

interface AIStore {
    // State
    selectedMode: AIMode;
    isLoading: boolean;
    error: string | null;
    response: AIResponse | null;
    history: AIResponse[];

    // Chat State
    isChatOpen: boolean;
    messages: ChatMessage[];
    triggerMessage: string | null; // Added: Message to be auto-processed

    // Actions
    setMode: (mode: AIMode) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setResponse: (response: AIResponse) => void;
    addToHistory: (response: AIResponse) => void;
    clearResponse: () => void;

    // Chat Actions
    toggleChat: () => void;
    setChatOpen: (isOpen: boolean) => void;
    addMessage: (message: ChatMessage) => void;
    updateLastMessage: (text: string) => void;
    clearMessages: () => void;
    setTriggerMessage: (message: string | null) => void; // Added action
}

export const useAIStore = create<AIStore>((set) => ({
    selectedMode: 'debug',
    isLoading: false,
    error: null,
    response: null,
    history: [],

    // Chat Initial State
    isChatOpen: false,
    triggerMessage: null,
    messages: [
        {
            id: 'welcome',
            role: 'assistant',
            text: 'Hello! I am your AI Assistant. I can help you understand your projects. Try asking "Explain deexen-frontend".',
            timestamp: Date.now()
        }
    ],

    setMode: (mode) =>
        set({
            selectedMode: mode,
            response: null,
            error: null,
        }),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error, isLoading: false }),

    setResponse: (response) =>
        set({ response, isLoading: false, error: null }),

    addToHistory: (response) =>
        set((state) => ({
            history: [response, ...state.history].slice(0, 20),
        })),

    clearResponse: () => set({ response: null, error: null }),

    // Chat Implementation
    toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
    setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    updateLastMessage: (text) => set((state) => {
        const newMessages = [...state.messages];
        if (newMessages.length > 0) {
            newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                text
            };
        }
        return { messages: newMessages };
    }),
    clearMessages: () => set({ messages: [] }),
    setTriggerMessage: (triggerMessage) => set({ triggerMessage }),
}));
