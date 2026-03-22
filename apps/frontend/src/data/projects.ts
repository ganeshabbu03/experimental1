export interface Project {
    id: string;
    name: string;
    description: string;
    files: number;
    lastModified: string;
    language: string;
    starred: boolean;
    // Enhanced Data
    fullDescription?: string;
    techStack?: string[];
    features?: string[];
    architecture?: string;
    fileStructure?: string; // Kept in data for reference, but not rendered by default
    fileTree?: any[]; // FileNode[] - using any to avoid circular deps for now, or I'll move types later
}

export const projects: Project[] = [];
