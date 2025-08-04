import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import apiClient from '../../services/api'

export interface Document {
  id: string
  title: string
  content: string
  file_path: string
  file_type: string
  file_size: number
  created_at: string
  updated_at: string
  metadata?: {
    author?: string
    tags?: string[]
    summary?: string
    page_count?: number
  }
}

export interface DocumentsState {
  documents: Document[]
  isLoading: boolean
  error: string | null
  searchQuery: string
  filters: {
    fileType: string[]
    dateRange: {
      start: string | null
      end: string | null
    }
  }
}

const initialState: DocumentsState = {
  documents: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  filters: {
    fileType: [],
    dateRange: {
      start: null,
      end: null,
    },
  },
}

export const getDocuments = createAsyncThunk(
  'documents/getDocuments',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/documents')
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to get documents')
    }
  }
)

export const searchDocuments = createAsyncThunk(
  'documents/searchDocuments',
  async (query: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/documents/search', {
        params: { q: query },
      })
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to search documents')
    }
  }
)

export const uploadDocument = createAsyncThunk(
  'documents/uploadDocument',
  async (file: File, { rejectWithValue }) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await apiClient.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to upload document')
    }
  }
)

export const deleteDocument = createAsyncThunk(
  'documents/deleteDocument',
  async (documentId: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/documents/${documentId}`)
      return documentId
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete document')
    }
  }
)

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },
    setFileTypeFilter: (state, action: PayloadAction<string[]>) => {
      state.filters.fileType = action.payload
    },
    setDateRangeFilter: (state, action: PayloadAction<{ start: string | null; end: string | null }>) => {
      state.filters.dateRange = action.payload
    },
    clearFilters: (state) => {
      state.filters = {
        fileType: [],
        dateRange: {
          start: null,
          end: null,
        },
      }
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Get documents
      .addCase(getDocuments.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(getDocuments.fulfilled, (state, action) => {
        state.isLoading = false
        state.documents = action.payload
      })
      .addCase(getDocuments.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Search documents
      .addCase(searchDocuments.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(searchDocuments.fulfilled, (state, action) => {
        state.isLoading = false
        state.documents = action.payload
      })
      .addCase(searchDocuments.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Upload document
      .addCase(uploadDocument.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.isLoading = false
        state.documents.unshift(action.payload)
      })
      .addCase(uploadDocument.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Delete document
      .addCase(deleteDocument.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.isLoading = false
        state.documents = state.documents.filter(doc => doc.id !== action.payload)
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export const {
  setSearchQuery,
  setFileTypeFilter,
  setDateRangeFilter,
  clearFilters,
  clearError,
} = documentsSlice.actions
export default documentsSlice.reducer 