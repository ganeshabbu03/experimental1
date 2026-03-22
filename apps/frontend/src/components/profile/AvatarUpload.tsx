import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '@/utils/cn';
import Avatar from '@/components/ui/Avatar';

interface AvatarUploadProps {
    currentAvatar: string;
    onAvatarChange: (file: File, base64: string) => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    editable?: boolean;
}

const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
};

export default function AvatarUpload({ currentAvatar, onAvatarChange, size = 'md', editable = true }: AvatarUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple validation
        if (file.size > 2 * 1024 * 1024) { // 2MB
            alert("File size must be less than 2MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setPreview(result);
            onAvatarChange(file, result);
        };
        reader.readAsDataURL(file);
    };

    const triggerUpload = () => {
        if (editable) {
            fileInputRef.current?.click();
        }
    };

    return (
        <div className="relative inline-block group">
            <div
                className={cn(
                    "relative rounded-full border-2 border-[var(--border-default)] bg-[var(--bg-surface)]",
                    sizeClasses[size],
                    editable && "cursor-pointer"
                )}
                onClick={triggerUpload}
            >
                <Avatar
                    src={preview || currentAvatar}
                    alt="User"
                    size={size === 'md' ? 'lg' : size === 'lg' ? 'xl' : 'sm'}
                    className="w-full h-full"
                />

                {editable && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Camera className="w-6 h-6 text-white" />
                    </div>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileChange}
            />
        </div>
    );
}
