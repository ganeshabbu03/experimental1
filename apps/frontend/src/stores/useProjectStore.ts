import { create } from 'zustand';
import { type Project } from '@/data/projects';
import { projectService } from '@/services/projectService';
import { useToastStore } from '@/stores/useToastStore';

interface ProjectState {
    projects: Project[];
    isLoading: boolean;
    error: string | null;
    addProject: (project: Omit<Project, 'id' | 'files' | 'lastModified' | 'starred'>) => void;
    deleteProject: (id: string) => void;
    updateProject: (id: string, updates: Partial<Project>) => void;
    toggleStar: (id: string) => void;
    setProjects: (projects: Project[]) => void;
    // API-powered actions
    fetchProjects: () => Promise<void>;
    createProjectAPI: (name: string, description?: string) => Promise<void>;
    deleteProjectAPI: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
    projects: [],
    isLoading: false,
    error: null,

    // Fetch projects from the real backend API
    fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
            const apiProjects = await projectService.listProjects();

            // Map API response to store's Project shape (fixing the files property name difference)
            const projects: Project[] = apiProjects.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                files: (p as any).fileCount || 0, // Quick fix for property name mismatch
                lastModified: p.lastModified,
                language: p.language || 'TypeScript',
                starred: false,
            }));

            set({ projects, isLoading: false });
        } catch (error: unknown) {
            const message = error && typeof error === 'object' && 'message' in error
                ? (error as { message: string }).message
                : 'Failed to fetch projects';
            useToastStore.getState().addToast(`Fetch Error: ${message}`, 'error');
            set({ error: message, isLoading: false });
            console.error('Failed to fetch projects:', error);
        }
    },

    // Create project via API then refresh the list
    createProjectAPI: async (name: string, description?: string) => {
        set({ isLoading: true, error: null });
        try {
            await projectService.createProject({ name, description });
            // Refresh the project list from the API
            await get().fetchProjects();
        } catch (error: unknown) {
            const message = error && typeof error === 'object' && 'message' in error
                ? (error as { message: string }).message
                : 'Failed to create project';
            set({ error: message, isLoading: false });
            throw error;
        }
    },

    // Delete project via API then refresh the list
    deleteProjectAPI: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            await projectService.deleteProject(id);
            // Refresh the project list from the API
            await get().fetchProjects();
        } catch (error: unknown) {
            const message = error && typeof error === 'object' && 'message' in error
                ? (error as { message: string }).message
                : 'Failed to delete project';
            set({ error: message, isLoading: false });
            throw error;
        }
    },

    // Local-only actions (kept for backward compatibility)
    addProject: (newProjectData) => set((state) => {
        const newProject: Project = {
            id: Math.random().toString(36).substr(2, 9),
            ...newProjectData,
            files: 0,
            lastModified: 'Just now',
            starred: false,
            fullDescription: newProjectData.description,
            techStack: [],
            features: [],
            architecture: 'Client-Side',
            fileStructure: '/src'
        };
        return { projects: [newProject, ...state.projects] };
    }),

    deleteProject: (id) => set((state) => ({
        projects: state.projects.filter((p) => p.id !== id)
    })),

    updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
        )
    })),

    toggleStar: (id) => set((state) => ({
        projects: state.projects.map((p) =>
            p.id === id ? { ...p, starred: !p.starred } : p
        )
    })),

    setProjects: (projects) => set({ projects }),
}));
