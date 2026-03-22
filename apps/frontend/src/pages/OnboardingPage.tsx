import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { Button } from '@/components/ui/Button';
import { Check, User, Briefcase, Code, Coffee, Globe, Moon, Sun, ArrowRight, ArrowLeft, Brain, GraduationCap, Zap, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { getRandomQuestions, type Question } from '@/data/quizQuestions';

// Helper for conditional classes
function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const ROLES = [
    { id: 'student', label: 'Student', icon: User, description: 'Learning & building projects' },
    { id: 'professional', label: 'Professional', icon: Briefcase, description: 'Work & productivity' },
    { id: 'freelancer', label: 'Freelancer', icon: Globe, description: 'Client work management' },
    { id: 'hobbyist', label: 'Hobbyist', icon: Coffee, description: 'Coding for fun' },
    { id: 'other', label: 'Other', icon: Code, description: 'Something else' }
];

const SKILL_LEVELS = [
    { id: 'beginner', label: 'Beginner', icon: GraduationCap, description: 'I need definitions and simpler explanations.' },
    { id: 'intermediate', label: 'Intermediate', icon: Brain, description: 'I know the basics, just help me build.' },
    { id: 'advanced', label: 'Advanced', icon: Zap, description: 'Concise answers. Code snippets only.' },
    { id: 'quiz', label: 'Take a Quiz', icon: HelpCircle, description: 'Not sure? Let AI decide for you.' }
];



export default function OnboardingPage() {
    const [step, setStep] = useState(1);
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedSkillLevel, setSelectedSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced' | ''>('');
    const [showQuiz, setShowQuiz] = useState(false);
    const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
    const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
    const [quizScore, setQuizScore] = useState<number | null>(null);

    const { theme, setTheme } = useThemeStore();
    const { updateUser } = useAuthStore();
    const { resetTours } = useLayoutStore();

    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFinish = async () => {
        if (!selectedRole || !selectedSkillLevel) return;

        setIsSubmitting(true);

        // Simulate a small network delay for better UX feel
        setTimeout(() => {
            updateUser({
                role: selectedRole,
                skillLevel: selectedSkillLevel as any,
                onboardingCompleted: true
            });
            resetTours();
            navigate('/dashboard');
            setIsSubmitting(false);
        }, 800);
    };

    const nextStep = () => {
        if (step === 1 && selectedRole) setStep(2);
        else if (step === 2) setStep(3);
    };

    const prevStep = () => {
        if (step === 2) setStep(1);
        else if (step === 3) setStep(2);
    };

    const handleQuizOptionSelect = (questionIndex: number, optionIndex: number) => {
        const newAnswers = [...quizAnswers];
        newAnswers[questionIndex] = optionIndex;
        setQuizAnswers(newAnswers);

        // Auto-advance or finish
        if (newAnswers.filter(a => a !== undefined).length === currentQuestions.length) {
            // Calculate score
            let score = 0;
            newAnswers.forEach((ans, idx) => {
                if (ans === currentQuestions[idx].correct) score++;
            });
            setQuizScore(score);

            // Assign level based on score
            // 0-1: Beginner
            // 2-3: Intermediate
            // 4-5: Advanced
            let level: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
            if (score >= 2) level = 'intermediate';
            if (score >= 4) level = 'advanced';

            setTimeout(() => {
                setSelectedSkillLevel(level);
                setShowQuiz(false);
                setCurrentQuestions([]); // Reset
            }, 1500); // Show score briefly
        }
    };

    return (
        <div className="min-h-screen w-full bg-[var(--bg-canvas)] flex items-center justify-center font-sans p-4 transition-colors duration-200">
            <div className="w-full max-w-2xl">

                {/* Progress Header */}
                <div className="mb-8 flex items-center justify-center space-x-2">
                    <div className={cn("h-2 w-12 rounded-full transition-colors", step >= 1 ? "bg-orange-500" : "bg-[var(--border-default)]")} />
                    <div className={cn("h-2 w-12 rounded-full transition-colors", step >= 2 ? "bg-orange-500" : "bg-[var(--border-default)]")} />
                    <div className={cn("h-2 w-12 rounded-full transition-colors", step >= 3 ? "bg-orange-500" : "bg-[var(--border-default)]")} />
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-semibold text-[var(--text-primary)] mb-2">
                        {step === 1 && "Tell us about yourself"}
                        {step === 2 && "Choose your look"}
                        {step === 3 && "What's your coding experience?"}
                    </h1>
                    <p className="text-[var(--text-secondary)]">
                        {step === 1 && "We'll personalize your experience based on your role."}
                        {step === 2 && "Select the theme that fits your vibe."}
                        {step === 3 && "Help us tailor the AI assistance to your level."}
                    </p>
                </div>

                {/* Step 1: Role Selection */}
                {step === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-out]">
                        {ROLES.map((role) => {
                            const Icon = role.icon;
                            const isSelected = selectedRole === role.id;
                            return (
                                <button
                                    key={role.id}
                                    onClick={() => setSelectedRole(role.id)}
                                    className={cn(
                                        "relative p-4 rounded-xl border-2 text-left transition-all duration-200 group hover:border-orange-500/50 hover:bg-[var(--bg-surface-hover)]",
                                        isSelected
                                            ? "border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/20"
                                            : "border-[var(--border-default)] bg-[var(--bg-surface)]"
                                    )}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            isSelected ? "bg-orange-500 text-white" : "bg-[var(--bg-canvas)] text-[var(--text-secondary)] group-hover:text-orange-500"
                                        )}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className={cn("font-medium mb-1", isSelected ? "text-orange-500" : "text-[var(--text-primary)]")}>
                                                {role.label}
                                            </h3>
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                {role.description}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-4 right-4 text-orange-500">
                                                <Check className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Step 2: Theme Selection */}
                {step === 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
                        {/* Light Mode */}
                        <button
                            onClick={() => setTheme('light')}
                            className={cn(
                                "relative p-6 rounded-xl border-2 text-left transition-all duration-200 group hover:border-orange-500/50",
                                theme === 'light'
                                    ? "border-orange-500 bg-white ring-2 ring-orange-500/20"
                                    : "border-gray-200 bg-gray-50 hover:bg-white"
                            )}
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-full aspect-video bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex flex-col gap-2 overflow-hidden">
                                    <div className="flex gap-2">
                                        <div className="w-1/4 h-full bg-gray-50 rounded" />
                                        <div className="flex-1 flex flex-col gap-2">
                                            <div className="h-2 w-1/3 bg-gray-200 rounded" />
                                            <div className="h-2 w-1/2 bg-gray-100 rounded" />
                                            <div className="flex-1 bg-gray-50 rounded mt-1" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Sun className={cn("w-5 h-5", theme === 'light' ? "text-orange-500" : "text-gray-500")} />
                                    <span className={cn("font-medium", theme === 'light' ? "text-orange-500" : "text-gray-900")}>Light Mode</span>
                                </div>
                            </div>
                        </button>

                        {/* Dark Mode */}
                        <button
                            onClick={() => setTheme('dark')}
                            className={cn(
                                "relative p-6 rounded-xl border-2 text-left transition-all duration-200 group hover:border-orange-500/50",
                                theme === 'dark'
                                    ? "border-orange-500 bg-[#0a0a0a] ring-2 ring-orange-500/20"
                                    : "border-gray-800 bg-[#141414] hover:bg-[#0a0a0a]"
                            )}
                        >
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-full aspect-video bg-[#0a0a0a] border border-gray-800 rounded-lg shadow-sm p-3 flex flex-col gap-2 overflow-hidden">
                                    <div className="flex gap-2">
                                        <div className="w-1/4 h-full bg-[#141414] rounded" />
                                        <div className="flex-1 flex flex-col gap-2">
                                            <div className="h-2 w-1/3 bg-[#262626] rounded" />
                                            <div className="h-2 w-1/2 bg-[#1f1f1f] rounded" />
                                            <div className="flex-1 bg-[#141414] rounded mt-1" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Moon className={cn("w-5 h-5", theme === 'dark' ? "text-orange-500" : "text-gray-400")} />
                                    <span className={cn("font-medium", theme === 'dark' ? "text-orange-500" : "text-gray-100")}>Dark Mode</span>
                                </div>
                            </div>
                        </button>
                    </div>
                )}

                {/* Step 3: Skill Level Selection */}
                {step === 3 && !showQuiz && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-out]">
                        {SKILL_LEVELS.map((level) => {
                            const Icon = level.icon;
                            const isSelected = selectedSkillLevel === level.id;
                            const isQuiz = level.id === 'quiz';

                            return (
                                <button
                                    key={level.id}
                                    onClick={() => {
                                        if (isQuiz) {
                                            const questions = getRandomQuestions(5);
                                            setCurrentQuestions(questions);
                                            setShowQuiz(true);
                                            setQuizAnswers([]);
                                            setQuizScore(null);
                                        } else {
                                            setSelectedSkillLevel(level.id as any);
                                        }
                                    }}
                                    className={cn(
                                        "relative p-4 rounded-xl border-2 text-left transition-all duration-200 group hover:border-orange-500/50 hover:bg-[var(--bg-surface-hover)]",
                                        isSelected
                                            ? "border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/20"
                                            : "border-[var(--border-default)] bg-[var(--bg-surface)]"
                                    )}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            isSelected ? "bg-orange-500 text-white" : "bg-[var(--bg-canvas)] text-[var(--text-secondary)] group-hover:text-orange-500"
                                        )}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className={cn("font-medium mb-1", isSelected ? "text-orange-500" : "text-[var(--text-primary)]")}>
                                                {level.label}
                                            </h3>
                                            <p className="text-sm text-[var(--text-secondary)]">
                                                {level.description}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-4 right-4 text-orange-500">
                                                <Check className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Quiz Mode */}
                {step === 3 && showQuiz && (
                    <div className="animate-[fadeIn_0.3s_ease-out] bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-default)]">
                        {quizScore === null ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-medium text-lg text-[var(--text-primary)]">Coding Assessment</h3>
                                    <span className="text-sm text-[var(--text-secondary)]">
                                        {quizAnswers.filter(a => a !== undefined).length} / {currentQuestions.length}
                                    </span>
                                </div>
                                {currentQuestions.map((q, qIdx) => (
                                    <div key={qIdx} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <p className="font-medium text-[var(--text-primary)]">{qIdx + 1}. {q.question}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {q.options.map((opt, oIdx) => (
                                                <button
                                                    key={oIdx}
                                                    onClick={() => handleQuizOptionSelect(qIdx, oIdx)}
                                                    className={cn(
                                                        "px-4 py-2 text-sm rounded-lg border text-left transition-all duration-200",
                                                        quizAnswers[qIdx] === oIdx
                                                            ? "bg-orange-500 text-white border-orange-500 shadow-md scale-[1.02]"
                                                            : "border-[var(--border-default)] hover:bg-[var(--bg-canvas)] hover:border-orange-500/30"
                                                    )}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Brain className="w-12 h-12 text-orange-500 mx-auto mb-4 animate-bounce" />
                                <h3 className="text-xl font-bold mb-2 text-[var(--text-primary)]">Analyzing Results...</h3>
                                <p className="text-[var(--text-secondary)]">Score: {quizScore}/{currentQuestions.length}</p>
                                <div className="mt-4 h-1 w-24 bg-orange-500/20 rounded-full mx-auto overflow-hidden">
                                    <div className="h-full bg-orange-500 animate-[progress_1.5s_ease-in-out]" style={{ width: '100%' }} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="mt-10 flex justify-between items-center">
                    {step > 1 ? (
                        <Button variant="ghost" onClick={prevStep} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    ) : (
                        <div /> /* Spacer */
                    )}

                    {step < 3 ? (
                        <Button
                            onClick={nextStep}
                            disabled={step === 1 ? !selectedRole : false}
                            className="bg-orange-500 hover:bg-orange-600 text-white min-w-[120px]"
                        >
                            Continue
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleFinish}
                            isLoading={isSubmitting}
                            disabled={!selectedSkillLevel}
                            className="bg-orange-500 hover:bg-orange-600 text-white min-w-[120px]"
                        >
                            Finish Setup
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
