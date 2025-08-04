import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  AdminPanelSettings as AdminIcon,
  Person as UserIcon,
  Analytics as AnalystIcon,
  Code as DeveloperIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchApiKeys, createApiKey, deleteApiKey, regenerateApiKey } from '@/store/slices/apiKeysSlice';
import { apiClient } from '@/services/apiClient';

interface ApiKeyFormData {
  name: string;
  description: string;
  role: string;
  permissions: string[];
  expires_at: string;
}

interface PermissionCategory {
  [key: string]: string[];
}

// Predefined role permissions based on backend ROLE_PERMISSIONS
const ROLE_PERMISSIONS = {
  user: [
    'read_documents',
    'execute_queries',
    'use_agent',
    'websocket_connect'
  ],
  analyst: [
    'read_documents',
    'write_documents',
    'execute_queries',
    'use_agent',
    'stream_responses',
    'read_stats',
    'read_health',
    'websocket_connect'
  ],
  developer: [
    'read_documents',
    'write_documents',
    'bulk_import_documents',
    'execute_queries',
    'use_agent',
    'stream_responses',
    'read_stats',
    'read_health',
    'view_performance',
    'websocket_connect'
  ],
  admin: [
    'read_documents',
    'write_documents',
    'delete_documents',
    'bulk_import_documents',
    'execute_queries',
    'use_agent',
    'stream_responses',
    'read_stats',
    'read_health',
    'clear_cache',
    'view_performance',
    'manage_users',
    'admin_users',
    'manage_api_keys',
    'view_logs',
    'system_config',
    'websocket_connect',
    'websocket_broadcast'
  ]
};

