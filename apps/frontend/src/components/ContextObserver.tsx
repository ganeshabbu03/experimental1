import { useEffect, useRef } from 'react';
import { useFileStore } from '@/stores/useFileStore';
import { useAIStore } from '@/stores/useAIStore';
import { aiService } from '@/services/aiService';

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

import { useState } from 'react';

export default function ContextObserver() {
    const { activeFileId, files } = useFileStore();
    const { addMessage } = useAIStore();

    // Track last analyzed content to avoid loops
    const lastAnalyzed = useRef<Record<string, string>>({});

    const getCurrentFile = () => {
        const findFile = (nodes: any[]): any => {
            for (const node of nodes) {
                if (node.id === activeFileId) return node;
                if (node.children) {
                    const found = findFile(node.children);
                    if (found) return found;
                }
            }
            return null;
        };
        return findFile(files);
    };

    const currentFile = getCurrentFile();
    const debouncedContent = useDebounce(currentFile?.content, 5000); // 5 seconds idle

    useEffect(() => {
        if (!currentFile || !currentFile.content) return;
        if (!debouncedContent) return;

        // Skip if already analyzed this exact content
        if (lastAnalyzed.current[currentFile.id] === debouncedContent) return;

        // Only analyze meaningful files: must be > 200 chars AND contain known signals
        // Keeps background AI calls minimal to stay within API rate limits
        const MIN_CHARS = 200;
        const hasSignal = debouncedContent.includes('TODO') || debouncedContent.includes('FIXME');
        const shouldAnalyze = hasSignal && debouncedContent.length > MIN_CHARS;

        if (shouldAnalyze) {
            console.log("ContextObserver: Proactively analyzing...", currentFile.name);
            lastAnalyzed.current[currentFile.id] = debouncedContent;

            // Trigger silent analysis
            // We use a special mode "livefix" or "enhance"
            // For now, let's just log it or maybe add a "suggestion" to the chat if conversation exists

            // Trigger silent analysis
            // We use a special mode "livefix" or "enhance"
            // For now, let's just log it or maybe add a "suggestion" to the chat if conversation exists

            // We don't want to spam the chat. Maybe just a toast? 
            // For the "Human-Level" feel, a subtle message in chat "I noticed..." is good.

            checkCode(currentFile.name, debouncedContent);
        }
    }, [debouncedContent, currentFile?.id]);

    const checkCode = async (filename: string, code: string) => {
        try {
            // Use 'livefix' mode to check for critical errors silently
            const result = await aiService.analyze('livefix', code, `Background analysis of ${filename}`);

            // Heuristic for AI response: If it found a fix and returns code
            if (result.includes('```') && result.length < code.length + 200) {
                addMessage({
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: `💡 **Proactive Tip:** I noticed potential improvements in \`${filename}\`.\n\n${result}`,
                    timestamp: Date.now()
                });
            }
        } catch (e) {
            console.error("Proactive analysis failed", e);
        }
    };

    return null; // Headless component
}
