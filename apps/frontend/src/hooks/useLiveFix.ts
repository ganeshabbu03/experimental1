import { useState, useEffect, useRef, useCallback } from 'react';

export interface LiveFixIssue {
    line: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
}

export function useLiveFix() {
    const [issues, setIssues] = useState<LiveFixIssue[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        // Ensure we strip any trailing /api if present in the base url env since our route is on the root app
        const cleanBaseUrl = baseUrl.replace(/\/api$/, '');
        const wsUrl = cleanBaseUrl.replace(/^http/, 'ws') + '/ai/ws/livefix';

        const connectWs = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) return;

            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('LiveFix WebSocket connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'status') {
                        setIsAnalyzing(true);
                    } else if (data.type === 'done') {
                        setIsAnalyzing(false);
                        try {
                            let text = data.full_text.trim();
                            if (text.startsWith('```json')) text = text.substring(7);
                            else if (text.startsWith('```')) text = text.substring(3);
                            if (text.endsWith('```')) text = text.substring(0, text.length - 3);

                            const parsedIssues = JSON.parse(text.trim());
                            if (Array.isArray(parsedIssues)) {
                                setIssues(parsedIssues);
                            } else {
                                setIssues([]);
                            }
                        } catch (e) {
                            console.error('Failed to parse AI response as JSON:', e);
                            setIssues([]);
                        }
                    } else if (data.type === 'error') {
                        setIsAnalyzing(false);
                        console.error('LiveFix Error:', data.message);
                    }
                } catch (e) {
                    console.error('WebSocket message parsing error:', e);
                }
            };

            ws.onclose = () => {
                console.log('LiveFix WebSocket disconnected, attempting to reconnect...');
                setTimeout(connectWs, 5000);
            };

            ws.onerror = (err) => {
                console.error('LiveFix WebSocket error:', err);
            };

            wsRef.current = ws;
        };

        connectWs();

        return () => {
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const MIN_CHARS_FOR_AI = 50; // Minimum characters before triggering AI to reduce rate limits

    const analyzeCode = useCallback((code: string, language: string, fileName?: string, cursorPos?: { lineNumber: number, column: number }, mode?: string) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Skip if content is too short — avoids unnecessary AI calls
        if (!code || code.trim().length < MIN_CHARS_FOR_AI) {
            return;
        }

        debounceTimerRef.current = setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                setIsAnalyzing(true);
                wsRef.current.send(JSON.stringify({
                    file_name: fileName || 'Unknown',
                    code,
                    language,
                    cursor_pos: cursorPos,
                    mode: mode || 'livefix',
                    model: 'groq'
                }));
            }
        }, 1500); // 1.5s debounce — stability over instant feedback
    }, []);

    return { issues, isAnalyzing, analyzeCode };
}
