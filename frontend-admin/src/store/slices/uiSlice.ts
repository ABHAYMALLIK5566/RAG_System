import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebar_open: boolean;
  theme: 'light' | 'dark' | 'auto';
  layout: 'default' | 'compact' | 'wide';
  show_sources: boolean;
  show_metadata: boolean;
  auto_save: boolean;
  notifications_enabled: boolean;
}

const initialState: UIState = {
  sidebar_open: true,
  theme: 'light',
  layout: 'default',
  show_sources: false,
  show_metadata: false,
  auto_save: true,
  notifications_enabled: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebar_open = !state.sidebar_open;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebar_open = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.theme = action.payload;
    },
    setLayout: (state, action: PayloadAction<'default' | 'compact' | 'wide'>) => {
      state.layout = action.payload;
    },
    toggleSources: (state) => {
      state.show_sources = !state.show_sources;
    },
    setShowSources: (state, action: PayloadAction<boolean>) => {
      state.show_sources = action.payload;
    },
    toggleMetadata: (state) => {
      state.show_metadata = !state.show_metadata;
    },
    setShowMetadata: (state, action: PayloadAction<boolean>) => {
      state.show_metadata = action.payload;
    },
    toggleAutoSave: (state) => {
      state.auto_save = !state.auto_save;
    },
    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.auto_save = action.payload;
    },
    toggleNotifications: (state) => {
      state.notifications_enabled = !state.notifications_enabled;
    },
    setNotificationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.notifications_enabled = action.payload;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  setLayout,
  toggleSources,
  setShowSources,
  toggleMetadata,
  setShowMetadata,
  toggleAutoSave,
  setAutoSave,
  toggleNotifications,
  setNotificationsEnabled,
} = uiSlice.actions;

export default uiSlice.reducer; 