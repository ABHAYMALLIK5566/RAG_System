import axios from 'axios'
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// Get API base URL from runtime configuration
const getApiBaseUrl = () => {
  // Try to get from runtime config first
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    console.log('Using runtime config:', window.APP_CONFIG.API_BASE_URL)
    return window.APP_CONFIG.API_BASE_URL
  }
  // Fallback to environment variable
  console.log('Using environment variable:', import.meta.env.VITE_API_BASE_URL)
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
}

const API_BASE_URL = getApiBaseUrl()
console.log('Final API Base URL:', API_BASE_URL)

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies if needed
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    console.log('Making API request to:', config.url, 'Method:', config.method)
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('Added auth token to request')
    } else {
      console.warn('No auth token found in localStorage')
    }
    return config
  },
  (error) => {
    console.error('API request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => {
    console.log('API response:', response.status, response.config.url, response.config.method)
    return response
  },
  (error) => {
    console.error('API response error:', error.response?.status, error.response?.data, error.response?.config?.url)
    if (error.response?.status === 401) {
      console.log('Unauthorized - redirecting to login')
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// RTK Query API
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/v1`,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('token')
      if (token) {
        headers.set('authorization', `Bearer ${token}`)
      }
      return headers
    },
  }),
  tagTypes: ['Chat', 'Documents', 'User', 'UserSettings', 'Analytics'],
  endpoints: (builder) => ({
    // Chat endpoints
    getChatSessions: builder.query({
      query: () => '/chat/sessions',
      providesTags: ['Chat'],
    }),
    getChatSession: builder.query({
      query: (sessionId: string) => `/chat/sessions/${sessionId}`,
      providesTags: (_result, _error, sessionId) => [{ type: 'Chat', id: sessionId }],
    }),
    getChatMessages: builder.query({
      query: (sessionId: string) => `/chat/sessions/${sessionId}/messages`,
      providesTags: (_result, _error, sessionId) => [{ type: 'Chat', id: sessionId }],
    }),
    createChatSession: builder.mutation({
      query: (title: string) => ({
        url: '/chat/sessions',
        method: 'POST',
        body: { title },
      }),
      invalidatesTags: ['Chat'],
    }),
    sendChatMessage: builder.mutation({
      query: ({ sessionId, content, stream = false }) => ({
        url: `/chat/sessions/${sessionId}/messages`,
        method: 'POST',
        body: { content, stream },
      }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: 'Chat', id: sessionId }],
    }),
    deleteChatSession: builder.mutation({
      query: (sessionId: string) => ({
        url: `/chat/sessions/${sessionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Chat'],
    }),
    // Document endpoints
    getDocuments: builder.query({
      query: (params) => ({
        url: '/rag/documents',
        params,
      }),
      providesTags: ['Documents'],
    }),
    searchDocuments: builder.query({
      query: (query: string) => ({
        url: '/rag/search',
        params: { q: query },
      }),
      providesTags: ['Documents'],
    }),
    uploadDocument: builder.mutation({
      query: (file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        return {
          url: '/upload/file',
          method: 'POST',
          body: formData,
        }
      },
      invalidatesTags: ['Documents'],
    }),
    deleteDocument: builder.mutation({
      query: (documentId: string) => ({
        url: `/rag/documents/${documentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Documents'],
    }),
    // User endpoints
    getCurrentUser: builder.query({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),
    updateProfile: builder.mutation({
      query: (profile) => ({
        url: '/auth/profile',
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['User'],
    }),
    // User Settings endpoints
    getUserSettings: builder.query({
      query: () => '/settings/user',
      providesTags: ['UserSettings'],
    }),
    updateUserSettings: builder.mutation({
      query: (settings) => ({
        url: '/settings/user',
        method: 'PUT',
        body: settings,
      }),
      invalidatesTags: ['UserSettings'],
    }),
    resetUserSettings: builder.mutation({
      query: () => ({
        url: '/settings/user/reset',
        method: 'POST',
      }),
      invalidatesTags: ['UserSettings'],
    }),
    // Analytics endpoints
    getUserAnalytics: builder.query({
      query: (timeRange: string = '7d') => ({
        url: '/analytics/user/overview',
        params: { time_range: timeRange },
      }),
      providesTags: ['Analytics'],
    }),
    getUserPerformance: builder.query({
      query: (timeRange: string = '7d') => ({
        url: '/analytics/user/performance',
        params: { time_range: timeRange },
      }),
      providesTags: ['Analytics'],
    }),
    getUserTrends: builder.query({
      query: (timeRange: string = '7d') => ({
        url: '/analytics/user/trends',
        params: { time_range: timeRange },
      }),
      providesTags: ['Analytics'],
    }),
  }),
})

export const {
  useGetChatSessionsQuery,
  useGetChatSessionQuery,
  useGetChatMessagesQuery,
  useCreateChatSessionMutation,
  useSendChatMessageMutation,
  useDeleteChatSessionMutation,
  useGetDocumentsQuery,
  useSearchDocumentsQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
  useGetCurrentUserQuery,
  useUpdateProfileMutation,
  useGetUserSettingsQuery,
  useUpdateUserSettingsMutation,
  useResetUserSettingsMutation,
  useGetUserAnalyticsQuery,
  useGetUserPerformanceQuery,
  useGetUserTrendsQuery,
} = api

export default apiClient 