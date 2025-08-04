import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import apiClient from '../../services/api'

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
  metadata?: {
    sources?: Array<{
      title: string
      url: string
      snippet: string
    }>
    confidence?: number
    processing_time?: number
  }
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface ChatState {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  isLoading: boolean
  isStreaming: boolean
  isSendingMessage: boolean
  error: string | null
}

const initialState: ChatState = {
  sessions: [],
  currentSession: null,
  isLoading: false,
  isStreaming: false,
  isSendingMessage: false,
  error: null,
}

export const createSession = createAsyncThunk(
  'chat/createSession',
  async (title: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/chat/sessions', { title })
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create session')
    }
  }
)

export const getSessions = createAsyncThunk(
  'chat/getSessions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/chat/sessions')
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to get sessions')
    }
  }
)

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (
    { sessionId, message, stream = false }: {
      sessionId: string
      message: string
      stream?: boolean
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await apiClient.post(`/chat/sessions/${sessionId}/messages`, {
        content: message,
        stream,
      })
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to send message')
    }
  }
)

export const getSessionMessages = createAsyncThunk(
  'chat/getSessionMessages',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/chat/sessions/${sessionId}/messages`)
      return { sessionId, messages: response.data }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to get messages')
    }
  }
)

export const deleteSession = createAsyncThunk(
  'chat/deleteSession',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/chat/sessions/${sessionId}`)
      return sessionId
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete session')
    }
  }
)

export const shareSession = createAsyncThunk(
  'chat/shareSession',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(`/chat/sessions/${sessionId}/share`)
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to share session')
    }
  }
)

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentSession: (state, action: PayloadAction<ChatSession | null>) => {
      state.currentSession = action.payload
    },
    addMessage: (state, action: PayloadAction<{ sessionId: string; message: Message }>) => {
      const { sessionId, message } = action.payload
      const timestamp = new Date().toISOString()
      
      // Debug logging
      console.log('[addMessage] sessionId:', sessionId)
      console.log('[addMessage] state.sessions:', state.sessions)
      console.log('[addMessage] state.currentSession:', state.currentSession)
      
      // Optimized message addition with better performance
      if (Array.isArray(state.sessions)) {
        const session = state.sessions.find(s => s.id === sessionId)
        console.log('[addMessage] found session:', session)
        if (session) {
          // Ensure messages array exists
          if (!session.messages || !Array.isArray(session.messages)) {
            console.log('[addMessage] initializing messages array for session')
            session.messages = []
          }
          session.messages.push(message)
          session.updated_at = timestamp
        }
      }
      
      // Update current session if it matches
      if (state.currentSession?.id === sessionId) {
        // Ensure messages array exists
        if (!state.currentSession.messages || !Array.isArray(state.currentSession.messages)) {
          console.log('[addMessage] initializing messages array for currentSession')
          state.currentSession.messages = []
        }
        state.currentSession.messages.push(message)
        state.currentSession.updated_at = timestamp
      }
    },
    updateMessage: (state, action: PayloadAction<{ sessionId: string; messageId: string; content: string }>) => {
      const { sessionId, messageId, content } = action.payload
      // Ensure sessions is an array
      if (Array.isArray(state.sessions)) {
        const session = state.sessions.find(s => s.id === sessionId)
        if (session) {
          // Ensure messages array exists
          if (!session.messages || !Array.isArray(session.messages)) {
            session.messages = []
          }
          const message = session.messages.find(m => m.id === messageId)
          if (message) {
            message.content = content
          }
        }
      }
      if (state.currentSession?.id === sessionId) {
        // Ensure messages array exists
        if (!state.currentSession.messages || !Array.isArray(state.currentSession.messages)) {
          state.currentSession.messages = []
        }
        const message = state.currentSession.messages.find(m => m.id === messageId)
        if (message) {
          message.content = content
        }
      }
    },
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Create session
      .addCase(createSession.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createSession.fulfilled, (state, action) => {
        state.isLoading = false
        // Ensure sessions is always an array
        if (!Array.isArray(state.sessions)) {
          state.sessions = []
        }
        // Ensure the new session has a messages array
        const newSession = {
          ...action.payload,
          messages: Array.isArray(action.payload.messages) ? action.payload.messages : []
        }
        state.sessions.unshift(newSession)
        state.currentSession = newSession
      })
      .addCase(createSession.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Get sessions
      .addCase(getSessions.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getSessions.fulfilled, (state, action) => {
        state.isLoading = false
        // Patch: ensure sessions is always an array
        let sessions: ChatSession[] = []
        if (Array.isArray(action.payload)) {
          sessions = action.payload
        } else if (action.payload && Array.isArray(action.payload.sessions)) {
          sessions = action.payload.sessions
        }
        
        // Ensure each session has a messages array
        state.sessions = sessions.map(session => ({
          ...session,
          messages: Array.isArray(session.messages) ? session.messages : []
        }))
      })
      .addCase(getSessions.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Send message - use granular loading state
      .addCase(sendMessage.pending, (state) => {
        state.isSendingMessage = true
        state.error = null
      })
      .addCase(sendMessage.fulfilled, (state, _action) => {
        state.isSendingMessage = false
        // Message will be added via addMessage reducer
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isSendingMessage = false
        state.error = action.payload as string
      })
      // Get session messages
      .addCase(getSessionMessages.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getSessionMessages.fulfilled, (state, action) => {
        state.isLoading = false
        const { sessionId, messages } = action.payload
        // Ensure sessions is an array
        if (Array.isArray(state.sessions)) {
          const session = state.sessions.find(s => s.id === sessionId)
          if (session) {
            // Ensure messages is an array
            session.messages = Array.isArray(messages) ? messages : []
          }
        }
        if (state.currentSession?.id === sessionId) {
          // Ensure messages is an array
          state.currentSession.messages = Array.isArray(messages) ? messages : []
        }
      })
      .addCase(getSessionMessages.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Delete session
      .addCase(deleteSession.pending, (state) => {
        state.isLoading = true
      })
      .addCase(deleteSession.fulfilled, (state, action) => {
        state.isLoading = false
        const deletedSessionId = action.payload
        // Ensure sessions is an array before filtering
        if (Array.isArray(state.sessions)) {
          state.sessions = state.sessions.filter(s => s.id !== deletedSessionId)
          // If the deleted session was the current session, set current session to null or the first available session
          if (state.currentSession?.id === deletedSessionId) {
            state.currentSession = state.sessions.length > 0 ? state.sessions[0] : null
          }
        }
      })
      .addCase(deleteSession.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Share session
      .addCase(shareSession.pending, (state) => {
        state.isLoading = true
      })
      .addCase(shareSession.fulfilled, (state, _action) => {
        state.isLoading = false
        // Handle the response from the API
      })
      .addCase(shareSession.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export const { setCurrentSession, addMessage, updateMessage, setStreaming, clearError } = chatSlice.actions
export default chatSlice.reducer 