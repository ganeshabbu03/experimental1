import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { supabase } from '@/services/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [formError, setFormError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login, initialize, isAuthenticated } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        initialize();
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [initialize, isAuthenticated, navigate]);

    const validateEmail = (val: string) => {
        if (!val) { setEmailError(''); return false; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) { setEmailError('Please enter a valid email'); return false; }
        setEmailError(''); return true;
    };

    const validatePassword = (val: string) => {
        if (!val) { setPasswordError(''); return false; }
        if (val.length < 6) { setPasswordError('Password must be at least 6 characters'); return false; }
        setPasswordError(''); return true;
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value; setEmail(val); validateEmail(val); setFormError('');
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value; setPassword(val); validatePassword(val); setFormError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateEmail(email) || !validatePassword(password)) return;
        setIsLoading(true); setFormError('');
        try { await login(email, password); navigate('/dashboard'); }
        catch { setFormError('Failed to login. Please check your credentials.'); }
        finally { setIsLoading(false); }
    };

    const handleOAuthLogin = async (provider: 'github' | 'google') => {
        setFormError('');
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/dashboard`,
            },
        });
        if (error) {
            setFormError(`OAuth login failed: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[var(--bg-canvas)] flex items-center justify-center font-sans">
            <div className="w-full max-w-[360px] px-6">
                {/* Logo */}
                <div className="flex items-center justify-center mb-10">
                    <img src="/deexen_full_logo.png" alt="Deexen AI" className="h-20 w-auto object-contain" />
                </div>

                {/* Form */}
                <div className="space-y-6">
                    <div className="text-center">
                        <h1 className="text-[var(--text-primary)] text-xl font-medium">Sign in</h1>
                        <p className="text-[var(--text-secondary)] text-sm mt-1">Continue to your workspace</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        {formError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center rounded">
                                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                                {formError}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div>
                                <label htmlFor="email" className="block text-sm text-[var(--text-secondary)] mb-1.5">
                                    Email
                                </label>
                                <div className="relative">
                                    <Input
                                        id="email"
                                        type="email"
                                        required
                                        placeholder="you@example.com"
                                        className={`w-full h-10 px-3 bg-[var(--bg-surface)] border-[var(--border-default)] rounded text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-colors ${emailError ? 'border-red-500/50' : ''}`}
                                        value={email}
                                        onChange={handleEmailChange}
                                    />
                                    {email && !emailError && (
                                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                                    )}
                                </div>
                                {emailError && <p className="mt-1 text-xs text-red-400">{emailError}</p>}
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label htmlFor="password" className="text-sm text-[var(--text-secondary)]">
                                        Password
                                    </label>
                                    <a href="#" className="text-xs text-[var(--text-secondary)] hover:text-orange-500 transition-colors">
                                        Forgot?
                                    </a>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className={`w-full h-10 px-3 bg-[var(--bg-surface)] border-[var(--border-default)] rounded text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)] focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-colors ${passwordError ? 'border-red-500/50' : ''}`}
                                    value={password}
                                    onChange={handlePasswordChange}
                                />
                                {passwordError && <p className="mt-1 text-xs text-red-400">{passwordError}</p>}
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded transition-colors"
                            isLoading={isLoading}
                            disabled={!!emailError || !!passwordError || !email || !password}
                        >
                            Continue
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-[var(--border-default)]" />
                        <span className="text-xs text-[var(--text-secondary)]">or</span>
                        <div className="flex-1 h-px bg-[var(--border-default)]" />
                    </div>

                    {/* Social */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleOAuthLogin('github')}
                            className="h-10 flex items-center justify-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-muted)] transition-colors"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                            GitHub
                        </button>
                        <button
                            onClick={() => handleOAuthLogin('google')}
                            className="h-10 flex items-center justify-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-muted)] transition-colors"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                            Google
                        </button>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-sm text-[var(--text-secondary)]">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-orange-500 hover:underline">Sign up</Link>
                    </p>
                </div>


            </div>
        </div>
    );
}
