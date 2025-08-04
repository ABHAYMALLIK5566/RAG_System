import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit'
import apiClient from '../../services/api'
import { performanceAgent } from '../../services/performanceAgent'

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
  message_count?: number
  last_message_preview?: string
}

export interface ChatState {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  isLoading: boolean
  isStreaming: boolean
  isSendingMessage: boolean
  error: string | null
  lastUpdated: number
  messageCache: Record<string, Message[]>
  sessionMetrics: Record<string, {
    totalMessages: number
    avgResponseTime: number
    lastActivity: string
  }>
}

const initialState: ChatState = {
  sessions: [],
  currentSession: null,
  isLoading: false,
  isStreaming: false,
  isSendingMessage: false,
  error: null,
  lastUpdated: 0,
  messageCache: {},
  sessionMetrics: {},
}

// Optimized async thunks with performance tracking
export const createSession = createAsyncThunk(
  'optimizedChat/createSession',
  async (title: string, { rejectWithValue }) => {
    const timer = performanceAgent.timeNetworkRequest('/chat/sessions', 'POST');
    try {
      const response = await apiClient.post('/chat/sessions', { title })
      performanceAgent.endTimer(timer, { success: true, sessionTitle: title });
      return response.data
    } catch (error: any) {
      performanceAgent.endTimer(timer, { success: false, error: error.message });
      return rejectWithValue(error.response?.data?.detail || 'Failed to create session')
    }
  }
)

export const getSessions = createAsyncThunk(
  'optimizedChat/getSessions',
  async (_, { rejectWithValue }) => {
    const timer = performanceAgent.timeNetworkRequest('/chat/sessions', 'GET');
    try {
      const response = await apiClient.get('/chat/sessions')
      performanceAgent.endTimer(timer, { success: true, sessionCount: response.data.length });
      return response.data
    } catch (error: any) {
      performanceAgent.endTimer(timer, { success: false, error: error.message });
      return rejectWithValue(error.response?.data?.detail || 'Failed to get sessions')
    }
  }
)

export const sendMessage = createAsyncThunk(
  'optimizedChat/sendMessage',
  async (
    { sessionId, message, stream = false }: {
      sessionId: string
      message: string
      stream?: boolean
    },
    { rejectWithValue }
  ) => {
    const timer = performanceAgent.timeNetworkRequest(`/chat/sessions/${sessionId}/messages`, 'POST');
    try {
      const response = await apiClient.post(`/chat/sessions/${sessionId}/messages`, {
        content: message,
        stream,
      })
      performanceAgent.endTimer(timer, { 
        success: true, 
        sessionId, 
        messageLength: message.length,
        responseTime: response.data.metadata?.processing_time 
      });
      return { sessionId, message: response.data }
    } catch (error: any) {
      performanceAgent.endTimer(timer, { success: false, error: error.message });
      return rejectWithValue(error.response?.data?.detail || 'Failed to send message')
    }
  }
)

export const getSessionMessages = createAsyncThunk(
  'optimizedChat/getSessionMessages',
  async (sessionId: string, { rejectWithValue, getState }) => {
    // Check cache first
    const state = getState() as { optimizedChat: ChatState };
    const cachedMessages = state.optimizedChat.messageCache[sessionId];
    
    if (cachedMessages && cachedMessages.length > 0) {
      performanceAgent.timeOperation('GetMessagesFromCache', 'computation', () => {
        return { sessionId, messages: cachedMessages };
      });
      return { sessionId, messages: cachedMessages, fromCache: true };
    }

    const timer = performanceAgent.timeNetworkRequest(`/chat/sessions/${sessionId}/messages`, 'GET');
    try {
      const response = await apiClient.get(`/chat/sessions/${sessionId}/messages`)
      performanceAgent.endTimer(timer, { 
        success: true, 
        sessionId, 
        messageCount: response.data.length 
      });
      return { sessionId, messages: response.data, fromCache: false }
    } catch (error: any) {
      performanceAgent.endTimer(timer, { success: false, error: error.message });
      return rejectWithValue(error.response?.data?.detail || 'Failed to get messages')
    }
  }
)

export const deleteSession = createAsyncThunk(
  'optimizedChat/deleteSession',
  async (sessionId: string, { rejectWithValue }) => {
    const timer = performanceAgent.timeNetworkRequest(`/chat/sessions/${sessionId}`, 'DELETE');
    try {
      await apiClient.delete(`/chat/sessions/${sessionId}`)
      performanceAgent.endTimer(timer, { success: true, sessionId });
      return sessionId
    } catch (error: any) {
      performanceAgent.endTimer(timer, { success: false, error: error.message });
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete session')
    }
  }
)