const ApiKeys: React.FC = () => {
  const dispatch = useAppDispatch();
  const { apiKeys, isLoading, error } = useAppSelector((state) => state.apiKeys);
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [permissionCategories, setPermissionCategories] = useState<PermissionCategory>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [formData, setFormData] = useState<ApiKeyFormData>({
    name: '',
    description: '',
    role: 'user',
    permissions: [],
    expires_at: '',
  });

  useEffect(() => {
    dispatch(fetchApiKeys());
    fetchPermissions();
  }, [dispatch]);

  const fetchPermissions = async () => {
    try {
      setLoadingPermissions(true);
      // Use the simple permissions endpoint that doesn't require authentication
      const response = await apiClient.get('/admin/permissions-simple');
      setAvailablePermissions(response.data.permissions);
      setPermissionCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      // Fallback to hardcoded permissions if API fails
      setAvailablePermissions(Object.values(ROLE_PERMISSIONS).flat());
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleOpenDialog = () => {
    console.log('Opening dialog with initial form data');
    const initialFormData = {
      name: '',
      description: '',
      role: 'user',
      permissions: ROLE_PERMISSIONS.user,
      expires_at: '',
    };
    console.log('Initial form data:', initialFormData);
    setFormData(initialFormData);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setShowNewKey(null);
  };

  const handleRoleChange = (role: string) => {
    console.log('Role changed to:', role);
    
    // Get permissions for the selected role
    let rolePermissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
    
    // For admin role, ensure we have all available permissions
    if (role === 'admin' && availablePermissions.length > 0) {
      rolePermissions = availablePermissions;
    }
    
    console.log('Available permissions for role:', rolePermissions);
    
    const updatedFormData = {
      ...formData,
      role,
      permissions: rolePermissions
    };
    
    setFormData(updatedFormData);
    console.log('Updated form data:', updatedFormData);
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permission]
      });
    } else {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter(p => p !== permission)
      });
    }
  };

  const handleSelectAllPermissions = () => {
    setFormData({
      ...formData,
      permissions: availablePermissions
    });
  };

  const handleClearAllPermissions = () => {
    setFormData({
      ...formData,
      permissions: []
    });
  };

  const handleSubmit = async () => {
    try {
      // Ensure we have the correct data structure
      const submitData = {
        name: formData.name,
        description: formData.description,
        role: formData.role, // This should be "admin", "user", etc.
        permissions: formData.permissions, // This should be an array of permission strings
        expires_at: formData.expires_at
      };
      
      console.log('Submitting form data:', submitData);
      console.log('Role field:', submitData.role);
      console.log('Permissions field:', submitData.permissions);
      
      const result = await dispatch(createApiKey(submitData)).unwrap();
      setShowNewKey(result.key);
      dispatch(fetchApiKeys());
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (window.confirm('Are you sure you want to delete this API key?')) {
      try {
        await dispatch(deleteApiKey(keyId)).unwrap();
        dispatch(fetchApiKeys());
      } catch (error) {
        console.error('Failed to delete API key:', error);
      }
    }
  };

  const handleRegenerateKey = async (keyId: string) => {
    if (window.confirm('Are you sure you want to regenerate this API key? The old key will be invalidated.')) {
      try {
        const result = await dispatch(regenerateApiKey(keyId)).unwrap();
        setShowNewKey(result.key);
        dispatch(fetchApiKeys());
      } catch (error) {
        console.error('Failed to regenerate API key:', error);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (isActive: boolean, expiresAt?: string) => {
    if (!isActive) return 'error';
    if (expiresAt && new Date(expiresAt) < new Date()) return 'warning';
    return 'success';
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <AdminIcon />;
      case 'user': return <UserIcon />;
      case 'analyst': return <AnalystIcon />;
      case 'developer': return <DeveloperIcon />;
      default: return <UserIcon />;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          API Keys Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
          data-testid="create-api-key-btn"
        >
          Create API Key
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }} data-testid="api-keys-table">
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {apiKeys.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active API Keys
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {apiKeys.reduce((sum, key) => sum + (key.usage_count || 0), 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total API Calls Today
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {Array.isArray(apiKeys) ? apiKeys.filter(key => key.expires_at && new Date(key.expires_at) < new Date()).length : 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Expiring This Week
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Key</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Permissions</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Usage</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {apiKey.name}
                    </Typography>
                    {apiKey.description && (
                      <Typography variant="caption" color="text.secondary">
                        {apiKey.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontFamily="monospace" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {apiKey.key.substring(0, 8)}...
                      </Typography>
                      <Tooltip title="Copy to clipboard">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(apiKey.key)}
                          data-testid={`copy-key-${apiKey.id}`}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getRoleIcon(apiKey.role || 'user')}
                      label={apiKey.role || 'user'}
                      size="small"
                      color={apiKey.role === 'admin' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {apiKey.permissions?.slice(0, 3).map((permission) => (
                        <Chip
                          key={permission}
                          label={permission}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {apiKey.permissions?.length > 3 && (
                        <Chip
                          label={`+${apiKey.permissions.length - 3} more`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={apiKey.is_active ? 'Active' : 'Inactive'}
                      color={getStatusColor(apiKey.is_active, apiKey.expires_at)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {apiKey.usage_count?.toLocaleString() || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(apiKey.created_at).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {apiKey.expires_at ? new Date(apiKey.expires_at).toLocaleDateString() : 'Never'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Regenerate key">
                      <IconButton
                        size="small"
                        onClick={() => handleRegenerateKey(apiKey.id)}
                        data-testid={`regenerate-key-${apiKey.id}`}
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete key">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteKey(apiKey.id)}
                        data-testid={`delete-key-${apiKey.id}`}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={apiKeys.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Create API Key Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Create API Key
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                name="name"
                data-testid="apikey-name-field"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                data-testid="apikey-description-field"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  name="role"
                  data-testid="apikey-role-select"
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  label="Role"
                >
                  <MenuItem value="user">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <UserIcon fontSize="small" />
                      User
                    </Box>
                  </MenuItem>
                  <MenuItem value="analyst">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AnalystIcon fontSize="small" />
                      Analyst
                    </Box>
                  </MenuItem>
                  <MenuItem value="developer">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DeveloperIcon fontSize="small" />
                      Developer
                    </Box>
                  </MenuItem>
                  <MenuItem value="admin">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AdminIcon fontSize="small" />
                      Admin
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Permissions</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={handleSelectAllPermissions}>
                    Select All
                  </Button>
                  <Button size="small" onClick={handleClearAllPermissions}>
                    Clear All
                  </Button>
                </Box>
              </Box>
              
              {loadingPermissions ? (
                <CircularProgress size={20} />
              ) : (
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {Object.entries(permissionCategories).map(([category, permissions]) => (
                    <Accordion key={category} defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1">{category}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={1}>
                          {permissions.map((permission) => (
                            <Grid item xs={12} sm={6} md={4} key={permission}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={formData.permissions.includes(permission)}
                                    onChange={(e) => handlePermissionChange(permission, e.target.checked)}
                                    size="small"
                                  />
                                }
                                label={permission}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Expires At (Optional)"
                name="expires_at"
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={!formData.name || formData.permissions.length === 0}
          >
            Create API Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Show New API Key Dialog */}
      {showNewKey && (
        <Dialog open={!!showNewKey} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>API Key Created Successfully</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Make sure to copy your API key now. You won't be able to see it again!
            </Alert>
            <TextField
              fullWidth
              label="API Key"
              value={showNewKey}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <IconButton onClick={() => copyToClipboard(showNewKey)}>
                    <CopyIcon />
                  </IconButton>
                ),
              }}
              sx={{ fontFamily: 'monospace' }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default ApiKeys; 