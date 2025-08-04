import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  language: string
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    duration?: number
  }>
  loadingStates: {
    [key: string]: boolean
  }
  modalStates: {
    [key: string]: boolean
  }
}

const initialState: UIState = {
  sidebarOpen: false,
  theme: 'light',
  language: 'en',
  notifications: [],
  loadingStates: {},
  modalStates: {},
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload
      localStorage.setItem('theme', action.payload)
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload
      localStorage.setItem('language', action.payload)
    },
    addNotification: (state, action: PayloadAction<{
      id: string
      type: 'success' | 'error' | 'warning' | 'info'
      message: string
      duration?: number
    }>) => {
      state.notifications.push(action.payload)
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      )
    },
    clearNotifications: (state) => {
      state.notifications = []
    },
    setLoadingState: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload
      state.loadingStates[key] = loading
    },
    setModalState: (state, action: PayloadAction<{ key: string; open: boolean }>) => {
      const { key, open } = action.payload
      state.modalStates[key] = open
    },
    clearLoadingStates: (state) => {
      state.loadingStates = {}
    },
    clearModalStates: (state) => {
      state.modalStates = {}
    },
  },
})

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  setLanguage,
  addNotification,
  removeNotification,
  clearNotifications,
  setLoadingState,
  setModalState,
  clearLoadingStates,
  clearModalStates,
} = uiSlice.actions
export default uiSlice.reducer 