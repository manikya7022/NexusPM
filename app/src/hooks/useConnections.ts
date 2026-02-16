import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/apiClient';

export function useConnections(projectId: string) {
    const [connections, setConnections] = useState<api.Connection[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchConnections = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const data = await api.getConnections(projectId);
            setConnections(data);
        } catch {
            setConnections([]);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchConnections();
    }, [fetchConnections]);

    const add = useCallback(async (name: string, token: string, icon = 'key', color = '#00F0FF') => {
        try {
            const conn = await api.createConnection({
                project_id: projectId,
                name,
                token,
                icon,
                color,
            });
            setConnections((prev) => [...prev, conn]);
            return conn;
        } catch {
            const fallback: api.Connection = {
                id: Date.now().toString(),
                name,
                icon,
                color,
                status: 'disconnected',
                lastSync: 'never',
                tokenPreview: token.slice(0, 4) + '••••••••',
            };
            setConnections((prev) => [...prev, fallback]);
            return fallback;
        }
    }, [projectId]);

    const test = useCallback(async (connId: string) => {
        try {
            const result = await api.testConnection(projectId, connId);
            // Update local state
            setConnections((prev) =>
                prev.map((c) =>
                    c.id === connId ? { ...c, status: result.status, lastSync: 'just now' } : c
                )
            );
            return result;
        } catch {
            return { status: 'error', message: 'Test failed' };
        }
    }, [projectId]);

    const remove = useCallback(async (connId: string) => {
        try {
            await api.deleteConnection(projectId, connId);
        } catch {
            // Continue locally
        }
        setConnections((prev) => prev.filter((c) => c.id !== connId));
    }, [projectId]);

    const update = useCallback(async (connId: string, data: Partial<api.Connection>) => {
        try {
            const updated = await api.updateConnection(projectId, connId, data);
            setConnections(prev => prev.map(c => c.id === connId ? updated : c));
            return updated;
        } catch {
            // Fallback
            return null;
        }
    }, [projectId]);

    return { connections, loading, add, update, test, remove, refresh: fetchConnections };
}

