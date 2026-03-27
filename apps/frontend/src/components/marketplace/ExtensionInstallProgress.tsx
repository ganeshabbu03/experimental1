import {
    AlertCircle,
    Box,
    CheckCircle2,
    Download,
    Sparkles,
    Wand2,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ExtensionInstallProgress } from '@/stores/usePluginStore';

interface ExtensionInstallProgressProps {
    progress: ExtensionInstallProgress;
    compact?: boolean;
}

type StageMeta = {
    label: string;
    Icon: LucideIcon;
    fillClassName: string;
    iconClassName: string;
    chipClassName: string;
};

const STAGE_META: Record<ExtensionInstallProgress['stage'], StageMeta> = {
    queued: {
        label: 'Queued',
        Icon: Sparkles,
        fillClassName: 'from-fuchsia-500 via-violet-500 to-sky-400',
        iconClassName: 'text-fuchsia-300',
        chipClassName: 'bg-fuchsia-500/12 text-fuchsia-200 border-fuchsia-400/20',
    },
    downloading: {
        label: 'Downloading',
        Icon: Download,
        fillClassName: 'from-sky-500 via-cyan-400 to-teal-300',
        iconClassName: 'text-sky-300',
        chipClassName: 'bg-sky-500/12 text-sky-200 border-sky-400/20',
    },
    extracting: {
        label: 'Extracting',
        Icon: Box,
        fillClassName: 'from-violet-500 via-purple-500 to-pink-400',
        iconClassName: 'text-violet-300',
        chipClassName: 'bg-violet-500/12 text-violet-200 border-violet-400/20',
    },
    installing: {
        label: 'Installing',
        Icon: Wand2,
        fillClassName: 'from-amber-500 via-orange-400 to-yellow-300',
        iconClassName: 'text-amber-200',
        chipClassName: 'bg-amber-500/12 text-amber-100 border-amber-400/20',
    },
    complete: {
        label: 'Installed',
        Icon: CheckCircle2,
        fillClassName: 'from-emerald-500 via-green-400 to-lime-300',
        iconClassName: 'text-emerald-200',
        chipClassName: 'bg-emerald-500/12 text-emerald-100 border-emerald-400/20',
    },
    error: {
        label: 'Failed',
        Icon: AlertCircle,
        fillClassName: 'from-rose-500 via-red-500 to-orange-400',
        iconClassName: 'text-rose-200',
        chipClassName: 'bg-rose-500/12 text-rose-100 border-rose-400/20',
    },
};

export function ExtensionInstallProgressBar({
    progress,
    compact = false,
}: ExtensionInstallProgressProps) {
    const meta = STAGE_META[progress.stage];
    const width = Math.min(100, Math.max(progress.stage === 'error' ? 12 : 6, progress.progress || 0));

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(30,41,59,0.84))] shadow-[0_18px_48px_rgba(15,23,42,0.28)]',
                compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
            )}
        >
            <div className="pointer-events-none absolute inset-0 opacity-80">
                <div className="mkt-progress-sheen absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/12 to-transparent" />
            </div>

            <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/6 ring-1 ring-white/8">
                        <meta.Icon className={cn('h-4 w-4', meta.iconClassName, progress.stage !== 'error' && 'animate-pulse')} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{meta.label}</span>
                            <span
                                className={cn(
                                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]',
                                    meta.chipClassName,
                                )}
                            >
                                {progress.progress}%
                            </span>
                        </div>
                        <p className={cn('truncate text-slate-300/90', compact ? 'text-[11px]' : 'text-xs')}>
                            {progress.message}
                        </p>
                    </div>
                </div>
            </div>

            <div className={cn('relative mt-3 overflow-hidden rounded-full bg-white/6 ring-1 ring-white/8', compact ? 'h-2' : 'h-2.5')}>
                <div
                    className={cn(
                        'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out',
                        meta.fillClassName,
                    )}
                    style={{ width: `${width}%` }}
                />
                <div
                    className={cn(
                        'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-white/60 bg-white shadow-[0_0_20px_rgba(255,255,255,0.45)] transition-[left] duration-500 ease-out',
                        progress.stage === 'error' && 'hidden',
                    )}
                    style={{ left: `calc(${width}% - 7px)` }}
                />
            </div>
        </div>
    );
}
