// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  metadata?: Record<string, any>;
}

export enum UserRole {
  USER = 'user',
  READONLY = 'readonly'
}

// Conversation Types
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
  is_active: boolean;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    algorithm_used?: string;
    sources?: DocumentSource[];
    response_time?: number;
    tokens_used?: number;
    model_used?: string;
  };
}

export interface DocumentSource {
  id: number;
  title?: string;
  content: string;
  source?: string;
  similarity_score?: number;
  page_number?: number;
}

// Query Types
export interface QueryRequest {
  query: string;
  algorithm?: 'semantic' | 'keyword' | 'hybrid' | 'fuzzy' | 'contextual';
  agent_type?: 'general' | 'specialized' | 'creative';
  top_k?: number;
  similarity_threshold?: number;
  stream?: boolean;
  conversation_id?: string;
}

export interface QueryResponse {
  response: string;
  sources: DocumentSource[];
  metadata: {
    algorithm_used: string;
    response_time: number;
    tokens_used: number;
    model_used: string;
    confidence_score: number;
  };
}

export interface StreamingQueryResponse {
  type: 'content' | 'source' | 'metadata' | 'error';
  data: any;
  conversation_id?: string;
  message_id?: string;
}

// Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
  remember_me?: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Chat Interface Types
export interface ChatTab {
  id: string;
  title: string;
  conversation_id?: string;
  is_active: boolean;
  has_unsaved_changes: boolean;
}

export interface ChatState {
  tabs: ChatTab[];
  active_tab_id: string | null;
  conversations: Record<string, Conversation>;
  isLoading: boolean;
  error: string | null;
}

// Query Settings Types
export interface QuerySettings {
  algorithm: 'semantic' | 'keyword' | 'hybrid' | 'fuzzy' | 'contextual';
  agent_type: 'general' | 'specialized' | 'creative';
  top_k: number;
  similarity_threshold: number;
  temperature: number;
  max_tokens: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Notification Types
export interface Notification {
  id: number;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

// File Upload Types
export interface UploadProgress {
  file_id: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

// Search Types
export interface SearchFilters {
  date_from?: string;
  date_to?: string;
  algorithm?: string;
  agent_type?: string;
  min_confidence?: number;
  max_confidence?: number;
}

// Analytics Types
export interface AnalyticsTimeRange {
  start_date: string;
  end_date: string;
}

export interface QueryStatistics {
  total_queries: number;
  successful_queries: number;
  failed_queries: number;
  success_rate: number;
  avg_response_time: number;
  total_response_time: number;
  unique_sessions: number;
}

export interface UsageTrend {
  date: string;
  queries: number;
  avg_response_time: number;
  success_rate: number;
}

export interface QueryTypeDistribution {
  query_type: string;
  count: number;
  percentage: number;
  avg_response_time: number;
}

export interface PerformanceMetrics {
  response_time_buckets: Record<string, number>;
  hourly_usage: Array<Record<string, any>>;
  daily_usage: Array<Record<string, any>>;
  weekly_usage: Array<Record<string, any>>;
}

export interface UserAnalyticsResponse {
  user_id: string;
  username: string;
  time_range: AnalyticsTimeRange;
  statistics: QueryStatistics;
  trends: UsageTrend[];
  query_types: QueryTypeDistribution[];
  performance: PerformanceMetrics;
  recent_activity: Array<Record<string, any>>;
}

export interface PerformanceMetricsResponse {
  avg_response_time: number;
  median_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  min_response_time: number;
  max_response_time: number;
  response_time_distribution: Record<string, number>;
  hourly_performance: Array<Record<string, any>>;
}

export interface UsageTrendsResponse {
  interval: string;
  time_range: string;
  trends: Array<{
    time_bucket: string;
    query_count: number;
    avg_response_time: number;
    success_rate: number;
    successful_queries: number;
  }>;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface RealTimeUpdate {
  type: 'query_progress' | 'system_status' | 'notification';
  data: any;
}

// UI State Types
export interface UIState {
  sidebar_open: boolean;
  theme: 'light' | 'dark' | 'auto';
  layout: 'default' | 'compact' | 'wide';
  show_sources: boolean;
  show_metadata: boolean;
  auto_save: boolean;
  notifications_enabled: boolean;
}

// Form Types
export interface UpdateProfileRequest {
  full_name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

// Error Types
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

// Settings Types
export interface UserSettings {
  query_settings: QuerySettings;
  ui_settings: UIState;
  notification_settings: {
    email_notifications: boolean;
    push_notifications: boolean;
    sound_enabled: boolean;
  };
  privacy_settings: {
    save_query_history: boolean;
    share_analytics: boolean;
    auto_save_conversations: boolean;
  };
} 