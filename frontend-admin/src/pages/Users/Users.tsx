import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  InputAdornment,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Snackbar,
  Tooltip,
  Card,
  CardContent,
  Divider,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  AdminPanelSettings as AdminIcon,
  CheckCircle as ActiveIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchUsers, createUser, updateUser, deleteUser, clearError, clearSuccess, setRefreshSuccess } from '@/store/slices/usersSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { User, UserRole } from '@/types';

interface UserFormData {
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  password: string;
}

interface DeleteConfirmationData {
  userId: string;
  username: string;
  adminPassword: string;
}

const Users: React.FC = () => {
  const dispatch = useAppDispatch();
  const { users, isLoading, error, successMessage } = useAppSelector((state) => state.users);
  const { permissions, isViewOnly } = usePermissions();
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationData>({
    userId: '',
    username: '',
    adminPassword: '',
  });
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    full_name: '',
    role: UserRole.USER,
    is_active: true,
    password: '',
  });

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      // Auto-clear error after 5 seconds
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  useEffect(() => {
    if (successMessage) {
      // Auto-clear success message after 4 seconds
      const timer = setTimeout(() => {
        dispatch(clearSuccess());
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, dispatch]);

  const handleRefreshUsers = async () => {
    await dispatch(fetchUsers()).unwrap();
    dispatch(setRefreshSuccess());
  };

  const handleOpenDialog = (user?: User) => {
    // Check permissions before opening dialog
    if (!permissions.canCreateUsers && !user) {
      alert('You do not have permission to create users.');
      return;
    }
    if (!permissions.canEditUsers && user) {
      alert('You do not have permission to edit users.');
      return;
    }

    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        full_name: user.full_name || '',
        role: user.role,
        is_active: user.is_active,
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        full_name: '',
        role: UserRole.USER,
        is_active: true,
        password: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    dispatch(clearError()); // Clear any previous errors
  };

  const handleSubmit = async () => {
    // Check permissions before submitting
    if (!permissions.canCreateUsers && !editingUser) {
      alert('You do not have permission to create users.');
      return;
    }
    if (!permissions.canEditUsers && editingUser) {
      alert('You do not have permission to edit users.');
      return;
    }

    try {
      if (editingUser) {
        await dispatch(updateUser({ id: editingUser.id, userData: formData })).unwrap();
      } else {
        await dispatch(createUser(formData)).unwrap();
      }
      handleCloseDialog();
      dispatch(fetchUsers());
    } catch (error: any) {
      console.error('Failed to save user:', error);
    }
  };

  const handleOpenDeleteDialog = (user: User) => {
    if (!permissions.canDeleteUsers) {
      alert('You do not have permission to delete users.');
      return;
    }
    
    setDeleteConfirmation({
      userId: user.id,
      username: user.username,
      adminPassword: '',
    });
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setDeleteConfirmation({
      userId: '',
      username: '',
      adminPassword: '',
    });
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmation.adminPassword) {
      alert('Please enter your admin password to confirm deletion.');
      return;
    }

    try {
      // Use the secure delete endpoint that verifies admin password server-side
      const response = await fetch(`${window.APP_CONFIG?.API_BASE_URL || 'http://localhost:8000'}/api/v1/admin/users/${deleteConfirmation.userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_auth_token')}`,
        },
        body: JSON.stringify({
          admin_password: deleteConfirmation.adminPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.detail || 'Failed to delete user. Please check your password and try again.');
        return;
      }

      const result = await response.json();
      
      // Update the Redux store by removing the deleted user
      dispatch(deleteUser(deleteConfirmation.userId));
      handleCloseDeleteDialog();
      
      // Show success message
      alert(result.message || 'User deleted successfully');
      
      // Refresh the users list
      dispatch(fetchUsers());
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user. Please try again.');
    }
  };

  const filteredUsers = Array.isArray(users) ? users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  ) : [];

  const paginatedUsers = filteredUsers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'error';
      case UserRole.DEVELOPER:
        return 'warning';
      case UserRole.ANALYST:
        return 'info';
      default:
        return 'default';
    }
  };

  // Enhanced statistics calculations
  const totalUsers = Array.isArray(users) ? users.length : 0;
  const activeUsers = Array.isArray(users) ? users.filter(u => u.is_active).length : 0;
  const adminUsers = Array.isArray(users) ? users.filter(u => u.role === UserRole.ADMIN).length : 0;
  const inactiveUsers = totalUsers - activeUsers;

  if (isLoading && users.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Section */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 4,
        pb: 2,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Box>
          <Typography variant="h4" data-testid="users-title" sx={{ fontWeight: 600, color: 'primary.main' }}>
            User Management
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
              ? 'View system users and their information'
              : 'Manage system users, roles, and permissions'
            }
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh user list">
            <IconButton
              onClick={handleRefreshUsers}
              disabled={isLoading}
              data-testid="refresh-users-button"
              sx={{ 
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {permissions.canCreateUsers && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              size="large"
              onClick={() => handleOpenDialog()}
              data-testid="add-user-button"
              sx={{ 
                px: 3,
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              Add New User
            </Button>
          )}
        </Box>
      </Box>

      {/* View Only Notice */}
      {isViewOnly && (
        <Alert 
          severity="info" 
          sx={{ mb: 3, borderRadius: 2 }}
          icon={<ViewIcon />}
        >
          <Typography variant="body2">
            <strong>View Only Mode:</strong> You can view user information but cannot create, edit, or delete users.
          </Typography>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
            color: 'white',
            '&:hover': { transform: 'translateY(-2px)' },
            transition: 'transform 0.2s ease-in-out'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                    {totalUsers}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Users
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)',
            color: 'white',
            '&:hover': { transform: 'translateY(-2px)' },
            transition: 'transform 0.2s ease-in-out'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                    {activeUsers}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Active Users
                  </Typography>
                </Box>
                <ActiveIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #ed6c02 0%, #ff9800 100%)',
            color: 'white',
            '&:hover': { transform: 'translateY(-2px)' },
            transition: 'transform 0.2s ease-in-out'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                    {adminUsers}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Administrators
                  </Typography>
                </Box>
                <AdminIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #757575 0%, #9e9e9e 100%)',
            color: 'white',
            '&:hover': { transform: 'translateY(-2px)' },
            transition: 'transform 0.2s ease-in-out'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                    {inactiveUsers}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Inactive Users
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="🔍 Search users by username, email, or full name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          data-testid="user-search"
          sx={{ 
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
              },
            },
          }}
        />
      </Box>

      {/* Users Table */}
      <Paper sx={{ 
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        border: '1px solid',
        borderColor: 'divider'
      }} data-testid="users-table">
        
        {/* Loading Indicator */}
        {isLoading && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            py: 4,
            bgcolor: 'background.default'
          }}>
            <CircularProgress size={32} sx={{ mr: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Loading users...
            </Typography>
          </Box>
        )}

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ 
                  bgcolor: 'grey.50', 
                  fontWeight: 600,
                  borderBottom: 2,
                  borderColor: 'divider'
                }}>
                  Username
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: 'grey.50', 
                  fontWeight: 600,
                  borderBottom: 2,
                  borderColor: 'divider'
                }}>
                  Email
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: 'grey.50', 
                  fontWeight: 600,
                  borderBottom: 2,
                  borderColor: 'divider'
                }}>
                  Full Name
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: 'grey.50', 
                  fontWeight: 600,
                  borderBottom: 2,
                  borderColor: 'divider'
                }}>
                  Role
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: 'grey.50', 
                  fontWeight: 600,
                  borderBottom: 2,
                  borderColor: 'divider'
                }}>
                  Status
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: 'grey.50', 
                  fontWeight: 600,
                  borderBottom: 2,
                  borderColor: 'divider'
                }}>
                  Created Date
                </TableCell>
                <TableCell sx={{ 
                  bgcolor: 'grey.50', 
                  fontWeight: 600,
                  borderBottom: 2,
                  borderColor: 'divider'
                }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                  <TableRow 
                    key={user.id} 
                    sx={{ 
                      '&:hover': { 
                        bgcolor: alpha('#1976d2', 0.04),
                        transform: 'scale(1.001)',
                        transition: 'all 0.2s ease-in-out'
                      },
                      '&:nth-of-type(even)': {
                        bgcolor: alpha('#f5f5f5', 0.3)
                      },
                      cursor: 'pointer'
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: '50%', 
                          bgcolor: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2
                        }}>
                          <Typography variant="body2" color="white" sx={{ fontWeight: 600 }}>
                            {user.username.charAt(0).toUpperCase()}
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontWeight="medium">
                          {user.username}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {user.full_name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.role}
                        color={getRoleColor(user.role)}
                        size="small"
                        variant="outlined"
                        sx={{ 
                          fontWeight: 500,
                          borderRadius: 2
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active ? 'Active' : 'Inactive'}
                        color={user.is_active ? 'success' : 'default'}
                        size="small"
                        icon={user.is_active ? <ActiveIcon /> : undefined}
                        sx={{ 
                          fontWeight: 500,
                          borderRadius: 2
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {permissions.canEditUsers ? (
                          <Tooltip title="Edit user">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(user)}
                              data-testid={`edit-user-${user.id}`}
                              sx={{ 
                                bgcolor: 'primary.light',
                                color: 'primary.main',
                                '&:hover': { bgcolor: 'primary.main', color: 'white' }
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="View user details">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(user)}
                              data-testid={`view-user-${user.id}`}
                              sx={{ 
                                bgcolor: 'info.light',
                                color: 'info.main',
                                '&:hover': { bgcolor: 'info.main', color: 'white' }
                              }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {permissions.canDeleteUsers && (
                          <Tooltip title="Delete user">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDeleteDialog(user)}
                              data-testid={`delete-user-${user.id}`}
                              sx={{ 
                                bgcolor: 'error.light',
                                color: 'error.main',
                                '&:hover': { bgcolor: 'error.main', color: 'white' }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box sx={{ py: 8 }}>
                      <PeopleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                        {searchTerm ? 'No users found' : 'No users yet'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {searchTerm 
                          ? 'Try adjusting your search terms or clear the search to see all users.'
                          : 'Get started by adding your first user to the system.'
                        }
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Divider />
        <TablePagination
          component="div"
          count={filteredUsers.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          showFirstButton
          showLastButton
          sx={{ 
            bgcolor: 'grey.50',
            '& .MuiTablePagination-toolbar': {
              px: 3
            }
          }}
        />
      </Paper>

      {/* Enhanced Delete Confirmation Dialog */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={handleCloseDeleteDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ 
          color: 'error.main',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1
        }}>
          <DeleteIcon />
          Confirm User Deletion
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              ⚠️ This action cannot be undone!
            </Typography>
            You are about to permanently delete user: <strong>{deleteConfirmation.username}</strong>
            <br />
            All associated data will be removed from the system.
          </Alert>
          <TextField
            fullWidth
            label="Enter your admin password to confirm"
            type="password"
            value={deleteConfirmation.adminPassword}
            onChange={(e) => setDeleteConfirmation({ 
              ...deleteConfirmation, 
              adminPassword: e.target.value 
            })}
            required
            sx={{ 
              mt: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
            helperText="Admin password verification is required for user deletion"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={handleCloseDeleteDialog}
            variant="outlined"
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteUser} 
            variant="contained" 
            color="error"
            disabled={!deleteConfirmation.adminPassword || isLoading}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            {isLoading ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Add/Edit User Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1
        }}>
          {permissions.canEditUsers ? <PersonAddIcon color="primary" /> : <ViewIcon color="info" />}
          {editingUser 
            ? (permissions.canEditUsers ? 'Edit User' : 'View User Details')
            : 'Add New User'
          }
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                data-testid="username-field"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={!!editingUser || !permissions.canEditUsers}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
                helperText={
                  editingUser 
                    ? "Username cannot be changed" 
                    : permissions.canCreateUsers 
                      ? "Choose a unique username"
                      : "View only"
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                name="email"
                data-testid="email-field"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isViewOnly}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
                helperText={isViewOnly ? "View only" : "Enter a valid email address"}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                name="full_name"
                data-testid="fullname-field"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                disabled={isViewOnly}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
                helperText={isViewOnly ? "View only" : "Enter the user's full name (optional)"}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  name="role"
                  data-testid="role-select"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  label="Role"
                  disabled={isViewOnly}
                  sx={{ 
                    borderRadius: 2
                  }}
                >
                  <MenuItem value={UserRole.USER}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon fontSize="small" />
                      User
                    </Box>
                  </MenuItem>
                  <MenuItem value={UserRole.ANALYST}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ActiveIcon fontSize="small" />
                      Analyst
                    </Box>
                  </MenuItem>
                  <MenuItem value={UserRole.DEVELOPER}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonAddIcon fontSize="small" />
                      Developer
                    </Box>
                  </MenuItem>
                  <MenuItem value={UserRole.ADMIN}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AdminIcon fontSize="small" />
                      Admin
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {!editingUser && permissions.canCreateUsers && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  name="password"
                  data-testid="password-field"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  helperText="Minimum 6 characters required"
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    color="primary"
                    disabled={isViewOnly}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ActiveIcon fontSize="small" color={formData.is_active ? 'success' : 'disabled'} />
                    Active User
                  </Box>
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button 
            onClick={handleCloseDialog} 
            data-testid="cancel-button"
            variant="outlined"
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            {isViewOnly ? 'Close' : 'Cancel'}
          </Button>
          {!isViewOnly && (
            <Button 
              onClick={handleSubmit} 
              variant="contained" 
              data-testid="submit-button"
              disabled={isLoading}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              {isLoading ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => dispatch(clearSuccess())}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => dispatch(clearSuccess())} 
          severity="success" 
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Users; 