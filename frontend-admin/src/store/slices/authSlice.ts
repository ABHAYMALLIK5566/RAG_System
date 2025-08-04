import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, User, LoginRequest, LoginResponse, UserRole } from '@/types';
import { authApi } from '@/services/api';

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('admin_auth_token'),
  refreshToken: localStorage.getItem('admin_refresh_token'),
  isAuthenticated: !!localStorage.getItem('admin_auth_token'),
  isLoading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    console.log('Login action started with credentials:', credentials);
    try {
      console.log('Making API call to login...');
      const response = await authApi.login(credentials);
      console.log('Login API response:', response);
      
      // Check if user has admin panel access
      const userRole = response.user.role;
      const allowedRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ANALYST, UserRole.DEVELOPER];
      
      console.log('User role from response:', userRole);
      console.log('Allowed roles:', allowedRoles);
      
      if (!allowedRoles.includes(userRole)) {
        // Clear any tokens that might have been set
        localStorage.removeItem('admin_auth_token');
        localStorage.removeItem('admin_refresh_token');
        console.log('Access denied for role:', userRole);
        return rejectWithValue('Access denied. Admin panel requires admin, analyst, or developer privileges.');
      }
      
      console.log('Saving token in thunk:', response.access_token);
      localStorage.setItem('admin_auth_token', response.access_token);
      localStorage.setItem('admin_refresh_token', response.refresh_token);
      console.log('Tokens stored in localStorage (thunk)');
      return response;
    } catch (error: any) {
      console.error('Login API error:', error);
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
      localStorage.removeItem('admin_auth_token');
      localStorage.removeItem('admin_refresh_token');
    } catch (error: any) {
      console.error('Logout error:', error);
      return rejectWithValue('Logout failed');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: AuthState };
      const refreshToken = state.auth.refreshToken;
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authApi.refreshToken(refreshToken);
      localStorage.setItem('admin_auth_token', response.access_token);
      localStorage.setItem('admin_refresh_token', response.refresh_token);
      return response;
    } catch (error: any) {
      localStorage.removeItem('admin_auth_token');
      localStorage.removeItem('admin_refresh_token');
      return rejectWithValue('Token refresh failed');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getCurrentUser();
      
      // Check if user has admin panel access
      const userRole = response.role;
      const allowedRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ANALYST, UserRole.DEVELOPER];
      
      console.log('Current user role:', userRole);
      console.log('Allowed roles:', allowedRoles);
      
      if (!allowedRoles.includes(userRole)) {
        // Clear tokens and reject
        localStorage.removeItem('admin_auth_token');
        localStorage.removeItem('admin_refresh_token');
        console.log('Access denied for role:', userRole);
        return rejectWithValue('Access denied. Admin panel requires admin, analyst, or developer privileges.');
      }
      
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get user');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<LoginResponse>) => {
        console.log('Login fulfilled - updating state with:', action.payload);
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.error = null;
        console.log('Login fulfilled - saving token:', action.payload.access_token);
        localStorage.setItem('admin_auth_token', action.payload.access_token);
        localStorage.setItem('admin_refresh_token', action.payload.refresh_token);
        console.log('Tokens saved to localStorage in reducer');
        console.log('State updated - isAuthenticated:', state.isAuthenticated);
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      // Refresh Token
      .addCase(refreshToken.fulfilled, (state, action: PayloadAction<LoginResponse>) => {
        state.token = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(refreshToken.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      })
      // Get Current User
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, setUser, updateUser } = authSlice.actions;
export default authSlice.reducer; 