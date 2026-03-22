import { useOutputStore } from '@/stores/useOutputStore';
import { Trash2 } from 'lucide-react';

export default function OutputPanel() {
    const { lines, clear } = useOutputStore();

    return (
        <div className="h-full flex flex-col bg-[var(--bg-secondary)] border-l border-[var(--border-default)]">
            {/* Header */}
            <div className="h-10 px-4 flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-canvas)]">
                <span className="text-sm font-medium text-[var(--text-primary)]">Output</span>
                <button
                    onClick={clear}
                    className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    title="Clear Output"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Output Content */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
                {lines.length === 0 ? (
                    <div className="text-[var(--text-tertiary)] italic">
                        No output yet. Run a program to see results here.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {lines.map((line) => (
                            <div
                                key={line.id}
                                className={`whitespace-pre-wrap ${line.type === 'stderr' || line.type === 'error'
                                        ? 'text-red-400'
                                        : line.type === 'success'
                                            ? 'text-green-400'
                                            : line.type === 'info'
                                                ? 'text-blue-400'
                                                : 'text-[var(--text-primary)]'
                                    }`}
                            >
                                {line.content}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
