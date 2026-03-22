import { useState, useEffect, useRef } from 'react';
import { Search, FileCode, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useFileStore } from '@/stores/useFileStore';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [filteredFiles, setFilteredFiles] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const { files, openFile, selectFile } = useFileStore();

    // Extract all files from the tree
    const getAllFiles = (nodes: any[]): any[] => {
        let result: any[] = [];
        for (const node of nodes) {
            if (node.type === 'file') {
                result.push(node);
            }
            if (node.children) {
                result = result.concat(getAllFiles(node.children));
            }
        }
        return result;
    };

    // Filter files based on query
    useEffect(() => {
        if (!isOpen) return;

        const allFiles = getAllFiles(files);
        if (!query.trim()) {
            setFilteredFiles(allFiles.slice(0, 10)); // Show first 10 files
        } else {
            const filtered = allFiles.filter(file =>
                file.name.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 10);
            setFilteredFiles(filtered);
        }
        setSelectedIndex(0);
    }, [query, files, isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setQuery('');
        }
    }, [isOpen]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, filteredFiles.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && filteredFiles.length > 0) {
            e.preventDefault();
            handleSelectFile(filteredFiles[selectedIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    const handleSelectFile = (file: any) => {
        openFile(file.id);
        selectFile(file.id);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-[#101012] border border-white/10 rounded-lg shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center px-4 py-3 border-b border-white/5">
                    <Search className="w-4 h-4 text-[var(--text-secondary)] mr-3" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search files..."
                        className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none"
                    />
                    <button
                        onClick={onClose}
                        className="ml-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Results */}
                <div className="max-h-[400px] overflow-y-auto">
                    {filteredFiles.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-secondary)] text-sm">
                            No files found
                        </div>
                    ) : (
                        <div className="py-2">
                            {filteredFiles.map((file, index) => (
                                <button
                                    key={file.id}
                                    onClick={() => handleSelectFile(file)}
                                    className={cn(
                                        "w-full px-4 py-2 flex items-center space-x-3 transition-all duration-150",
                                        index === selectedIndex
                                            ? "bg-white/10 border-l-2 border-[var(--accent-orange)]"
                                            : "hover:bg-white/5"
                                    )}
                                >
                                    <FileCode className={cn(
                                        "w-4 h-4",
                                        index === selectedIndex ? "text-[var(--accent-orange)]" : "text-zinc-600"
                                    )} />
                                    <span className={cn(
                                        "text-sm truncate",
                                        index === selectedIndex ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                                    )}>
                                        {file.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                    <div className="flex items-center space-x-4">
                        <span>↑↓ Navigate</span>
                        <span>↵ Select</span>
                        <span>ESC Close</span>
                    </div>
                    <span>{filteredFiles.length} files</span>
                </div>
            </div>
        </div>
    );
}
