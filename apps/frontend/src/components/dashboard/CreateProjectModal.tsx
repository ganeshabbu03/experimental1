import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useProjectStore } from '@/stores/useProjectStore';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
    const { addProject } = useProjectStore();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [language, setLanguage] = useState('TypeScript'); // Default

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        addProject({
            name,
            description,
            language
        });

        // Reset and close
        setName('');
        setDescription('');
        setLanguage('TypeScript');
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Project">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                        Project Name
                    </label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="my-awesome-project"
                        autoFocus
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                        Description
                    </label>
                    <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="A brief description..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                        Language
                    </label>
                    <Input
                        list="languages"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="e.g. TypeScript, Rust, C++"
                    />
                    <datalist id="languages">
                        <option value="TypeScript" />
                        <option value="JavaScript" />
                        <option value="Python" />
                        <option value="Go" />
                        <option value="Rust" />
                        <option value="Java" />
                        <option value="C++" />
                        <option value="C" />
                        <option value="Ruby" />
                        <option value="PHP" />
                    </datalist>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={!name.trim()}>
                        Create Project
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
