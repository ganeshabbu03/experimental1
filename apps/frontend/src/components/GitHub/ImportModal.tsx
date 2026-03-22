import React, { useState } from 'react';
import { RepoList } from './RepoList';
import { GitHubService } from '../../services/GitHubService';
import type { Repository } from '../../services/GitHubService';
import './ImportModal.css';

interface ImportModalProps {
    onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onClose }) => {
    const [step, setStep] = useState<'auth' | 'list' | 'importing' | 'success'>('auth');
    const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);

    const handleConnect = () => {
        GitHubService.startAuth();
        // In a real app, we'd wait for a callback or poll for session
        // create a listener or just proceed to 'list' for demo purposes if session exists
        // For now, let's assume the user has authenticated and we can show the list
        setStep('list');
    };

    const handleImport = async (repo: Repository) => {
        setSelectedRepo(repo);
        setStep('importing');
        try {
            await GitHubService.importRepo(repo);
            setStep('success');
        } catch (e) {
            console.error(e);
            alert('Import failed');
            setStep('list');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="close-btn" onClick={onClose}>&times;</button>
                <h2>Import from GitHub</h2>

                {step === 'auth' && (
                    <div className="auth-step">
                        <p>Connect your GitHub account to access your repositories.</p>
                        <button className="btn-primary" onClick={handleConnect}>
                            Connect GitHub
                        </button>
                    </div>
                )}

                {step === 'list' && (
                    <RepoList onImport={handleImport} />
                )}

                {step === 'importing' && (
                    <div className="loading-step">
                        <div className="spinner"></div>
                        <p>Cloning {selectedRepo?.full_name}...</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="success-step">
                        <h3>Success!</h3>
                        <p>Workspace provisioned for {selectedRepo?.name}.</p>
                        <button className="btn-primary" onClick={onClose}>Open Workspace</button>
                    </div>
                )}
            </div>
        </div>
    );
};
