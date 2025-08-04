import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Document } from '@/types';
import { apiClient } from '@/services/apiClient';

interface DocumentsState {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
}

const initialState: DocumentsState = {
  documents: [],
  isLoading: false,
  error: null,
};

// Async thunks
export const fetchDocuments = createAsyncThunk(
  'documents/fetchDocuments',
  async () => {
    const response = await apiClient.get('/rag/documents');
    return response.data;
  }
);

export const uploadDocument = createAsyncThunk(
  'documents/uploadDocument',
  async (formData: FormData) => {
    const response = await apiClient.post('/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    // The backend returns FileUploadResponse, not a document object
    // We need to fetch the document after upload
    if (response.data.success && response.data.document_ids && response.data.document_ids.length > 0) {
      // Fetch the uploaded document to get its full details
      const docResponse = await apiClient.get(`/rag/documents/${response.data.document_ids[0]}`);
      return docResponse.data;
    }
    throw new Error('Upload failed or no document ID returned');
  }
);

export const deleteDocument = createAsyncThunk(
  'documents/deleteDocument',
  async (docId: string) => {
    await apiClient.delete(`/rag/documents/${docId}`);
    return docId;
  }
);

export const downloadDocument = createAsyncThunk(
  'documents/downloadDocument',
  async (docId: string) => {
    const response = await apiClient.get(`/rag/documents/${docId}/download`);
    return response.data;
  }
);

export const updateDocument = createAsyncThunk(
  'documents/updateDocument',
  async ({ docId, documentData }: { docId: string; documentData: any }) => {
    const response = await apiClient.put(`/rag/documents/${docId}`, documentData);
    return response.data;
  }
);

export const processDocument = createAsyncThunk(
  'documents/processDocument',
  async (docId: string) => {
    const response = await apiClient.post(`/rag/documents/${docId}/process`);
    return response.data;
  }
);

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch documents
      .addCase(fetchDocuments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.isLoading = false;
        // Handle both direct array and paginated response
        if (Array.isArray(action.payload)) {
          state.documents = action.payload;
        } else if (action.payload && action.payload.documents) {
          // Handle paginated response
          state.documents = action.payload.documents;
        } else {
          state.documents = [];
        }
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch documents';
      })
      // Upload document
      .addCase(uploadDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        state.documents.unshift(action.payload);
      })
      .addCase(uploadDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to upload document';
      })
      // Delete document
      .addCase(deleteDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        state.documents = state.documents.filter(doc => doc.id !== action.payload);
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete document';
      })
      // Download document
      .addCase(downloadDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(downloadDocument.fulfilled, (state) => {
        state.isLoading = false;
        // Handle the downloaded document
      })
      .addCase(downloadDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to download document';
      })
      // Process document
      .addCase(processDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(processDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.documents.findIndex(doc => doc.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
      })
      .addCase(processDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to process document';
      })
      // Update document
      .addCase(updateDocument.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateDocument.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.documents.findIndex(doc => doc.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
      })
      .addCase(updateDocument.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to update document';
      });
  },
});

export const { clearError } = documentsSlice.actions;
export default documentsSlice.reducer; 