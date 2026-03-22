import { useEffect, useRef } from 'react';
import { useAnalysisStore } from '../stores/useAnalysisStore';

export function useCodeObserver(activeFileId: string | null, content: string) {
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Connect to WebSocket server using random client ID for now
        const clientId = Math.floor(Math.random() * 1000000);
        ws.current = new WebSocket(`ws://localhost:8000/ws/${clientId}`);

        ws.current.onopen = () => {
            console.log('Connected to Code Observer');
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const store = useAnalysisStore.getState();

                if (data.type === 'security_alert') {
                    store.setSecurityAlerts(data.issues);
                } else if (data.type === 'rule_violation') {
                    store.setRuleViolations(data.issues);
                } else if (data.type === 'mentor_feedback') {
                    store.setMentorHints(data.hints);
                } else if (data.type === 'progress_update') {
                    store.updateSkills(data.data.skill_delta);
                }
            } catch (e) {
                console.error("Failed to parse WebSocket message", e);
            }
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []); // Run once on mount

    // Debounce content changes — 1s delay + 50 char minimum to reduce rate limits
    const MIN_CHARS = 50;

    useEffect(() => {
        if (!activeFileId || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;

        // Skip very short content to avoid noisy AI calls
        if (!content || content.trim().length < MIN_CHARS) return;

        const timeoutId = setTimeout(() => {
            try {
                ws.current?.send(JSON.stringify({
                    type: 'file_change',
                    fileId: activeFileId,
                    content: content,
                    timestamp: new Date().toISOString()
                }));
            } catch (e) {
                console.error("Failed to send code update", e);
            }
        }, 1000); // 1s debounce — prioritizing stability over instant feedback

        return () => clearTimeout(timeoutId);
    }, [content, activeFileId]);
}
