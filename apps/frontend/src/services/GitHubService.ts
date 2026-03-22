import { runtimeConfig } from '@/config/runtime';

const API_URL = runtimeConfig.workspaceApiUrl;

export interface Repository {
    id: string;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    clone_url: string;
    description: string;
    default_branch: string;
}

function getAuthContext(): { token?: string; userId?: string; userEmail?: string } {
    try {
        const stored = localStorage.getItem('deexen-auth-storage');
        if (!stored) return {};
        const parsed = JSON.parse(stored);
        const state = parsed?.state || {};
        return {
            token: typeof state.token === 'string' ? state.token : undefined,
            userId: typeof state.user?.id === 'string' ? state.user.id : undefined,
            userEmail: typeof state.user?.email === 'string' ? state.user.email : undefined,
        };
    } catch {
        return {};
    }
}

function createHeaders(extra: Record<string, string> = {}): HeadersInit {
    const auth = getAuthContext();
    const headers: Record<string, string> = {
        ...extra,
    };
    if (auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
    }
    if (auth.userId) {
        headers['x-user-id'] = auth.userId;
    }
    if (auth.userEmail) {
        headers['x-user-email'] = auth.userEmail;
    }
    return headers;
}

export const GitHubService = {
    async startAuth() {
        // Redirects to Backend OAuth endpoint
        window.location.href = `${API_URL}/auth/github`;
    },

    async listRepos(): Promise<Repository[]> {
        const response = await fetch(`${API_URL}/github/repos`, {
            headers: createHeaders(),
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`Failed to fetch repositories (${response.status})${detail ? `: ${detail}` : ''}`);
        }

        return response.json();
    },

    async importRepo(repo: Repository) {
        const response = await fetch(`${API_URL}/workspaces/import`, {
            method: 'POST',
            headers: createHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
                repoId: repo.id,
                repoName: repo.name,
                cloneUrl: repo.clone_url,
            }),
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`Failed to import repository (${response.status})${detail ? `: ${detail}` : ''}`);
        }

        return response.json();
    },
};
