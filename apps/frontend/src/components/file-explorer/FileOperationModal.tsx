import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface FileOperationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    type: 'file' | 'folder' | 'delete';
    itemType?: 'file' | 'folder'; // For delete message: "Delete this file?"
    initialValue?: string;
}

export default function FileOperationModal({
    isOpen,
    onClose,
    onSubmit,
    type,
    itemType = 'file',
    initialValue = ''
}: FileOperationModalProps) {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
        }
    }, [isOpen, initialValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (type !== 'delete' && !value.trim()) return;
        onSubmit(value);
        onClose();
    };

    const getTitle = () => {
        switch (type) {
            case 'file': return 'New File';
            case 'folder': return 'New Folder';
            case 'delete': return `Delete ${itemType === 'folder' ? 'Folder' : 'File'}`;
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {type === 'delete' ? (
                    <p className="text-sm text-[var(--text-primary)]">
                        Are you sure you want to delete <span className="font-semibold text-orange-500">{initialValue}</span>?
                        This action cannot be undone.
                    </p>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                            Name
                        </label>
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={type === 'file' ? 'e.g., App.tsx' : 'e.g., components'}
                            autoFocus
                        />
                    </div>
                )}

                <div className="flex justify-end space-x-2 pt-2">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant={type === 'delete' ? 'destructive' : 'primary'}
                        disabled={type !== 'delete' && !value.trim()}
                    >
                        {type === 'delete' ? 'Delete' : 'Create'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
