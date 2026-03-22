// AI Analysis Service
// Handles all AI-powered code analysis features

import { apiClient } from './apiClient';
import type { AIMode } from '@/config/aiModes';

interface AnalyzeResponse {
    response: string;
    mode: string;
    model: string;
    tokens?: number;
    processingTime?: number;
}

class AIService {
    async analyze(mode: AIMode, code: string, context?: string): Promise<string> {
        const response = await apiClient.post<AnalyzeResponse>('/ai/analyze', {
            code,
            mode,
            model: 'gemini',
            context: context || 'Deexen IDE',
        });

        return response.response;
    }

    // Mode-specific shortcuts
    async debug(code: string): Promise<string> {
        return this.analyze('debug', code);
    }

    async enhance(code: string): Promise<string> {
        return this.analyze('enhance', code);
    }

    async expand(code: string): Promise<string> {
        return this.analyze('expand', code);
    }

    async teach(code: string): Promise<string> {
        return this.analyze('teaching', code);
    }

    async livefix(code: string): Promise<string> {
        return this.analyze('livefix', code);
    }
}

export const aiService = new AIService();
