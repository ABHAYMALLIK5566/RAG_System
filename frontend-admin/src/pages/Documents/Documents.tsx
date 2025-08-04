import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  CloudUpload as UploadIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDocuments, uploadDocument, deleteDocument, processDocument, downloadDocument, updateDocument } from '@/store/slices/documentsSlice';
import { usePermissions } from '@/hooks/usePermissions';

interface UploadFormData {
  title: string;
  description: string;
  category: string;
}

interface EditFormData {
  title: string;
  description: string;
  category: string;
}

const Documents: React.FC = () => {
  const dispatch = useAppDispatch();
  const { documents, isLoading, error } = useAppSelector((state) => state.documents);
  const { permissions, isViewOnly } = usePermissions();
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<UploadFormData>({
    title: '',
    description: '',
    category: '',
  });
  const [editFormData, setEditFormData] = useState<EditFormData>({
    title: '',
    description: '',
    category: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dispatch(fetchDocuments());
  }, [dispatch]);

  const handleOpenDialog = () => {
    if (!permissions.canUploadDocuments) {
      alert('You do not have permission to upload documents.');
      return;
    }
    
    setFormData({
      title: '',
      description: '',
      category: '',
    });
    setSelectedFile(null);
    setUploadProgress(0);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.title) {
        setFormData(prev => ({ ...prev, title: file.name }));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    if (!permissions.canUploadDocuments) {
      alert('You do not have permission to upload documents.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('category', formData.category);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      await dispatch(uploadDocument(formDataToSend)).unwrap();
      
      setUploadProgress(100);
      setTimeout(() => {
        handleCloseDialog();
        dispatch(fetchDocuments());
      }, 500);

    } catch (error) {
      console.error('Failed to upload document:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!permissions.canDeleteDocuments) {
      alert('You do not have permission to delete documents.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await dispatch(deleteDocument(docId)).unwrap();
        dispatch(fetchDocuments());
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    }
  };

  const handleProcessDocument = async (docId: string) => {
    try {
      await dispatch(processDocument(docId)).unwrap();
      dispatch(fetchDocuments());
    } catch (error) {
      console.error('Failed to process document:', error);
    }
  };

  const handleDownloadDocument = async (docId: string) => {
    try {
      const result = await dispatch(downloadDocument(docId)).unwrap();
      
      // Create a blob from the content and download it
      const blob = new Blob([result.content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || 'document.txt';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download document:', error);
      alert('Failed to download document');
    }
  };

  const handleEditDocument = (document: any) => {
    setEditingDocument(document);
    setEditFormData({
      title: document.title || '',
      description: document.description || '',
      category: document.category || '',
    });
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setEditingDocument(null);
    setEditFormData({
      title: '',
      description: '',
      category: '',
    });
  };

  const handleUpdateDocument = async () => {
    if (!editingDocument) return;

    try {
      await dispatch(updateDocument({
        docId: editingDocument.id,
        documentData: editFormData
      })).unwrap();
      
      handleCloseEditDialog();
      dispatch(fetchDocuments());
    } catch (error) {
      console.error('Failed to update document:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <SuccessIcon color="success" />;
      case 'processing':
        return <PendingIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" data-testid="documents-title">
            Document Management
            {isViewOnly && (
              <Chip
                size="small"
                label="View Only"
                color="warning"
                icon={<ViewIcon />}
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {isViewOnly 
              ? 'View and download documents from the system'
              : 'Manage system documents and file uploads'
            }
          </Typography>
        </Box>
        {permissions.canUploadDocuments && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="large"
            onClick={handleOpenDialog}
            data-testid="add-document-button"
          >
            Add Document
          </Button>
        )}
      </Box>

      {/* Permission Notice */}
      {!permissions.canUploadDocuments && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          icon={<ViewIcon />}
        >
          <Typography variant="body2">
            <strong>Upload Restricted:</strong> You can view and download documents but cannot upload new documents.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }} data-testid="documents-table">
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {documents.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Documents
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {Array.isArray(documents) ? documents.filter(doc => doc.status === 'processed').length : 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Processed Documents
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {Array.isArray(documents) ? documents.filter(doc => doc.status === 'processing').length : 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Processing
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Document</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell>Processed</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(documents) ? documents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {document.title}
                      </Typography>
                      {document.description && (
                        <Typography variant="caption" color="text.secondary">
                          {document.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={document.category || document.metadata?.category || 'Uncategorized'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatFileSize(document.file_size || (document.metadata?.file_size || 0))}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getStatusIcon(document.status || document.metadata?.status || 'pending')}
                      <Chip
                        label={document.status || document.metadata?.status || 'pending'}
                        color={getStatusColor(document.status || document.metadata?.status || 'pending')}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {document.created_at && !isNaN(Date.parse(document.created_at))
                        ? new Date(document.created_at).toLocaleDateString()
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {document.processed_at && !isNaN(Date.parse(document.processed_at))
                        ? new Date(document.processed_at).toLocaleDateString()
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleEditDocument(document)}
                          data-testid={`edit-doc-${document.id}`}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadDocument(document.id)}
                          data-testid={`download-doc-${document.id}`}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      {document.status !== 'processed' && (
                        <Tooltip title="Process document">
                          <IconButton
                            size="small"
                            onClick={() => handleProcessDocument(document.id)}
                            data-testid={`process-doc-${document.id}`}
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {permissions.canDeleteDocuments && (
                        <Tooltip title="Delete document">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDocument(document.id)}
                            data-testid={`delete-doc-${document.id}`}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )) : null}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={Array.isArray(documents) ? documents.length : 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Upload Document Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Upload New Document
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.md"
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                sx={{ py: 2 }}
              >
                {selectedFile ? selectedFile.name : 'Choose File'}
              </Button>
            </Grid>
            
            {uploading && (
              <Grid item xs={12}>
                <Box sx={{ width: '100%' }}>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                  <Typography variant="caption" color="text.secondary">
                    Uploading... {uploadProgress}%
                  </Typography>
                </Box>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                name="title"
                data-testid="title-field"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                data-testid="description-field"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Category"
                name="category"
                data-testid="category-field"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Manuals, Reports, Policies"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} data-testid="cancel-button">Cancel</Button>
          <Button 
            onClick={handleUpload} 
            variant="contained"
            data-testid="upload-button"
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Document
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                name="title"
                data-testid="title-field"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                data-testid="description-field"
                multiline
                rows={2}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Category"
                name="category"
                data-testid="category-field"
                value={editFormData.category}
                onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                placeholder="e.g., Manuals, Reports, Policies"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} data-testid="cancel-button">Cancel</Button>
          <Button 
            onClick={handleUpdateDocument} 
            variant="contained"
            data-testid="update-button"
            disabled={!editingDocument}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Documents; 