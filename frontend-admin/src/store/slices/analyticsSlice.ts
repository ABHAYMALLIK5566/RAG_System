import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { DashboardStats, QueryAnalytics, PaginatedResponse, FilterOptions } from '@/types';
import { analyticsApi } from '@/services/api';

interface AnalyticsState {
  dashboardStats: DashboardStats | null;
  queryAnalytics: QueryAnalytics[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: AnalyticsState = {
  dashboardStats: null,
  queryAnalytics: [],
  total: 0,
  page: 1,
  limit: 10,
  total_pages: 0,
  isLoading: false,
  error: null,
};

export const fetchDashboardStats = createAsyncThunk(
  'analytics/fetchDashboardStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await analyticsApi.getDashboardStats();
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard stats');
    }
  }
);

export const fetchQueryAnalytics = createAsyncThunk(
  'analytics/fetchQueryAnalytics',
  async (filters: FilterOptions | undefined, { rejectWithValue }) => {
    try {
      const response = await analyticsApi.getQueryAnalytics(filters);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch query analytics');
    }
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Dashboard Stats
      .addCase(fetchDashboardStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action: PayloadAction<DashboardStats>) => {
        state.isLoading = false;
        state.dashboardStats = action.payload;
        state.error = null;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch Query Analytics
      .addCase(fetchQueryAnalytics.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchQueryAnalytics.fulfilled, (state, action: PayloadAction<PaginatedResponse<QueryAnalytics>>) => {
        state.isLoading = false;
        state.queryAnalytics = action.payload.data;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
        state.total_pages = action.payload.total_pages;
        state.error = null;
      })
      .addCase(fetchQueryAnalytics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError } = analyticsSlice.actions;
export default analyticsSlice.reducer; 