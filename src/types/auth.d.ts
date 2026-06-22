// TypeScript types for authentication

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  status: 'active' | 'inactive' | 'suspended';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'manager' | 'member';
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateUserRequest {
  role?: 'admin' | 'manager' | 'member';
  status?: 'active' | 'inactive' | 'suspended';
}

export interface PaginatedUsers {
  users: AuthUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: AuthUser | AuthTokens;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: AuthUser;
    accessToken: string;
  };
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    user: AuthUser;
  };
}
