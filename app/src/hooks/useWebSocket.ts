import { useState, useEffect, useRef, useCallback } from 'react';

interface AgentPulse {
    id: string;
    timestamp: string;
    agent: string;
    action: string;
    target: string;
    source: string;
    status: string;
    details?: string;
}

interface WSMessage {
    type: string;
    data: unknown;
}

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export function useWebSocket(projectId: string) {
    const [connected, setConnected] = useState(false);
    const [pulses, setPulses] = useState<AgentPulse[]>([]);
    const [healthUpdate, setHealthUpdate] = useState<unknown[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttempts = useRef(0);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const ws = new WebSocket(`${WS_BASE}/ws/${projectId}`);

            ws.onopen = () => {
                setConnected(true);
                reconnectAttempts.current = 0;
                console.log(`🔌 WebSocket connected for project ${projectId}`);
            };

            ws.onmessage = (event) => {
                try {
                    const msg: WSMessage = JSON.parse(event.data);

                    if (msg.type === 'agent_pulse') {
                        const pulse = msg.data as AgentPulse;
                        setPulses((prev) => [pulse, ...prev].slice(0, 100));
                    } else if (msg.type === 'health_update') {
                        setHealthUpdate(msg.data as unknown[]);
                    } else if (msg.type === 'connected') {
                        console.log('WebSocket: server confirmed connection');
                    }
                } catch {
                    // Ignore parse errors
                }
            };

            ws.onclose = () => {
                setConnected(false);
                // Reconnect with exponential backoff
                const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
                reconnectAttempts.current += 1;
                reconnectTimeoutRef.current = setTimeout(connect, delay);
            };

            ws.onerror = () => {
                ws.close();
            };

            wsRef.current = ws;
        } catch {
            // WebSocket constructor failed, retry
            const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
            reconnectAttempts.current += 1;
            reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
    }, [projectId]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    const sendMessage = useCallback((msg: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        }
    }, []);

    const triggerRun = useCallback((description = '', sources = ['slack', 'figma']) => {
        sendMessage({ type: 'trigger_run', description, sources });
    }, [sendMessage]);

    const clearPulses = useCallback(() => {
        setPulses([]);
    }, []);

    return {
        connected,
        pulses,
        healthUpdate,
        sendMessage,
        triggerRun,
        clearPulses,
    };
}
