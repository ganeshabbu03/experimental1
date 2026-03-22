import { useState } from 'react';
import { GitBranch, GitCommit, Check } from 'lucide-react';
import { useFileStore } from '@/stores/useFileStore';

export default function SourceControl() {
    const { files } = useFileStore();
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [lastCommit, setLastCommit] = useState<string | null>(null);

    // Extract all file names to show as "staged changes"
    const extractFiles = (nodes: any[]): string[] => {
        let results: string[] = [];
        for (const node of nodes) {
            if (node.type === 'file') {
                results.push(node.name);
            } else if (node.children) {
                results.push(...extractFiles(node.children));
            }
        }
        return results;
    };

    const trackedFiles = extractFiles(files || []);

    const handleCommit = () => {
        if (!commitMessage) return;
        setIsCommitting(true);
        setTimeout(() => {
            setLastCommit(`Committed: ${commitMessage}`);
            setCommitMessage('');
            setIsCommitting(false);
        }, 800);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-surface)] text-[var(--text-primary)]">
            <div className="flex flex-col p-4 border-b border-[var(--border-default)]">
                <input
                    type="text"
                    placeholder="Message (Ctrl+Enter to commit)"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            handleCommit();
                        }
                    }}
                    className="w-full bg-[var(--bg-canvas)] border border-[var(--border-default)] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500 transition-colors mb-3"
                />
                <button
                    onClick={handleCommit}
                    disabled={!commitMessage || trackedFiles.length === 0 || isCommitting}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm py-1.5 rounded transition-colors flex items-center justify-center"
                >
                    {isCommitting ? (
                        <span className="animate-pulse">Committing...</span>
                    ) : (
                        <>
                            <GitCommit className="w-4 h-4 mr-2" />
                            Commit
                        </>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {lastCommit && (
                    <div className="text-xs text-green-500 mb-4 px-2 flex items-center">
                        <Check className="w-3 h-3 mr-1" />
                        {lastCommit}
                    </div>
                )}

                <div className="text-xs font-semibold uppercase text-[var(--text-secondary)] px-2 mb-2 tracking-wider">
                    Changes ({trackedFiles.length})
                </div>

                {trackedFiles.length > 0 ? (
                    <div className="space-y-0.5">
                        {trackedFiles.map((filename, idx) => (
                            <div key={idx} className="flex items-center text-sm px-2 py-1 hover:bg-[var(--bg-surface-hover)] rounded cursor-pointer group">
                                <span className="text-blue-400 font-mono text-xs mr-2 border border-blue-400/30 rounded px-1 group-hover:bg-blue-400/10">M</span>
                                <span className="truncate flex-1">{filename}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-[var(--text-secondary)]">
                        <GitBranch className="w-8 h-8 mb-2 opacity-30" />
                        <span className="text-sm">No changes</span>
                    </div>
                )}
            </div>
        </div>
    );
}
