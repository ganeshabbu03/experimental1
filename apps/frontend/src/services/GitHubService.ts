const API_URL = import.meta.env.VITE_WORKSPACE_API_URL || 'http://localhost:3000';

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

export const GitHubService = {
    async startAuth() {
        // Redirects to Backend OAuth endpoint
        window.location.href = `${API_URL}/auth/github`;
    },

    async listRepos(): Promise<Repository[]> {
        // const token = localStorage.getItem('auth_token'); // Assuming some auth method
        // In this MVP, we might rely on session cookies or just mocking the user ID header
        const response = await fetch(`${API_URL}/github/repos`, {
            headers: {
                'x-user-id': 'test-user-id', // Mocked as per backend
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch repositories');
        }

        return response.json();
    },

    async importRepo(repo: Repository) {
        const response = await fetch(`${API_URL}/workspaces/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': 'test-user-id',
            },
            body: JSON.stringify({
                repoId: repo.id,
                repoName: repo.name,
                cloneUrl: repo.clone_url,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to import repository');
        }

        return response.json();
    },
};
