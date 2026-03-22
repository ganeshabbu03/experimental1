// Central API Client for Deexen
// Handles all HTTP requests with authentication, error handling, and retry logic

import { supabase } from './supabaseClient';
import { runtimeConfig } from '@/config/runtime';

interface ApiResponse<T> {
    data: T;
    success: boolean;
    message?: string;
}

interface ApiError {
    message: string;
    code?: string;
    status?: number;
}

class ApiClient {
    public baseUrl: string;

    constructor() {
        this.baseUrl = runtimeConfig.apiUrl;
    }

    private async getToken(): Promise<string | null> {
        // Get token from Supabase session (real auth)
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                return session.access_token;
            }
        } catch {
            // Supabase not available, fall through
        }

        // Fallback: check persisted auth store
        try {
            const stored = localStorage.getItem('deexen-auth-storage');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.state?.token) {
                    return parsed.state.token;
                }
            }
        } catch {
            // Parse error, ignore
        }

        return null;
    }

    private async getHeaders(): Promise<HeadersInit> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        const token = await this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    async get<T>(endpoint: string): Promise<T> {
        console.log(`[apiClient] Fetching GET ${endpoint}`);
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'GET',
                headers: await this.getHeaders(),
            });
            console.log(`[apiClient] GET ${endpoint} response status:`, response.status, response.type);
            return this.handleResponse<T>(response);
        } catch (e) {
            console.error(`[apiClient] network error on GET ${endpoint}:`, e);
            const message = e instanceof Error ? e.message : String(e);
            throw new Error(`Failed to reach API (${this.baseUrl}${endpoint}): ${message}`);
        }
    }

    async post<T>(endpoint: string, data?: unknown): Promise<T> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: await this.getHeaders(),
                body: data ? JSON.stringify(data) : undefined,
            });
            return this.handleResponse<T>(response);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            throw new Error(`Failed to reach API (${this.baseUrl}${endpoint}): ${message}`);
        }
    }

    async put<T>(endpoint: string, data?: unknown): Promise<T> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'PUT',
                headers: await this.getHeaders(),
                body: data ? JSON.stringify(data) : undefined,
            });
            return this.handleResponse<T>(response);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            throw new Error(`Failed to reach API (${this.baseUrl}${endpoint}): ${message}`);
        }
    }

    async delete<T>(endpoint: string): Promise<T> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'DELETE',
                headers: await this.getHeaders(),
            });
            return this.handleResponse<T>(response);
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            throw new Error(`Failed to reach API (${this.baseUrl}${endpoint}): ${message}`);
        }
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const error: ApiError = {
                message: 'Request failed',
                status: response.status,
            };

            try {
                const errorData = (await response.json()) as Record<string, unknown>;
                // FastAPI returns errors as {detail: "..."} 
                const candidateMessage =
                    errorData.detail ?? errorData.message ?? errorData.error;
                if (typeof candidateMessage === 'string' && candidateMessage.trim().length > 0) {
                    error.message = candidateMessage;
                } else {
                    error.message = 'Unknown error';
                }
                if (typeof errorData.code === 'string') {
                    error.code = errorData.code;
                }
            } catch {
                // Could not parse error response
            }

            if (response.status === 401) {
                // Sign out from Supabase (this will trigger onAuthStateChange in useAuthStore)
                try { await supabase.auth.signOut(); } catch { /* ignore */ }

                // Optional: dispatch a custom event if you need other components to react immediately
                window.dispatchEvent(new Event('deexen-auth-expired'));
            }

            throw error;
        }

        try {
            const data = await response.json();
            return data;
        } catch (e) {
            console.error(`[apiClient] Failed to parse JSON from response:`, e);
            throw e;
        }
    }

    isMockMode(): boolean {
        // Mock mode is now permanently disabled — always use real API
        return false;
    }
}

export const apiClient = new ApiClient();
export type { ApiResponse, ApiError };