// Helper function to calculate session metrics
const calculateSessionMetrics = (messages: Message[]) => {
  const totalMessages = messages.length;
  const responseTimes = messages
    .filter(m => m.metadata?.processing_time)
    .map(m => m.metadata!.processing_time!);
  
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
    : 0;
    
  const lastActivity = messages.length > 0 
    ? messages[messages.length - 1].timestamp 
    : new Date().toISOString();

  return { totalMessages, avgResponseTime, lastActivity };
};

// Helper function to generate message preview
const generateMessagePreview = (messages: Message[]): string => {
  if (messages.length === 0) return 'No messages';
  const lastMessage = messages[messages.length - 1];
  return lastMessage.content.length > 50 
    ? `${lastMessage.content.substring(0, 50)}...` 
    : lastMessage.content;
};

const optimizedChatSlice = createSlice({
  name: 'optimizedChat',
  initialState,
  reducers: {
    setCurrentSession: (state, action: PayloadAction<ChatSession | null>) => {
      const timer = performanceAgent.startTimer('SetCurrentSession', 'ui');
      state.currentSession = action.payload;
      state.lastUpdated = Date.now();
      performanceAgent.endTimer(timer);
    },
    
    addMessage: (state, action: PayloadAction<{ sessionId: string; message: Message }>) => {
      const timer = performanceAgent.startTimer('AddMessage', 'ui');
      const { sessionId, message } = action.payload;
      
      // Update session in sessions array
      const session = state.sessions.find(s => s.id === sessionId);
      if (session) {
        session.messages.push(message);
        session.updated_at = new Date().toISOString();
        session.message_count = session.messages.length;
        session.last_message_preview = generateMessagePreview(session.messages);
      }
      
      // Update current session if it matches
      if (state.currentSession?.id === sessionId) {
        state.currentSession.messages.push(message);
        state.currentSession.updated_at = new Date().toISOString();
        state.currentSession.message_count = state.currentSession.messages.length;
        state.currentSession.last_message_preview = generateMessagePreview(state.currentSession.messages);
      }
      
      // Update cache
      if (state.messageCache[sessionId]) {
        state.messageCache[sessionId].push(message);
      }
      
      // Update metrics
      const sessionMessages = session?.messages || state.currentSession?.messages || [];
      if (sessionMessages.length > 0) {
        state.sessionMetrics[sessionId] = calculateSessionMetrics(sessionMessages);
      }
      
      state.lastUpdated = Date.now();
      performanceAgent.endTimer(timer);
    },
    
    updateMessage: (state, action: PayloadAction<{ sessionId: string; messageId: string; content: string }>) => {
      const timer = performanceAgent.startTimer('UpdateMessage', 'ui');
      const { sessionId, messageId, content } = action.payload;
      
      // Update in sessions array
      const session = state.sessions.find(s => s.id === sessionId);
      if (session) {
        const message = session.messages.find(m => m.id === messageId);
        if (message) {
          message.content = content;
          session.last_message_preview = generateMessagePreview(session.messages);
        }
      }
      
      // Update in current session
      if (state.currentSession?.id === sessionId) {
        const message = state.currentSession.messages.find(m => m.id === messageId);
        if (message) {
          message.content = content;
          state.currentSession.last_message_preview = generateMessagePreview(state.currentSession.messages);
        }
      }
      
      // Update cache
      if (state.messageCache[sessionId]) {
        const cachedMessage = state.messageCache[sessionId].find(m => m.id === messageId);
        if (cachedMessage) {
          cachedMessage.content = content;
        }
      }
      
      state.lastUpdated = Date.now();
      performanceAgent.endTimer(timer);
    },
    
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    optimizeCache: (state) => {
      const timer = performanceAgent.startTimer('OptimizeCache', 'computation');
      
      // Keep only the last 100 messages per session in cache
      Object.keys(state.messageCache).forEach(sessionId => {
        const messages = state.messageCache[sessionId];
        if (messages.length > 100) {
          state.messageCache[sessionId] = messages.slice(-100);
        }
      });
      
      // Remove cache for sessions that no longer exist
      const sessionIds = new Set(state.sessions.map(s => s.id));
      Object.keys(state.messageCache).forEach(sessionId => {
        if (!sessionIds.has(sessionId)) {
          delete state.messageCache[sessionId];
        }
      });
      
      performanceAgent.endTimer(timer);
    },
    
    batchUpdateSessions: (state, action: PayloadAction<ChatSession[]>) => {
      const timer = performanceAgent.startTimer('BatchUpdateSessions', 'computation');
      
      // Efficiently update sessions while preserving references where possible
      const existingSessionsMap = new Map(state.sessions.map(s => [s.id, s]));
      
      state.sessions = action.payload.map(newSession => {
        const existingSession = existingSessionsMap.get(newSession.id);
        
        // If session exists and hasn't changed, keep the existing reference
        if (existingSession && 
            existingSession.updated_at === newSession.updated_at &&
            existingSession.messages.length === newSession.messages.length) {
          return existingSession;
        }
        
        // Add computed properties
        return {
          ...newSession,
          message_count: newSession.messages.length,
          last_message_preview: generateMessagePreview(newSession.messages),
        };
      });
      
      state.lastUpdated = Date.now();
      performanceAgent.endTimer(timer);
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
        const newSession = {
          ...action.payload,
          message_count: 0,
          last_message_preview: 'No messages',
        };
        state.sessions.unshift(newSession)
        state.currentSession = newSession
        state.sessionMetrics[action.payload.id] = {
          totalMessages: 0,
          avgResponseTime: 0,
          lastActivity: new Date().toISOString(),
        };
        state.lastUpdated = Date.now();
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
        state.sessions = action.payload.map((session: ChatSession) => ({
          ...session,
          message_count: session.messages.length,
          last_message_preview: generateMessagePreview(session.messages),
        }));
        
        // Update metrics for all sessions
        action.payload.forEach((session: ChatSession) => {
          state.sessionMetrics[session.id] = calculateSessionMetrics(session.messages);
        });
        
        state.lastUpdated = Date.now();
      })
      .addCase(getSessions.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.isSendingMessage = true
        state.error = null
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isSendingMessage = false
        const { sessionId, message } = action.payload;
        
        // Add the message using the existing reducer logic
        optimizedChatSlice.caseReducers.addMessage(state, {
          type: 'addMessage',
          payload: { sessionId, message }
        });
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
        const { sessionId, messages, fromCache } = action.payload
        
        // Update cache if not from cache
        if (!fromCache) {
          state.messageCache[sessionId] = messages;
        }
        
        // Update session
        const session = state.sessions.find(s => s.id === sessionId)
        if (session) {
          session.messages = messages
          session.message_count = messages.length;
          session.last_message_preview = generateMessagePreview(messages);
        }
        
        // Update current session
        if (state.currentSession?.id === sessionId) {
          state.currentSession.messages = messages
          state.currentSession.message_count = messages.length;
          state.currentSession.last_message_preview = generateMessagePreview(messages);
        }
        
        // Update metrics
        state.sessionMetrics[sessionId] = calculateSessionMetrics(messages);
        state.lastUpdated = Date.now();
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
        
        // Remove from sessions
        state.sessions = state.sessions.filter(s => s.id !== deletedSessionId)
        
        // Clear cache
        delete state.messageCache[deletedSessionId];
        delete state.sessionMetrics[deletedSessionId];
        
        // Update current session
        if (state.currentSession?.id === deletedSessionId) {
          state.currentSession = state.sessions.length > 0 ? state.sessions[0] : null
        }
        
        state.lastUpdated = Date.now();
      })
      .addCase(deleteSession.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

// Memoized selectors for performance
export const selectSessions = createSelector(
  [(state: { optimizedChat: ChatState }) => state.optimizedChat.sessions],
  (sessions) => sessions
);

export const selectCurrentSession = createSelector(
  [(state: { optimizedChat: ChatState }) => state.optimizedChat.currentSession],
  (currentSession) => currentSession
);

export const selectSessionById = createSelector(
  [selectSessions, (_: any, sessionId: string) => sessionId],
  (sessions, sessionId) => sessions.find(s => s.id === sessionId)
);

export const selectSessionMessages = createSelector(
  [selectCurrentSession],
  (currentSession) => currentSession?.messages || []
);

export const selectSessionMetrics = createSelector(
  [(state: { optimizedChat: ChatState }) => state.optimizedChat.sessionMetrics],
  (metrics) => metrics
);

export const selectChatPerformanceStats = createSelector(
  [selectSessions, selectSessionMetrics],
  (sessions, metrics) => {
    const totalSessions = sessions.length;
    const totalMessages = Object.values(metrics).reduce((sum, m) => sum + m.totalMessages, 0);
    const avgResponseTime = Object.values(metrics).length > 0
      ? Object.values(metrics).reduce((sum, m) => sum + m.avgResponseTime, 0) / Object.values(metrics).length
      : 0;
    
    return {
      totalSessions,
      totalMessages,
      avgResponseTime,
      activeSessions: sessions.filter(s => s.is_active).length,
    };
  }
);

export const { 
  setCurrentSession, 
  addMessage, 
  updateMessage, 
  setStreaming, 
  clearError,
  optimizeCache,
  batchUpdateSessions,
} = optimizedChatSlice.actions

export default optimizedChatSlice.reducer 