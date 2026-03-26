// Project Service
// Handles project CRUD operations with real FastAPI backend

import { apiClient } from './apiClient';
import type { FileNode } from '@/stores/useFileStore';

export interface Project {
    id: string;
    name: string;
    description: string;
    fileCount: number;
    lastModified: string;
    createdAt: string;
    language?: string;
    isPublic?: boolean;
}

export interface ProjectFile {
    id: string;
    name: string;
    path: string;
    content: string;
    type: 'file' | 'folder';
    children?: ProjectFile[];
}

export function projectFilesToFileNodes(files: ProjectFile[]): FileNode[] {
    const mapNode = (file: ProjectFile): FileNode => ({
        id: file.id,
        name: file.name,
        type: file.type,
        content: file.content,
        isOpen: file.type === 'folder',
        children: file.children?.map(mapNode),
    });

    return [
        {
            id: 'root',
            name: 'root',
            type: 'folder',
            isOpen: true,
            children: files.map(mapNode),
        },
    ];
}

interface CreateProjectRequest {
    name: string;
    description?: string;
    template?: string;
}

// Backend response shape from FastAPI
interface BackendProject {
    id: number;
    user_id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    file_count?: number;
}

interface BackendFile {
    id: number;
    project_id: number;
    parent_id: number | null;
    name: string;
    file_type: string;
    content: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// Transform backend project response → frontend Project shape
function mapBackendProject(bp: BackendProject): Project {
    // Calculate relative time from updated_at
    const updatedDate = new Date(bp.updated_at);
    const now = new Date();
    const diffMs = now.getTime() - updatedDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let lastModified: string;
    if (diffMins < 1) lastModified = 'Just now';
    else if (diffMins < 60) lastModified = `${diffMins} min ago`;
    else if (diffHours < 24) lastModified = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    else if (diffDays < 7) lastModified = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    else lastModified = updatedDate.toLocaleDateString();

    return {
        id: String(bp.id),
        name: bp.name,
        description: bp.description || '',
        fileCount: bp.file_count || 0,
        lastModified,
        createdAt: bp.created_at,
        language: 'TypeScript', // Default — backend doesn't track language yet
    };
}

// Transform backend file list → frontend file tree
function mapBackendFiles(files: BackendFile[]): ProjectFile[] {
    const fileMap = new Map<number, ProjectFile>();

    // First pass: create all file nodes
    for (const f of files) {
        fileMap.set(f.id, {
            id: String(f.id),
            name: f.name,
            path: f.name,
            content: f.content || '',
            type: f.file_type as 'file' | 'folder',
            children: f.file_type === 'folder' ? [] : undefined,
        });
    }

    // Second pass: build tree
    const roots: ProjectFile[] = [];
    for (const f of files) {
        const node = fileMap.get(f.id)!;
        if (f.parent_id && fileMap.has(f.parent_id)) {
            const parent = fileMap.get(f.parent_id)!;
            if (!parent.children) parent.children = [];
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

class ProjectService {
    private findNodeByPath(files: ProjectFile[], segments: string[]): ProjectFile | null {
        let currentLevel = files;
        let current: ProjectFile | null = null;

        for (const segment of segments) {
            current = currentLevel.find((node) => node.name === segment) || null;
            if (!current) {
                return null;
            }
            currentLevel = current.children || [];
        }

        return current;
    }

    async listProjects(): Promise<Project[]> {
        console.log('[projectService] About to call GET /projects/');
        try {
            const backendProjects = await apiClient.get<BackendProject[]>('/projects/');
            console.log('[projectService] GET /projects/ returned:', backendProjects);
            (window as any).DEBUG_RAW_PROJECTS = backendProjects;

            const mapped = backendProjects.map(mapBackendProject);
            console.log('[projectService] Mapped projects:', mapped);
            return mapped;
        } catch (e: any) {
            console.error('[projectService] GET /projects/ threw error:', e);
            (window as any).DEBUG_API_ERR = e?.message || String(e);
            throw e;
        }
    }

    async getProject(id: string): Promise<Project> {
        const bp = await apiClient.get<BackendProject>(`/projects/${id}`);
        return mapBackendProject(bp);
    }

    async createProject(data: CreateProjectRequest): Promise<Project> {
        const bp = await apiClient.post<BackendProject>('/projects/', {
            name: data.name,
            description: data.description || '',
        });
        return mapBackendProject(bp);
    }

    async deleteProject(id: string): Promise<void> {
        await apiClient.delete(`/projects/${id}`);
    }

    async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
        const backendFiles = await apiClient.get<BackendFile[]>(`/projects/${projectId}/files`);
        return mapBackendFiles(backendFiles);
    }

    async saveFile(projectId: string, fileId: string, content: string): Promise<void> {
        await apiClient.put(`/projects/${projectId}/files/${fileId}`, { content });
    }

    async createFile(projectId: string, name: string, fileType: string, parentId?: string, content?: string): Promise<ProjectFile> {
        const file = await apiClient.post<BackendFile>(`/projects/${projectId}/files`, {
            name,
            file_type: fileType,
            parent_id: parentId ? Number(parentId) : null,
            content: content || null,
        });

        return {
            id: String(file.id),
            name: file.name,
            path: file.name,
            content: file.content || '',
            type: file.file_type as 'file' | 'folder',
            children: file.file_type === 'folder' ? [] : undefined,
        };
    }

    async ensureFilePath(projectId: string, relativePath: string, content: string = ''): Promise<string> {
        const segments = relativePath
            .replace(/\\/g, '/')
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean);

        if (segments.length === 0) {
            throw new Error('A valid file path is required');
        }

        let files = await this.getProjectFiles(projectId);
        let parentId: string | undefined;

        for (let index = 0; index < segments.length; index += 1) {
            const isLeaf = index === segments.length - 1;
            const currentPath = segments.slice(0, index + 1);
            let existing = this.findNodeByPath(files, currentPath);

            if (!existing) {
                await this.createFile(
                    projectId,
                    segments[index],
                    isLeaf ? 'file' : 'folder',
                    parentId,
                    isLeaf ? content : undefined,
                );
                files = await this.getProjectFiles(projectId);
                existing = this.findNodeByPath(files, currentPath);
            }

            if (!existing) {
                throw new Error(`Failed to resolve file path ${relativePath}`);
            }

            parentId = existing.id;
        }

        return parentId!;
    }
}

export const projectService = new ProjectService();
