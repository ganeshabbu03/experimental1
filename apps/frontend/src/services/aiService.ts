// AI Analysis Service
// Handles all AI-powered code analysis features

import { apiClient } from './apiClient';
import type { AIMode } from '@/config/aiModes';

export interface AnalyzeResult {
    response: string;
    mode: string;
    model: string;
    tokens?: number;
    processingTime?: number;
}

export interface AnalyzeOptions {
    context?: string;
    model?: string;
    language?: string;
}

class AIService {
    async analyzeDetailed(mode: AIMode, code: string, options?: string | AnalyzeOptions): Promise<AnalyzeResult> {
        const normalizedOptions: AnalyzeOptions =
            typeof options === 'string' ? { context: options } : (options || {});

        return apiClient.post<AnalyzeResult>('/ai/analyze', {
            code,
            mode,
            model: normalizedOptions.model || 'gemini-free',
            context: normalizedOptions.context || 'Deexen IDE',
            language: normalizedOptions.language,
        });
    }

    async analyze(mode: AIMode, code: string, options?: string | AnalyzeOptions): Promise<string> {
        const response = await this.analyzeDetailed(mode, code, options);
        return response.response;
    }

    // Mode-specific shortcuts
    async debug(code: string, options?: AnalyzeOptions): Promise<string> {
        return this.analyze('debug', code, options);
    }

    async enhance(code: string, options?: AnalyzeOptions): Promise<string> {
        return this.analyze('enhance', code, options);
    }

    async expand(code: string, options?: AnalyzeOptions): Promise<string> {
        return this.analyze('expand', code, options);
    }

    async teach(code: string, options?: AnalyzeOptions): Promise<string> {
        return this.analyze('teaching', code, options);
    }

    async livefix(code: string, options?: AnalyzeOptions): Promise<string> {
        return this.analyze('livefix', code, options);
    }
}

export const aiService = new AIService();
