import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { User, UserRole } from '@/types';
import { apiClient } from '@/services/apiClient';

interface UsersState {
  users: User[];
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
}

const initialState: UsersState = {
  users: [],
  isLoading: false,
  error: null,
  successMessage: null,
};

// Async thunks
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      console.log('Fetching users...');
      console.log('API Client base URL:', apiClient.defaults.baseURL);
      console.log('Token in localStorage:', localStorage.getItem('admin_auth_token'));
      
      const response = await apiClient.get('/admin/users');
      console.log('Users fetch response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Users fetch error:', error);
      console.error('Error response:', error.response?.data);
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (userData: {
    username: string;
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
    password: string;
  }, { rejectWithValue }) => {
    try {
      console.log('Creating user with data:', userData);
      console.log('API Client base URL:', apiClient.defaults.baseURL);
      console.log('Token in localStorage:', localStorage.getItem('admin_auth_token'));
      
      const response = await apiClient.post('/admin/users', userData);
      console.log('User creation response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('User creation error:', error);
      console.error('Error response:', error.response?.data);
      return rejectWithValue(error.response?.data?.message || 'Failed to create user');
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ id, userData }: { id: string; userData: Partial<User> }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/admin/users/${id}`, userData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update user');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      return userId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete user');
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.successMessage = null;
    },
    setUsers: (state, action) => {
      state.users = action.payload;
    },
    setRefreshSuccess: (state) => {
      state.successMessage = 'User list refreshed successfully!';
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch users
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        // Handle both direct array and paginated response
        if (Array.isArray(action.payload)) {
          state.users = action.payload;
        } else if (action.payload && action.payload.items) {
          // Handle paginated response
          state.users = action.payload.items;
        } else {
          state.users = [];
        }
        state.error = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to fetch users';
      })
      // Create user
      .addCase(createUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.isLoading = false;
        const userData = action.payload;
        if (userData && userData.id) {
          // Add the new user to the beginning of the array
          state.users.unshift(userData);
          state.successMessage = `User '${userData.username}' created successfully!`;
        } else {
          state.successMessage = 'User created successfully!';
        }
        state.error = null;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to create user';
      })
      // Update user
      .addCase(updateUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.isLoading = false;
        const userData = action.payload?.user || action.payload;
        if (userData) {
          const index = state.users.findIndex(user => user.id === userData.id);
          if (index !== -1) {
            state.users[index] = userData;
          }
          state.successMessage = `User '${userData.username}' updated successfully!`;
        } else {
          state.successMessage = 'User updated successfully!';
        }
        state.error = null;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to update user';
      })
      // Delete user
      .addCase(deleteUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.isLoading = false;
        // Find the user before removing it to get the username
        const userToDelete = state.users.find(user => user.id === action.payload);
        state.users = state.users.filter(user => user.id !== action.payload);
        if (userToDelete) {
          state.successMessage = `User '${userToDelete.username}' deleted successfully!`;
        } else {
          state.successMessage = 'User deleted successfully!';
        }
        state.error = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string || 'Failed to delete user';
      });
  },
});

export const { clearError, clearSuccess, setUsers, setRefreshSuccess } = usersSlice.actions;
export default usersSlice.reducer; 