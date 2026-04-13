import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, type User } from '@/services/authService';
import { supabase } from '@/services/supabaseClient';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isInitializing: boolean;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; emailConfirmationRequired: boolean }>;
    logout: () => void;
    initialize: () => void;
    clearError: () => void;
    updateUser: (updates: Partial<User>) => void;
}

function mapSupabaseUser(supaUser: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string }, accessToken: string) {
    const avatarUrl = supaUser.user_metadata?.avatar_url || undefined;
    const user: User = {
        id: supaUser.id,
        name: supaUser.user_metadata?.name || supaUser.user_metadata?.full_name || supaUser.email?.split('@')[0] || 'User',
        email: supaUser.email || '',
        avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(supaUser.email || 'U')}&background=ea580c&color=fff`,
        avatar_url: avatarUrl,
        joinDate: new Date(supaUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        lastActive: 'Just now',
        onboardingCompleted: true,
    };
    return { user, token: accessToken };
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isInitializing: true, // Start as true — we need to check Supabase session first
            isLoading: false,
            error: null,

            initialize: () => {
                // 1. Check for an existing Supabase session (handles OAuth redirects)
                supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string }; access_token: string } | null } }) => {
                    if (session?.user && session?.access_token) {
                        const { user, token } = mapSupabaseUser(session.user, session.access_token);
                        set({
                            user,
                            token,
                            isAuthenticated: true,
                            isInitializing: false,
                        });
                    } else {
                        // No Supabase session — rely on persisted Zustand state
                        set({ isInitializing: false });
                    }
                }).catch(() => {
                    set({ isInitializing: false });
                });

                // 2. Listen for future auth state changes (token refresh, sign-out, etc.)
                supabase.auth.onAuthStateChange((_event: string, session: { user: { id: string; email?: string; user_metadata?: Record<string, string>; created_at: string }; access_token: string } | null) => {
                    if (session?.user && session?.access_token) {
                        const { user, token } = mapSupabaseUser(session.user, session.access_token);
                        set({
                            user,
                            token,
                            isAuthenticated: true,
                            isInitializing: false,
                        });
                    } else if (_event === 'SIGNED_OUT') {
                        set({
                            user: null,
                            token: null,
                            isAuthenticated: false,
                            isInitializing: false,
                        });
                    }
                });
            },

            login: async (email, password) => {
                set({ isLoading: true, error: null });

                try {
                    console.log(`[useAuthStore] Attempting Supabase login for ${email}...`);
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) {
                        console.error(`[useAuthStore] Supabase login error:`, error.message, error.status);
                        throw error;
                    }
                    if (!data.user || !data.session) throw new Error('Login failed: No session data returned');

                    console.log(`[useAuthStore] Supabase login successful for ${email}`);
                    const { user, token } = mapSupabaseUser(data.user, data.session.access_token);
                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : 'Login failed';
                    console.error(`[useAuthStore] Login catch block:`, message);
                    set({ error: message, isLoading: false });
                    throw err;
                }
            },

            register: async (name, email, password) => {
                set({ isLoading: true, error: null });

                try {
                    console.log(`[useAuthStore] Attempting Supabase signup for ${email}...`);
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: { 
                            data: { name, full_name: name },
                            emailRedirectTo: `${window.location.origin}/dashboard`
                        },
                    });

                    if (error) {
                        console.error(`[useAuthStore] Supabase signup error:`, error.message, error.status);
                        set({ error: error.message, isLoading: false });
                        throw error;
                    }

                    if (!data.user) {
                        const noUserError = new Error('Registration failed: No user data returned');
                        set({ error: noUserError.message, isLoading: false });
                        throw noUserError;
                    }

                    console.log(`[useAuthStore] Supabase signup successful for ${email}`);
                    
                    if (data.session) {
                        const { user, token } = mapSupabaseUser(data.user, data.session.access_token);
                        set({
                            user,
                            token,
                            isAuthenticated: true,
                            isLoading: false,
                        });
                        return { success: true, emailConfirmationRequired: false };
                    } else {
                        console.log(`[useAuthStore] Email confirmation required for ${email}`);
                        set({ isLoading: false });
                        return { success: true, emailConfirmationRequired: true };
                    }
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Registration failed';
                    console.error(`[useAuthStore] Register catch block:`, message);
                    set({ error: message, isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                authService.logout();
                supabase.auth.signOut();
                set({ user: null, token: null, isAuthenticated: false, error: null });
            },

            updateUser: (updates) => {
                set((state) => {
                    if (!state.user) return state;
                    const updatedUser = { ...state.user, ...updates };
                    return { user: updatedUser };
                });
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'deexen-auth-storage',
            partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);
