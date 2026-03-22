import React, { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

import AvatarUpload from './AvatarUpload';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
    const { user, updateUser } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const [newAvatar, setNewAvatar] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Mock additional fields if they were in the user object
    const [bio, setBio] = useState('Example User Bio');
    const [location, setLocation] = useState('San Francisco, CA');
    const [website, setWebsite] = useState('deexen.dev');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));

        updateUser({
            name,
            ...(newAvatar && { avatar: newAvatar })
        });
        // In a real app, we would update bio, location, etc. in the backend here
        // For now, we are just updating the name in auth store

        setIsLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-center mb-6">
                    <AvatarUpload
                        currentAvatar={user?.avatar || ''}
                        onAvatarChange={(_, base64) => setNewAvatar(base64)}
                        size="lg"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">Display Name</label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">Bio</label>
                    <textarea
                        className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md text-sm text-[var(--text-primary)] focus:outline-none focus:border-orange-500 min-h-[80px]"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--text-secondary)]">Location</label>
                        <Input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="City, Country"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--text-secondary)]">Website</label>
                        <Input
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isLoading}>
                        Save Changes
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
