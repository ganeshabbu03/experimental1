// Authentication Service
// Handles login, logout, registration, and user data

import { apiClient } from './apiClient';

export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    joinDate?: string;
    lastActive?: string;
    projectCount?: number;
    role?: string;
    onboardingCompleted?: boolean;
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    bio?: string;
    location?: string;
    website?: string;
}

interface LoginResponse {
    user: User;
    token: string;
}

interface RegisterRequest {
    name: string;
    email: string;
    password: string;
}

// Backend response shape (from FastAPI TokenResponse)
interface BackendTokenResponse {
    access_token: string;
    token_type: string;
    user: {
        id: number;
        email: string;
        name: string;
        is_active: boolean;
        created_at: string;
    };
}

function mapBackendUser(bu: BackendTokenResponse['user']): User {
    return {
        id: String(bu.id),
        name: bu.name,
        email: bu.email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(bu.name)}&background=ea580c&color=fff`,
        joinDate: new Date(bu.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        lastActive: 'Just now',
        projectCount: 0,
        onboardingCompleted: false,
    };
}

class AuthService {
    async login(email: string, password: string): Promise<LoginResponse> {
        const response = await apiClient.post<BackendTokenResponse>('/auth/login', { email, password });
        return {
            token: response.access_token,
            user: mapBackendUser(response.user),
        };
    }

    async register(data: RegisterRequest): Promise<LoginResponse> {
        const response = await apiClient.post<BackendTokenResponse>('/auth/register', data);
        return {
            token: response.access_token,
            user: mapBackendUser(response.user),
        };
    }

    async logout(): Promise<void> {
        try {
            await apiClient.post('/auth/logout');
        } catch {
            // Ignore logout errors
        }

        localStorage.removeItem('deexen_token');
        localStorage.removeItem('deexen_user');
    }

    async getProfile(): Promise<User> {
        return apiClient.get<User>('/profile');
    }

    async updateProfile(data: Partial<User>): Promise<User> {
        return apiClient.put<User>('/profile', data);
    }
}

export const authService = new AuthService();
