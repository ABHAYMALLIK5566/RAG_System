import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { 
  LoginRequest, 
  LoginResponse, 
  User, 
  Document, 
  ApiKey,
  SecurityEvent,
  QueryAnalytics,
  Notification,
  DashboardStats,
  PaginatedResponse,
  CreateUserRequest,
  UpdateUserRequest,
  CreateApiKeyRequest,
  FilterOptions
} from '@/types';

// Get API base URL from runtime configuration
const getApiBaseUrl = () => {
  // Try to get from runtime config first
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    return window.APP_CONFIG.API_BASE_URL
  }
  // Fallback to environment variable
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}

const API_BASE_URL = getApiBaseUrl()

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token') || localStorage.getItem('admin_auth_token');
    console.log('API Interceptor: token =', token); // Debug log
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token') || localStorage.getItem('admin_refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token, refresh_token } = response.data;
          localStorage.setItem('token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('admin_auth_token');
        localStorage.removeItem('admin_refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    console.log('Making login API call with credentials:', credentials);
    console.log('API base URL:', API_BASE_URL);
    // Add a small delay to ensure config is loaded
    await new Promise(resolve => setTimeout(resolve, 100));
    // Use the token endpoint which is more reliable
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    const tokenResponse = await api.post('/auth/token', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    console.log('Token response:', tokenResponse.data);
    // Save the token immediately so the interceptor can use it for /auth/me
    localStorage.setItem('admin_auth_token', tokenResponse.data.access_token);
    localStorage.setItem('admin_refresh_token', tokenResponse.data.refresh_token || '');
    // Get user info separately
    const userResponse = await api.get('/auth/me');
    const user = userResponse.data;
    // Construct LoginResponse format
    const loginResponse: LoginResponse = {
      access_token: tokenResponse.data.access_token,
      refresh_token: tokenResponse.data.refresh_token || '',
      token_type: tokenResponse.data.token_type || 'bearer',
      expires_in: tokenResponse.data.expires_in || 1800,
      user: user
    };
    console.log('Login API response:', loginResponse);
    return loginResponse;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  refreshToken: async (refreshToken: string): Promise<LoginResponse> => {
    const response: AxiosResponse<LoginResponse> = await api.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response: AxiosResponse<User> = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },
};

// Users API
export const usersApi = {
  getUsers: async (filters?: FilterOptions): Promise<PaginatedResponse<User>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response: AxiosResponse<PaginatedResponse<User>> = await api.get(`/admin/users?${params}`);
    return response.data;
  },

  getUser: async (id: string): Promise<User> => {
    const response: AxiosResponse<User> = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  createUser: async (userData: CreateUserRequest): Promise<User> => {
    const response: AxiosResponse<User> = await api.post('/admin/users', userData);
    return response.data;
  },

  updateUser: async (id: string, userData: UpdateUserRequest): Promise<User> => {
    const response: AxiosResponse<User> = await api.put(`/admin/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/admin/users/${id}`);
  },

  activateUser: async (id: string): Promise<void> => {
    await api.post(`/admin/users/${id}/activate`);
  },

  deactivateUser: async (id: string): Promise<void> => {
    await api.post(`/admin/users/${id}/deactivate`);
  },
};

// Documents API
export const documentsApi = {
  getDocuments: async (filters?: FilterOptions): Promise<PaginatedResponse<Document>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response: AxiosResponse<PaginatedResponse<Document>> = await api.get(`/rag/documents?${params}`);
    return response.data;
  },

  getDocument: async (id: number): Promise<Document> => {
    const response: AxiosResponse<Document> = await api.get(`/rag/documents/${id}`);
    return response.data;
  },

  deleteDocument: async (id: number): Promise<void> => {
    await api.delete(`/rag/documents/${id}`);
  },

  uploadDocument: async (file: File, metadata?: Record<string, any>): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    
    const response: AxiosResponse<Document> = await api.post('/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  bulkUpload: async (files: File[]): Promise<Document[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    const response: AxiosResponse<Document[]> = await api.post('/upload/files/bulk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// API Keys API
export const apiKeysApi = {
  getApiKeys: async (filters?: FilterOptions): Promise<PaginatedResponse<ApiKey>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response: AxiosResponse<PaginatedResponse<ApiKey>> = await api.get(`/admin/api-keys?${params}`);
    return response.data;
  },

  createApiKey: async (apiKeyData: CreateApiKeyRequest): Promise<ApiKey> => {
    const response: AxiosResponse<ApiKey> = await api.post('/admin/api-keys', apiKeyData);
    return response.data;
  },

  deleteApiKey: async (id: string): Promise<void> => {
    await api.delete(`/admin/api-keys/${id}`);
  },

  deactivateApiKey: async (id: string): Promise<void> => {
    await api.post(`/admin/api-keys/${id}/deactivate`);
  },
};

// Security Events API
export const securityApi = {
  getSecurityEvents: async (filters?: FilterOptions): Promise<PaginatedResponse<SecurityEvent>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response: AxiosResponse<PaginatedResponse<SecurityEvent>> = await api.get(`/admin/security-events?${params}`);
    return response.data;
  },

  resolveSecurityEvent: async (id: string): Promise<void> => {
    await api.post(`/admin/security-events/${id}/resolve`);
  },
};

// Analytics API
export const analyticsApi = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response: AxiosResponse<DashboardStats> = await api.get('/admin/analytics/dashboard');
    return response.data;
  },

  getQueryAnalytics: async (filters?: FilterOptions): Promise<PaginatedResponse<QueryAnalytics>> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response: AxiosResponse<PaginatedResponse<QueryAnalytics>> = await api.get(`/admin/analytics/queries?${params}`);
    return response.data;
  },

  getSystemHealth: async (): Promise<any> => {
    const response: AxiosResponse<any> = await api.get('/admin/health');
    return response.data;
  },
};

// Notifications API
export const notificationsApi = {
  getNotifications: async (): Promise<Notification[]> => {
    const response: AxiosResponse<Notification[]> = await api.get('/notifications');
    return response.data;
  },

  markAsRead: async (id: number): Promise<void> => {
    await api.post(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await api.post('/notifications/read-all');
  },
};

export default api; 