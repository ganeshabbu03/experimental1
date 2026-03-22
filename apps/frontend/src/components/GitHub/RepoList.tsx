import React, { useEffect, useState } from 'react';
import { GitHubService } from '../../services/GitHubService';
import type { Repository } from '../../services/GitHubService';
import './RepoList.css';

interface RepoListProps {
    onImport: (repo: Repository) => void;
}

export const RepoList: React.FC<RepoListProps> = ({ onImport }) => {
    const [repos, setRepos] = useState<Repository[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadRepos();
    }, []);

    const loadRepos = async () => {
        try {
            setLoading(true);
            const data = await GitHubService.listRepos();
            setRepos(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading repositories...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <div className="repo-list">
            <h3>Select a Repository to Import</h3>
            <ul className="repos">
                {repos.map((repo) => (
                    <li key={repo.id} className="repo-item" onClick={() => onImport(repo)}>
                        <div className="repo-info">
                            <span className="repo-name">{repo.full_name}</span>
                            {repo.private && <span className="badge-private">Private</span>}
                        </div>
                        <p className="repo-desc">{repo.description}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};
