import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { type ToastType } from '@/stores/useToastStore';

interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    onClose: (id: string) => void;
}

const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
};

const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
};

export default function Toast({ id, message, type, onClose }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false);
    const Icon = icons[type];

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        // Wait for exit animation
        setTimeout(() => onClose(id), 300);
    };

    return (
        <div
            className={cn(
                "flex items-center w-full max-w-sm p-4 mb-4 text-white rounded-lg shadow-lg pointer-events-auto transform transition-all duration-300 ease-in-out",
                colors[type],
                isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-2 opacity-0 scale-95"
            )}
            role="alert"
        >
            <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-white/20">
                <Icon className="w-5 h-5" />
            </div>
            <div className="ml-3 text-sm font-medium">{message}</div>
            <button
                type="button"
                className="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-white/50 p-1.5 hover:bg-white/10 inline-flex items-center justify-center h-8 w-8 transition-colors"
                onClick={handleClose}
                aria-label="Close"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
