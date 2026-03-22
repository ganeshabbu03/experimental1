import { useState } from 'react';
import { cn } from '@/utils/cn';

interface AvatarProps {
    src?: string;
    alt?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const sizes = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-sm',
    xl: 'w-24 h-24 text-base',
};

const radius = {
    sm: 'rounded-full',
    md: 'rounded-full',
    lg: 'rounded-xl',
    xl: 'rounded-2xl',
};

export default function Avatar({ src, alt = '', size = 'md', className }: AvatarProps) {
    const [hasError, setHasError] = useState(false);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const initials = getInitials(alt || 'User');

    if (!src || hasError) {
        return (
            <div
                className={cn(
                    "flex items-center justify-center bg-orange-500 text-white font-bold tracking-wider select-none",
                    sizes[size],
                    radius[size],
                    className
                )}
            >
                {initials}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            onError={() => setHasError(true)}
            className={cn(
                "object-cover bg-[var(--bg-canvas)]",
                sizes[size],
                radius[size],
                className
            )}
        />
    );
}
