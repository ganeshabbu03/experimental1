// AI Mode Configuration
import { Bug, Sparkles, Rocket, GraduationCap, Zap, type LucideIcon } from 'lucide-react';

export interface ModeConfig {
    id: string;
    label: string;
    Icon: LucideIcon;
    color: string;
    buttonText: string;
    description: string;
    placeholder: string;
}

export const MODE_CONFIG: Record<string, ModeConfig> = {
    debug: {
        id: 'debug',
        label: 'Debug',
        Icon: Bug,
        color: '#b91c1c', // deep red
        buttonText: 'Find & Fix Errors',
        description: 'Identifies errors, explains why they occur, and provides fixes',
        placeholder: 'Paste your code to find bugs and get fixes',
    },
    enhance: {
        id: 'enhance',
        label: 'Enhance',
        Icon: Sparkles,
        color: '#7c3aed', // deep purple
        buttonText: 'Improve Code',
        description: 'Refactoring, better structure, and performance optimization',
        placeholder: 'Paste code for quality improvements',
    },
    expand: {
        id: 'expand',
        label: 'Expand',
        Icon: Rocket,
        color: '#1d4ed8', // deep blue
        buttonText: 'Add Features',
        description: 'Add advanced features and transform into scalable solutions',
        placeholder: 'Paste code to expand with new features',
    },
    teaching: {
        id: 'teaching',
        label: 'Strict Teaching',
        Icon: GraduationCap,
        color: '#b45309', // deep amber
        buttonText: 'Guide Me',
        description: 'Step-by-step learning with hints, not instant solutions',
        placeholder: 'Paste code to learn through guidance',
    },
    livefix: {
        id: 'livefix',
        label: 'Live Fix',
        Icon: Zap,
        color: '#047857', // deep green
        buttonText: 'Monitor & Fix',
        description: 'Code freely while AI monitors and provides instant fixes',
        placeholder: 'Start coding - AI will suggest fixes in real-time',
    },
};

export type AIMode = keyof typeof MODE_CONFIG;

export const AI_MODES = Object.values(MODE_CONFIG);
