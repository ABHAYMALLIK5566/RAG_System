import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  CircularProgress,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Security,
  Notifications,
  Storage,
  Tune,
  ExpandMore,
  Save,
  Refresh,
  Warning,
  Info,
  Speed,
  Cached,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchSettings, updateSettings, resetSettings, clearError } from '@/store/slices/settingsSlice';
import { usePermissions } from '@/hooks/usePermissions';

const Settings: React.FC = () => {
  const dispatch = useAppDispatch();
  const { settings, isLoading, error, isSaving, saveError } = useAppSelector((state) => state.settings);
  const { permissions } = usePermissions();
  
  const [localSettings, setLocalSettings] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (permissions.system_config) {
      dispatch(fetchSettings());
    }
  }, [dispatch, permissions.system_config]);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  }, [settings]);

  useEffect(() => {
    if (localSettings) {
      setValidationErrors(validateSettings(localSettings));
    }
  }, [localSettings]);

  const validateSettings = (settings: any) => {
    const errors: Record<string, string> = {};
    // System
    if (!['DEBUG', 'INFO', 'WARNING', 'ERROR'].includes(settings.log_level)) {
      errors.log_level = 'Log level must be DEBUG, INFO, WARNING, or ERROR';
    }
    // Security
    if (settings.session_timeout < 5 || settings.session_timeout > 120) {
      errors.session_timeout = 'Session timeout must be between 5 and 120 minutes';
    }
    if (settings.max_login_attempts < 1 || settings.max_login_attempts > 10) {
      errors.max_login_attempts = 'Max login attempts must be between 1 and 10';
    }
    // RAG
    if (settings.rag_top_k < 1 || settings.rag_top_k > 50) {
      errors.rag_top_k = 'Top K Documents must be between 1 and 50';
    }
    if (settings.rag_similarity_threshold < 0 || settings.rag_similarity_threshold > 1) {
      errors.rag_similarity_threshold = 'Similarity threshold must be between 0 and 1';
    }
    if (settings.rag_max_tokens < 1000 || settings.rag_max_tokens > 8000) {
      errors.rag_max_tokens = 'Max tokens must be between 1000 and 8000';
    }
    // Cache
    if (settings.cache_ttl_seconds < 60 || settings.cache_ttl_seconds > 3600) {
      errors.cache_ttl_seconds = 'Cache TTL must be between 60 and 3600 seconds';
    }
    if (settings.cache_max_query_length < 100 || settings.cache_max_query_length > 5000) {
      errors.cache_max_query_length = 'Max query length must be between 100 and 5000';
    }
    // Storage
    if (settings.max_file_size < 1 || settings.max_file_size > 100) {
      errors.max_file_size = 'Max file size must be between 1 and 100 MB';
    }
    if (!Array.isArray(settings.allowed_file_types) || settings.allowed_file_types.length === 0) {
      errors.allowed_file_types = 'At least one file type must be allowed';
    }
    return errors;
  };

  const handleInputChange = (setting: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setLocalSettings((prev: any) => {
      const updated = { ...prev, [setting]: value };
      setValidationErrors(validateSettings(updated));
      return updated;
    });
    setHasChanges(true);
  };

  const handleSelectChange = (setting: string) => (event: SelectChangeEvent<string>) => {
    setLocalSettings((prev: any) => {
      const updated = { ...prev, [setting]: event.target.value };
      setValidationErrors(validateSettings(updated));
      return updated;
    });
    setHasChanges(true);
  };

  const handleSliderChange = (setting: string) => (event: Event, value: number | number[]) => {
    setLocalSettings((prev: any) => {
      const updated = { ...prev, [setting]: value };
      setValidationErrors(validateSettings(updated));
      return updated;
    });
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    if (localSettings && hasChanges && Object.keys(validationErrors).length === 0) {
      try {
        await dispatch(updateSettings(localSettings)).unwrap();
        setHasChanges(false);
        setSuccessMessage('Settings saved successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
        dispatch(fetchSettings()); // Reload from backend
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }
  };

  const handleResetSettings = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
      try {
        await dispatch(resetSettings()).unwrap();
        setHasChanges(false);
        setSuccessMessage('Settings reset to defaults!');
        setTimeout(() => setSuccessMessage(null), 3000);
        dispatch(fetchSettings()); // Reload from backend
      } catch (error) {
        console.error('Failed to reset settings:', error);
      }
    }
  };

  const handleClearErrors = () => {
    dispatch(clearError());
  };

  if (!permissions.system_config) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You do not have permission to access system settings.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!localSettings) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load settings. Please try refreshing the page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            System Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure system behavior, security, and performance settings
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {hasChanges && (
            <Chip
              label="Unsaved Changes"
              color="warning"
              icon={<Warning />}
            />
          )}
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSaveSettings}
            disabled={!hasChanges || isSaving || Object.keys(validationErrors).length > 0}
            data-testid="save-settings"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleResetSettings}
            disabled={isSaving}
          >
            Reset to Defaults
          </Button>
        </Box>
      </Box>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>
      )}

      {(error || saveError) && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={handleClearErrors}
        >
          {error || saveError}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* System Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Tune sx={{ mr: 1, verticalAlign: 'middle' }} />
                System Settings
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.maintenance_mode}
                    onChange={handleInputChange('maintenance_mode')}
                  />
                }
                label="Maintenance Mode"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Enable maintenance mode to restrict access during system updates
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.debug_mode}
                    onChange={handleInputChange('debug_mode')}
                  />
                }
                label="Debug Mode"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                Enable detailed logging and debugging information
              </Typography>
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Log Level</InputLabel>
                <Select
                  value={localSettings.log_level}
                  onChange={handleSelectChange('log_level')}
                  label="Log Level"
                >
                  <MenuItem value="DEBUG">DEBUG</MenuItem>
                  <MenuItem value="INFO">INFO</MenuItem>
                  <MenuItem value="WARNING">WARNING</MenuItem>
                  <MenuItem value="ERROR">ERROR</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
                Security Settings
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.enable_rate_limiting}
                    onChange={handleInputChange('enable_rate_limiting')}
                  />
                }
                label="Enable Rate Limiting"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.enable_ip_blocking}
                    onChange={handleInputChange('enable_ip_blocking')}
                  />
                }
                label="Enable IP Blocking"
              />
              
              <TextField
                fullWidth
                label="Session Timeout (minutes)"
                type="number"
                value={localSettings.session_timeout}
                onChange={handleInputChange('session_timeout')}
                margin="normal"
                inputProps={{ min: 5, max: 120 }}
                error={!!validationErrors.session_timeout}
                helperText={validationErrors.session_timeout}
              />
              
              <TextField
                fullWidth
                label="Max Login Attempts"
                type="number"
                value={localSettings.max_login_attempts}
                onChange={handleInputChange('max_login_attempts')}
                margin="normal"
                inputProps={{ min: 1, max: 10 }}
                error={!!validationErrors.max_login_attempts}
                helperText={validationErrors.max_login_attempts}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* RAG Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Speed sx={{ mr: 1, verticalAlign: 'middle' }} />
                RAG Configuration
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Top K Documents"
                    type="number"
                    value={localSettings.rag_top_k}
                    onChange={handleInputChange('rag_top_k')}
                    margin="normal"
                    inputProps={{ min: 1, max: 50 }}
                    helperText="Number of documents to retrieve"
                    error={!!validationErrors.rag_top_k}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography gutterBottom>Similarity Threshold</Typography>
                  <Slider
                    value={localSettings.rag_similarity_threshold}
                    onChange={handleSliderChange('rag_similarity_threshold')}
                    min={0}
                    max={1}
                    step={0.1}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Max Tokens"
                    type="number"
                    value={localSettings.rag_max_tokens}
                    onChange={handleInputChange('rag_max_tokens')}
                    margin="normal"
                    inputProps={{ min: 1000, max: 8000 }}
                    helperText="Maximum response tokens"
                    error={!!validationErrors.rag_max_tokens}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Cache Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Cached sx={{ mr: 1, verticalAlign: 'middle' }} />
                Cache Settings
              </Typography>
              
              <TextField
                fullWidth
                label="Cache TTL (seconds)"
                type="number"
                value={localSettings.cache_ttl_seconds}
                onChange={handleInputChange('cache_ttl_seconds')}
                margin="normal"
                inputProps={{ min: 60, max: 3600 }}
                helperText="Time to live for cached responses"
                error={!!validationErrors.cache_ttl_seconds}
              />
              
              <TextField
                fullWidth
                label="Max Query Length for Caching"
                type="number"
                value={localSettings.cache_max_query_length}
                onChange={handleInputChange('cache_max_query_length')}
                margin="normal"
                inputProps={{ min: 100, max: 5000 }}
                helperText="Maximum query length to cache"
                error={!!validationErrors.cache_max_query_length}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Storage sx={{ mr: 1, verticalAlign: 'middle' }} />
                Storage Settings
              </Typography>
              
              <TextField
                fullWidth
                label="Max File Size (MB)"
                type="number"
                value={localSettings.max_file_size}
                onChange={handleInputChange('max_file_size')}
                margin="normal"
                inputProps={{ min: 1, max: 100 }}
                error={!!validationErrors.max_file_size}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.enable_compression}
                    onChange={handleInputChange('enable_compression')}
                  />
                }
                label="Enable File Compression"
              />
              
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
                Allowed File Types: {localSettings.allowed_file_types.join(', ')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Notifications sx={{ mr: 1, verticalAlign: 'middle' }} />
                Notification Settings
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localSettings.email_notifications}
                        onChange={handleInputChange('email_notifications')}
                      />
                    }
                    label="Email Notifications"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localSettings.slack_notifications}
                        onChange={handleInputChange('slack_notifications')}
                      />
                    }
                    label="Slack Notifications"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localSettings.webhook_notifications}
                        onChange={handleInputChange('webhook_notifications')}
                      />
                    }
                    label="Webhook Notifications"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings; 