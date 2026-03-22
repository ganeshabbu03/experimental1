import { Zap, BookOpen, Award } from 'lucide-react';


interface MentorPanelProps {
    hints: string[];
    skills: { [key: string]: number };
}

export default function MentorPanel({ hints, skills }: MentorPanelProps) {
    return (
        <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-default)] w-80">
            <div className="p-3 border-b border-[var(--border-default)] flex items-center font-semibold text-[var(--text-primary)]">
                <BookOpen className="w-4 h-4 mr-2 text-indigo-500" />
                AI Mentor
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Hints Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        Learning Moments
                    </h3>
                    {hints.length === 0 ? (
                        <div className="text-sm text-[var(--text-secondary)] italic">
                            Write some code to get feedback...
                        </div>
                    ) : (
                        hints.map((hint, idx) => (
                            <div key={idx} className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-lg text-sm text-[var(--text-primary)]">
                                <div className="flex items-start">
                                    <Zap className="w-4 h-4 text-indigo-400 mr-2 mt-0.5 shrink-0" />
                                    <span>{hint}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Skills Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        Skill Progress
                    </h3>
                    {Object.entries(skills).length === 0 ? (
                        <div className="text-sm text-[var(--text-secondary)] italic">
                            No skills detected yet.
                        </div>
                    ) : (
                        Object.entries(skills).map(([skill, level]) => (
                            <div key={skill} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-[var(--text-primary)]">{skill}</span>
                                    <span className="text-[var(--text-secondary)]">Lvl {Math.floor(level)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-[var(--bg-canvas)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-500"
                                        style={{ width: `${Math.min(level * 20, 100)}%` }} // Arbitrary scaling
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Achievements (Mock) */}
                <div className="p-3 bg-gradient-to-r from-orange-500/10 to-pink-500/10 rounded-lg border border-orange-500/20">
                    <div className="flex items-center text-orange-400 text-sm font-semibold mb-1">
                        <Award className="w-4 h-4 mr-2" />
                        Daily Streak: 3 Days
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                        Keep coding to unlock "Python Master" badge!
                    </p>
                </div>
            </div>
        </div>
    );
}
