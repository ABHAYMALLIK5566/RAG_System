import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ApiKey } from '@/types';
import { apiClient } from '@/services/apiClient';

interface ApiKeysState {
  apiKeys: ApiKey[];
  isLoading: boolean;
  error: string | null;
}

const initialState: ApiKeysState = {
  apiKeys: [],
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchApiKeys = createAsyncThunk(
  'apiKeys/fetchApiKeys',
  async () => {
    const response = await apiClient.get('/admin/api-keys');
    return response.data;
  }
);

export const createApiKey = createAsyncThunk(
  'apiKeys/createApiKey',
  async (apiKeyData: {
    name: string;
    description: string;
    role: string;
    permissions: string[];
    expires_at: string;
  }) => {
    const response = await apiClient.post('/admin/api-keys', apiKeyData);
    return response.data;
  }
);

export const deleteApiKey = createAsyncThunk(
  'apiKeys/deleteApiKey',
  async (keyId: string) => {
    await apiClient.delete(`/admin/api-keys/${keyId}`);
    return keyId;
  }
);

export const regenerateApiKey = createAsyncThunk(
  'apiKeys/regenerateApiKey',
  async (keyId: string) => {
    const response = await apiClient.post(`/admin/api-keys/${keyId}/regenerate`);
    return response.data;
  }
);

const apiKeysSlice = createSlice({
  name: 'apiKeys',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch API keys
      .addCase(fetchApiKeys.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchApiKeys.fulfilled, (state, action) => {
        state.isLoading = false;
        // Handle both direct array and paginated response
        if (Array.isArray(action.payload)) {
          state.apiKeys = action.payload;
        } else if (action.payload && action.payload.items) {
          state.apiKeys = action.payload.items;
        } else {
          state.apiKeys = [];
        }
      })
      .addCase(fetchApiKeys.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch API keys';
      })
      // Create API key
      .addCase(createApiKey.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createApiKey.fulfilled, (state, action) => {
        state.isLoading = false;
        state.apiKeys.push(action.payload);
      })
      .addCase(createApiKey.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create API key';
      })
      // Delete API key
      .addCase(deleteApiKey.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteApiKey.fulfilled, (state, action) => {
        state.isLoading = false;
        state.apiKeys = state.apiKeys.filter(key => key.id !== action.payload);
      })
      .addCase(deleteApiKey.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete API key';
      })
      // Regenerate API key
      .addCase(regenerateApiKey.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(regenerateApiKey.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.apiKeys.findIndex(key => key.id === action.payload.id);
        if (index !== -1) {
          state.apiKeys[index] = action.payload;
        }
      })
      .addCase(regenerateApiKey.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to regenerate API key';
      });
  },
});

export const { clearError } = apiKeysSlice.actions;
export default apiKeysSlice.reducer; 