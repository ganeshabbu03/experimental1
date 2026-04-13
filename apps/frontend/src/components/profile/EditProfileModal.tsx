import React, { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import AvatarUpload from './AvatarUpload';
import { uploadAvatarToSupabase } from '@/services/avatarUploadService';
import { apiClient } from '@/services/apiClient';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
    const { user, updateUser } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [isAvatarLoading, setIsAvatarLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Mock additional fields if they were in the user object
    const [bio, setBio] = useState('Example User Bio');
    const [location, setLocation] = useState('San Francisco, CA');
    const [website, setWebsite] = useState('deexen.dev');

    const handleAvatarChange = (file: File, _base64: string) => {
        setPendingFile(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            let avatarUrl: string | undefined;

            // 1. Upload avatar to Supabase Storage if a new file was selected
            if (pendingFile && user?.id) {
                setIsAvatarLoading(true);
                try {
                    avatarUrl = await uploadAvatarToSupabase(pendingFile, user.id);
                } finally {
                    setIsAvatarLoading(false);
                }
            }

            // 2. Persist name (and avatar_url if changed) to the backend
            const updatedUser = await apiClient.put<{
                id: string;
                name: string;
                email: string;
                is_active: boolean;
                created_at: string;
                avatar_url: string | null;
            }>('/profile/', {
                name,
                ...(avatarUrl !== undefined && { avatar_url: avatarUrl }),
            });

            // 3. Sync the auth store so the UI reflects the changes immediately
            updateUser({
                name: updatedUser.name,
                ...(updatedUser.avatar_url && { avatar: updatedUser.avatar_url, avatar_url: updatedUser.avatar_url }),
            });

            setPendingFile(null);
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-center mb-6">
                    <AvatarUpload
                        currentAvatar={user?.avatar_url || user?.avatar || ''}
                        onAvatarChange={handleAvatarChange}
                        size="lg"
                        isLoading={isAvatarLoading}
                    />
                </div>

                {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                )}

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
                    <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
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
