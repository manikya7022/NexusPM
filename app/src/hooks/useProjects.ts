import { useState, useEffect, useCallback } from 'react';
import * as api from '../lib/apiClient';

export function useProjects() {
    const [projects, setProjects] = useState<api.Project[]>([]);
    const [activeProject, setActiveProject] = useState<api.Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjects = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getProjects();
            setProjects(data);
            if (!activeProject && data.length > 0) {
                setActiveProject(data[0]);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch projects');
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }, [activeProject]);

    useEffect(() => {
        fetchProjects();
    }, []);

    const create = useCallback(async (name: string, description = '') => {
        try {
            const project = await api.createProject(name, description);
            setProjects((prev) => [project, ...prev]);
            return project;
        } catch {
            // Fallback: add locally
            const p: api.Project = {
                id: Date.now().toString(),
                name,
                description,
                status: 'active',
                agentCount: 0,
                memberCount: 1,
                lastActivity: new Date().toISOString(),
                syncCount: 0,
                health: 100,
                color: '#00F0FF',
                createdAt: new Date().toISOString(),
            };
            setProjects((prev) => [p, ...prev]);
            return p;
        }
    }, []);

    const update = useCallback(async (id: string, data: Partial<api.Project>) => {
        try {
            const updated = await api.updateProject(id, data);
            setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
            if (activeProject?.id === id) {
                setActiveProject(prev => prev ? { ...prev, ...updated } : null);
            }
        } catch (e) {
            console.error('Failed to update project', e);
        }
    }, [activeProject]);

    const remove = useCallback(async (id: string) => {
        try {
            await api.deleteProject(id);
            setProjects((prev) => prev.filter((p) => p.id !== id));
            if (activeProject?.id === id) {
                // Switch to another project if available, or null
                setProjects(prev => {
                    const remaining = prev.filter(p => p.id !== id);
                    setActiveProject(remaining[0] || null);
                    return remaining;
                });
            }
        } catch (e) {
            console.error('Failed to delete project', e);
        }
    }, [activeProject]);

    const switchProject = useCallback((projectOrId: api.Project | string) => {
        if (typeof projectOrId === 'string') {
            setActiveProject(prev => {
                const found = projects.find(p => p.id === projectOrId);
                return found || prev;
            });
        } else {
            setActiveProject(projectOrId);
        }
    }, [projects]);

    return { projects, activeProject, loading, error, create, update, remove, switchProject, refresh: fetchProjects };
}

