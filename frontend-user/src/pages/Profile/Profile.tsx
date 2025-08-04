import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Grid,
  TextField,
  Button,
  Divider,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Email,
  CalendarToday,
  Security,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useAppSelector } from '../../store';
import { useGetCurrentUserQuery, useUpdateProfileMutation } from '../../services/api';

const Profile: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { data: currentUser, isLoading } = useGetCurrentUserQuery({});
  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();
  
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleProfileUpdate = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      await updateProfile({
        username: formData.username,
        email: formData.email,
      }).unwrap();
      
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err: any) {
      setError(err.data?.detail || 'Failed to update profile');
    }
  };

  const handlePasswordChange = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      
      await updateProfile({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      }).unwrap();
      
      setSuccess('Password updated successfully!');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (err: any) {
      setError(err.data?.detail || 'Failed to update password');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({
      username: user?.username || '',
      email: user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setError(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading profile...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Profile Settings
      </Typography>

      {error && (
        <Fade in={!!error}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        </Fade>
      )}

      {success && (
        <Fade in={!!success}>
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        </Fade>
      )}

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={4}>
          <Zoom in={true}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Avatar 
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      mr: 3,
                      bgcolor: 'primary.main',
                      fontSize: '2rem',
                      fontWeight: 'bold'
                    }} 
                    data-testid="profile-avatar"
                  >
                    {currentUser?.username?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {currentUser?.username || user?.username}
                    </Typography>
                    <Chip 
                      label={currentUser?.role || user?.role || 'User'} 
                      color="primary" 
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <Email color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Email" 
                      secondary={currentUser?.email || user?.email}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CalendarToday color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Joined" 
                      secondary={new Date(currentUser?.created_at || user?.created_at || new Date()).toLocaleDateString()}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Security color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Status" 
                      secondary={
                        <Chip 
                          label={currentUser?.is_active ? 'Active' : 'Inactive'} 
                          color={currentUser?.is_active ? 'success' : 'error'}
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Update Profile Form */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            {/* Profile Settings */}
            <Grid item xs={12}>
              <Zoom in={true} style={{ transitionDelay: '100ms' }}>
                <Card elevation={3} sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Profile Information
                      </Typography>
                      <Box>
                        {isEditing ? (
                          <>
                            <Tooltip title="Save changes">
                              <IconButton 
                                color="primary" 
                                onClick={handleProfileUpdate}
                                disabled={isUpdating}
                              >
                                <SaveIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton color="error" onClick={handleCancelEdit}>
                                <CancelIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <Tooltip title="Edit profile">
                            <IconButton color="primary" onClick={() => setIsEditing(true)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Username"
                          value={formData.username}
                          onChange={handleInputChange('username')}
                          disabled={!isEditing}
                          sx={{ mb: 2 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange('email')}
                          disabled={!isEditing}
                          sx={{ mb: 2 }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>

            {/* Change Password Form */}
            <Grid item xs={12}>
              <Zoom in={true} style={{ transitionDelay: '200ms' }}>
                <Card elevation={3} sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Change Password
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Current Password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.currentPassword}
                          onChange={handleInputChange('currentPassword')}
                          sx={{ mb: 2 }}
                          InputProps={{
                            endAdornment: (
                              <IconButton
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                              >
                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="New Password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={formData.newPassword}
                          onChange={handleInputChange('newPassword')}
                          sx={{ mb: 2 }}
                          InputProps={{
                            endAdornment: (
                              <IconButton
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                edge="end"
                              >
                                {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Confirm New Password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={handleInputChange('confirmPassword')}
                          sx={{ mb: 2 }}
                          InputProps={{
                            endAdornment: (
                              <IconButton
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                edge="end"
                              >
                                {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            ),
                          }}
                        />
                      </Grid>
                    </Grid>
                    
                    <Button
                      variant="contained"
                      onClick={handlePasswordChange}
                      disabled={isUpdating || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
                      startIcon={<Security />}
                      sx={{ mt: 1 }}
                    >
                      {isUpdating ? 'Updating...' : 'Update Password'}
                    </Button>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>

            {/* Preferences */}
            <Grid item xs={12}>
              <Zoom in={true} style={{ transitionDelay: '300ms' }}>
                <Card elevation={3} sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Preferences
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={<Switch defaultChecked />}
                          label="Email Notifications"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={<Switch />}
                          label="Dark Mode"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={<Switch defaultChecked />}
                          label="Auto-save"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={<Switch />}
                          label="Analytics"
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile; 