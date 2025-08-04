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
  login_attempts: number;
  locked_until?: string;
  require_password_change: boolean;
  session_timeout: number;
  allowed_ips?: string[];
  metadata?: Record<string, any>;
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  ANALYST = 'analyst',
  USER = 'user',
  READONLY = 'readonly'
}

// Document Types
export interface Document {
  id: string;
  title: string;
  description?: string;
  category?: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  content?: string;
  source?: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  similarity_score?: number;
  created_at: string;
  updated_at: string;
  processed_at?: string;
}



// API Key Types
export interface ApiKey {
  id: string;
  key: string;
  name: string;
  description?: string;
  role: string;
  permissions: string[];
  allowed_ips?: string[];
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  last_used?: string;
  usage_count: number;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  created_by?: string;
  metadata?: Record<string, any>;
}

// Security Event Types
export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_id?: string;
  api_key_id?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
  method?: string;
  status_code?: number;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
}

// Query Analytics Types
export interface QueryAnalytics {
  id: number;
  timestamp: string;
  user_id?: string;
  session_id?: string;
  query_text: string;
  algorithm_used?: string;
  response_time_ms: number;
  result_count: number;
  success: boolean;
  error_message?: string;
  metadata?: Record<string, any>;
}

// Notification Types
export interface Notification {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
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

// Dashboard Types
export interface DashboardStats {
  total_users: number;
  total_documents: number;
  total_queries: number;
  active_sessions: number;
  system_health: 'healthy' | 'warning' | 'critical';
  recent_activity: ActivityItem[];
  performance_metrics?: Record<string, any>;
  query_trends?: Array<Record<string, any>>;
  users_growth_percent?: number;
  documents_growth_percent?: number;
  queries_growth_percent?: number;
}

export interface ActivityItem {
  id: string;
  type: 'user_login' | 'document_upload' | 'query_executed' | 'security_event';
  user_id?: string;
  description: string;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

// Chart Data Types
export interface ChartData {
  name: string;
  value: number;
  date?: string;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

// Form Types
export interface CreateUserRequest {
  username: string;
  email: string;
  full_name?: string;
  role: UserRole;
  password: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  session_timeout?: number;
  allowed_ips?: string[];
}

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  role: UserRole;
  permissions: string[];
  allowed_ips?: string[];
  expires_at?: string;
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
}

// Filter and Search Types
export interface FilterOptions {
  search?: string;
  role?: UserRole;
  status?: 'active' | 'inactive';
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface RealTimeStats {
  active_users: number;
  current_queries: number;
  system_load: number;
  memory_usage: number;
  cpu_usage: number;
} 