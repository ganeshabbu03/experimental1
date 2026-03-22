import { useToastStore } from '@/stores/useToastStore';
import Toast from './Toast';

export default function Toaster() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed bottom-0 right-0 p-4 w-full md:max-w-sm z-[100] flex flex-col items-end pointer-events-none">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    id={toast.id}
                    message={toast.message}
                    type={toast.type}
                    onClose={removeToast}
                />
            ))}
        </div>
    );
}
