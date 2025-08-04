import axios from 'axios';

// Get API base URL from runtime configuration
const getApiBaseUrl = () => {
  // Try to get from runtime config first
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    return window.APP_CONFIG.API_BASE_URL
  }
  // Fallback to environment variable
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}

const API_BASE_URL = `${getApiBaseUrl()}/api/v1`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('admin_auth_token');
      localStorage.removeItem('admin_refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient; 