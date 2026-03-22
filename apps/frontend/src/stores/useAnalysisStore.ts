import { create } from 'zustand';

interface AnalysisState {
    securityAlerts: any[];
    ruleViolations: any[];
    mentorHints: string[];
    skills: { [key: string]: number };

    setSecurityAlerts: (alerts: any[]) => void;
    setRuleViolations: (violations: any[]) => void;
    setMentorHints: (hints: string[]) => void;
    setSkills: (skills: { [key: string]: number }) => void;
    updateSkills: (skillDelta: { [key: string]: number }) => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
    securityAlerts: [],
    ruleViolations: [],
    mentorHints: [],
    skills: {},

    setSecurityAlerts: (alerts) => set({ securityAlerts: alerts }),
    setRuleViolations: (violations) => set({ ruleViolations: violations }),
    setMentorHints: (hints) => set({ mentorHints: hints }),
    setSkills: (skills) => set({ skills }),
    updateSkills: (skillDelta) => set((state) => {
        const newSkills = { ...state.skills };
        Object.entries(skillDelta).forEach(([skill, delta]) => {
            newSkills[skill] = (newSkills[skill] || 0) + (delta as number);
        });
        return { skills: newSkills };
    }),
}));
