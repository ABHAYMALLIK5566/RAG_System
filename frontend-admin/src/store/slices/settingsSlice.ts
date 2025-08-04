import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@/services/apiClient';

export interface SystemSettings {
  // System Settings
  maintenance_mode: boolean;
  debug_mode: boolean;
  log_level: string;
  
  // Security Settings
  enable_rate_limiting: boolean;
  enable_ip_blocking: boolean;
  session_timeout: number;
  max_login_attempts: number;
  
  // Notification Settings
  email_notifications: boolean;
  slack_notifications: boolean;
  webhook_notifications: boolean;
  
  // Storage Settings
  max_file_size: number;
  allowed_file_types: string[];
  enable_compression: boolean;
  
  // RAG Settings
  rag_top_k: number;
  rag_similarity_threshold: number;
  rag_max_tokens: number;
  
  // Cache Settings
  cache_ttl_seconds: number;
  cache_max_query_length: number;
}

export interface SettingsState {
  settings: SystemSettings | null;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
}

const initialState: SettingsState = {
  settings: null,
  isLoading: false,
  error: null,
  isSaving: false,
  saveError: null,
};

// Async thunks
export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async () => {
    const response = await apiClient.get('/settings');
    return response.data.settings;
  }
);

export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (settings: SystemSettings) => {
    const response = await apiClient.put('/settings', settings);
    return response.data.settings;
  }
);

export const resetSettings = createAsyncThunk(
  'settings/resetSettings',
  async () => {
    const response = await apiClient.post('/settings/reset');
    return response.data.settings;
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.saveError = null;
    },
    updateLocalSetting: (state, action) => {
      const { key, value } = action.payload;
      if (state.settings) {
        (state.settings as any)[key] = value;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch settings
      .addCase(fetchSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.settings = action.payload;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch settings';
      })
      // Update settings
      .addCase(updateSettings.pending, (state) => {
        state.isSaving = true;
        state.saveError = null;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.isSaving = false;
        state.settings = action.payload;
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.isSaving = false;
        state.saveError = action.error.message || 'Failed to update settings';
      })
      // Reset settings
      .addCase(resetSettings.pending, (state) => {
        state.isSaving = true;
        state.saveError = null;
      })
      .addCase(resetSettings.fulfilled, (state, action) => {
        state.isSaving = false;
        state.settings = action.payload;
      })
      .addCase(resetSettings.rejected, (state, action) => {
        state.isSaving = false;
        state.saveError = action.error.message || 'Failed to reset settings';
      });
  },
});

export const { clearError, updateLocalSetting } = settingsSlice.actions;
export default settingsSlice.reducer; 