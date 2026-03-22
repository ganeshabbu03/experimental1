import { useState } from 'react';
import { Sparkles, ArrowRight, FolderTree, Code, CheckCircle, BookOpen } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToastStore } from '@/stores/useToastStore';

interface FileNode {
    name: string;
    type: 'file' | 'folder';
    content?: string;
    children?: FileNode[];
}

interface Blueprint {
    name: string;
    description: string;
    structure: FileNode[];
    explanation: string[];
}

interface ProjectWizardProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProjectWizard({ isOpen, onClose }: ProjectWizardProps) {
    const [step, setStep] = useState(1);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
    const { addToast } = useToastStore();

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:8000/scaffold/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            if (!res.ok) throw new Error('Failed to generate blueprint');
            const data = await res.json();
            setBlueprint(data);
            setStep(2);
        } catch (err) {
            addToast('Error generating blueprint', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!blueprint) return;
        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:8000/scaffold/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: blueprint.name.replace(/\s+/g, '-').toLowerCase(), // Simple slugify
                    path: "default", // Backend handles root
                    structure: blueprint.structure
                })
            });

            if (!res.ok) throw new Error('Failed to create project');

            const data = await res.json();
            addToast(`Project created at ${data.path}`, 'success');
            onClose();
        } catch (err) {
            addToast('Error creating project', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const renderTree = (nodes: FileNode[], depth = 0) => {
        return nodes.map((node, idx) => (
            <div key={idx} style={{ paddingLeft: `${depth * 16}px` }} className="text-sm py-1">
                <div className="flex items-center text-[var(--text-secondary)]">
                    {node.type === 'folder' ? (
                        <FolderTree className="w-4 h-4 mr-2 text-indigo-400" />
                    ) : (
                        <Code className="w-4 h-4 mr-2 text-neutral-400" />
                    )}
                    <span className={cn(node.type === 'folder' && "font-semibold text-[var(--text-primary)]")}>
                        {node.name}
                    </span>
                </div>
                {node.children && renderTree(node.children, depth + 1)}
            </div>
        ));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New AI Project">
            <div className="min-w-[600px] min-h-[400px] flex flex-col">
                {/* Steps */}
                <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--text-secondary)] mb-6 uppercase tracking-wider">
                    <span className={cn(step >= 1 && "text-orange-500")}>1. Describe</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className={cn(step >= 2 && "text-orange-500")}>2. Review Blueprint</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className={cn(step >= 3 && "text-orange-500")}>3. Create</span>
                </div>

                <div className="flex-1">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg flex items-start">
                                <Sparkles className="w-5 h-5 text-orange-500 mr-3 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Learning-First Mode</h3>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Describe what you want to build, and Deexen will generate a structured blueprint explanation before writing any code.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                                    Project Description
                                </label>
                                <textarea
                                    className="w-full h-32 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md p-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-500 resize-none"
                                    placeholder="e.g., A Python web API using FastAPI for a bookstore..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleGenerate} isLoading={isLoading} disabled={!prompt}>
                                    Generate Blueprint
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && blueprint && (
                        <div className="grid grid-cols-2 gap-6 h-full">
                            {/* Blueprint Tree */}
                            <div className="border border-[var(--border-default)] rounded-lg p-4 bg-[var(--bg-surface)] overflow-y-auto max-h-[400px]">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center">
                                    <FolderTree className="w-4 h-4 mr-2" />
                                    Structure
                                </h3>
                                {renderTree(blueprint.structure)}
                            </div>

                            {/* Educational Panel */}
                            <div className="border-l border-[var(--border-default)] pl-6">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center">
                                    <BookOpen className="w-4 h-4 mr-2 text-indigo-400" />
                                    Why this structure?
                                </h3>
                                <div className="space-y-3">
                                    {blueprint.explanation.map((item, idx) => {
                                        const [title, desc] = item.split(':');
                                        return (
                                            <div key={idx} className="text-sm">
                                                <strong className="text-[var(--text-primary)] block mb-0.5">{title.replace(/\*\*/g, '')}</strong>
                                                <span className="text-[var(--text-secondary)]">{desc}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-8 pt-6 border-t border-[var(--border-default)] flex justify-end space-x-3">
                                    <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                                    <Button onClick={handleCreate} isLoading={isLoading}>
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Create Project
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
