import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Switch,
  Slider,
  Button,
  LinearProgress,
  useMediaQuery,
  useTheme,
  Alert,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import Fade from '@mui/material/Fade';
import Zoom from '@mui/material/Zoom';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { useGetUserSettingsQuery, useUpdateUserSettingsMutation, useResetUserSettingsMutation } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../contexts/UIContext';
import notificationService from '../../utils/notifications';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { settings: uiSettings, updateSetting: updateUISetting } = useUI();
  const { data: userSettings, isLoading, error, refetch } = useGetUserSettingsQuery(undefined);
  const [updateSettings, { isLoading: isUpdating }] = useUpdateUserSettingsMutation();
  const [resetSettings, { isLoading: isResetting }] = useResetUserSettingsMutation();
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [settings, setSettings] = useState({
    // Appearance
    darkMode: false,
    fontSize: 14,
    theme: 'light',
    compactMode: false,
    
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    soundEnabled: true,
    notificationFrequency: 'immediate',
    
    // Privacy & Security
    autoSave: true,
    dataCollection: false,
    analytics: true,
    sessionTimeout: 30,
    
    // Performance
    cacheEnabled: true,
    autoRefresh: false,
    lowBandwidthMode: false,
    
    // Chat Settings
    messageHistory: 100,
    typingIndicators: true,
    readReceipts: true,
    autoScroll: true,
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Sync UI context with local settings when they change
  useEffect(() => {
    if (isInitialized) {
      // Only sync if the UI context is different from local settings
      if (uiSettings.darkMode !== settings.darkMode) {
        updateUISetting('darkMode', settings.darkMode);
      }
      if (uiSettings.compactMode !== settings.compactMode) {
        updateUISetting('compactMode', settings.compactMode);
      }
      if (uiSettings.fontSize !== settings.fontSize) {
        updateUISetting('fontSize', settings.fontSize);
      }
      if (uiSettings.theme !== settings.theme) {
        updateUISetting('theme', settings.theme);
      }
    }
  }, [settings.darkMode, settings.compactMode, settings.fontSize, settings.theme, isInitialized, uiSettings, updateUISetting]);

  // Load settings from API when data is available
  useEffect(() => {
    console.log('Settings: userSettings changed:', userSettings);
    console.log('Settings: isInitialized:', isInitialized);
    
    if (userSettings?.settings && !isInitialized) {
      const apiSettings = userSettings.settings;
      console.log('Settings: Loading from API:', apiSettings);
      
      const newSettings = {
        // Appearance
        darkMode: apiSettings.dark_mode,
        fontSize: apiSettings.font_size,
        theme: apiSettings.theme,
        compactMode: apiSettings.compact_mode,
        
        // Notifications
        emailNotifications: apiSettings.email_notifications,
        pushNotifications: apiSettings.push_notifications,
        soundEnabled: apiSettings.sound_enabled,
        notificationFrequency: apiSettings.notification_frequency,
        
        // Privacy & Security
        autoSave: apiSettings.auto_save,
        dataCollection: apiSettings.data_collection,
        analytics: apiSettings.analytics,
        sessionTimeout: apiSettings.session_timeout,
        
        // Performance
        cacheEnabled: apiSettings.cache_enabled,
        autoRefresh: apiSettings.auto_refresh,
        lowBandwidthMode: apiSettings.low_bandwidth_mode,
        
        // Chat Settings
        messageHistory: apiSettings.message_history,
        typingIndicators: apiSettings.typing_indicators,
        readReceipts: apiSettings.read_receipts,
        autoScroll: apiSettings.auto_scroll,
      };
      
      console.log('Settings: Setting new settings:', newSettings);
      setSettings(newSettings);
      
      // Always update UI context with API settings to ensure consistency
      console.log('Settings: Updating UI context with API settings');
      updateUISetting('darkMode', apiSettings.dark_mode);
      updateUISetting('fontSize', apiSettings.font_size);
      updateUISetting('theme', apiSettings.theme);
      updateUISetting('compactMode', apiSettings.compact_mode);
      
      setIsInitialized(true);
    }
  }, [userSettings, updateUISetting, isInitialized]);

  // Initialize with UI context values if API hasn't loaded yet
  useEffect(() => {
    console.log('Settings: Fallback init check - isInitialized:', isInitialized, 'isLoading:', isLoading, 'userSettings:', !!userSettings);
    
    if (!isInitialized && !isLoading && !userSettings) {
      console.log('Settings: Using UI context fallback values:', uiSettings);
      // Use UI context values as fallback
      setSettings(prev => ({
        ...prev,
        darkMode: uiSettings.darkMode,
        fontSize: uiSettings.fontSize,
        theme: uiSettings.theme,
        compactMode: uiSettings.compactMode,
      }));
      setIsInitialized(true);
    }
  }, [uiSettings, isInitialized, isLoading, userSettings]);

  const handleSettingChange = (key: string, value: any) => {
    console.log(`Setting ${key} to ${value}`); // Debug log
    
    // Update UI context immediately for real-time changes
    if (key === 'darkMode') {
      console.log('Updating UI darkMode to:', value);
      updateUISetting('darkMode', value);
    } else if (key === 'compactMode') {
      console.log('Updating UI compactMode to:', value);
      updateUISetting('compactMode', value);
    } else if (key === 'fontSize') {
      console.log('Updating UI fontSize to:', value);
      updateUISetting('fontSize', value);
    } else if (key === 'theme') {
      console.log('Updating UI theme to:', value);
      updateUISetting('theme', value);
    }
    
    // Update local settings state
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaveStatus('idle');
    
    try {
      // Convert frontend settings to API format
      const apiSettings = {
        dark_mode: settings.darkMode,
        font_size: settings.fontSize,
        theme: settings.theme,
        compact_mode: settings.compactMode,
        email_notifications: settings.emailNotifications,
        push_notifications: settings.pushNotifications,
        sound_enabled: settings.soundEnabled,
        notification_frequency: settings.notificationFrequency,
        auto_save: settings.autoSave,
        data_collection: settings.dataCollection,
        analytics: settings.analytics,
        session_timeout: settings.sessionTimeout,
        cache_enabled: settings.cacheEnabled,
        auto_refresh: settings.autoRefresh,
        low_bandwidth_mode: settings.lowBandwidthMode,
        message_history: settings.messageHistory,
        typing_indicators: settings.typingIndicators,
        read_receipts: settings.readReceipts,
        auto_scroll: settings.autoScroll,
      };
      
      await updateSettings(apiSettings).unwrap();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
      refetch();
    } catch (error) {
      setSaveStatus('error');
    }
  };

  const handleReset = async () => {
    try {
      await resetSettings(undefined).unwrap();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
      refetch();
    } catch (error) {
      setSaveStatus('error');
    }
  };



  if (isLoading) {
    return (
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading settings...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Alert severity="error">
          Failed to load settings. Please try refreshing the page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 }, 
      maxWidth: 1200, 
      mx: 'auto',
      minHeight: '100vh'
    }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' }, 
        mb: { xs: 3, sm: 2 },
        gap: { xs: 2, sm: 0 }
      }}>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/')} 
          sx={{ 
            mr: { xs: 0, sm: 2 },
            alignSelf: { xs: 'stretch', sm: 'flex-start' },
            py: { xs: 1.5, sm: 1 }
          }}
        >
          Back to Chat
        </Button>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 'bold', 
            mb: 0,
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
            textAlign: { xs: 'center', sm: 'left' }
          }}
        >
          Settings
        </Typography>
      </Box>

      {saveStatus === 'success' && (
        <Fade in={true}>
          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
            Settings saved successfully!
          </Alert>
        </Fade>
      )}

      {saveStatus === 'error' && (
        <Fade in={true}>
          <Alert severity="error" sx={{ mb: 2 }} icon={<WarningIcon />}>
            Failed to save settings. Please try again.
          </Alert>
        </Fade>
      )}

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {/* Appearance Settings */}
        <Grid item xs={12} lg={6}>
          <Zoom in={true}>
            <Card elevation={3} sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <PaletteIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Appearance
                  </Typography>
                </Box>

                <List dense>
                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Dark Mode" 
                      secondary="Switch between light and dark themes"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.darkMode}
                        onChange={(e) => {
                          console.log('Dark Mode switch clicked, new value:', e.target.checked);
                          handleSettingChange('darkMode', e.target.checked);
                        }}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Compact Mode" 
                      secondary="Reduce spacing for more content"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.compactMode}
                        onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Font Size" 
                      secondary={`${settings.fontSize}px`}
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Slider
                        value={settings.fontSize}
                        onChange={(_, value) => handleSettingChange('fontSize', value)}
                        min={12}
                        max={20}
                        step={1}
                        sx={{ width: { xs: 80, sm: 100 } }}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12} lg={6}>
          <Zoom in={true} style={{ transitionDelay: '100ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <NotificationsIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Notifications
                  </Typography>
                </Box>

                <List dense>
                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Email Notifications" 
                      secondary="Receive updates via email"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.emailNotifications}
                        onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Push Notifications" 
                      secondary="Browser push notifications"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.pushNotifications}
                        onChange={(e) => handleSettingChange('pushNotifications', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Sound Effects" 
                      secondary="Play sounds for notifications"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.soundEnabled}
                        onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Notification Frequency" 
                      secondary="How often to receive notifications"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 140 } }}>
                        <Select
                          value={settings.notificationFrequency}
                          onChange={(e) => handleSettingChange('notificationFrequency', e.target.value)}
                        >
                          <MenuItem value="immediate">Immediate</MenuItem>
                          <MenuItem value="hourly">Hourly</MenuItem>
                          <MenuItem value="daily">Daily</MenuItem>
                          <MenuItem value="weekly">Weekly</MenuItem>
                        </Select>
                      </FormControl>
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Privacy & Security */}
        <Grid item xs={12} lg={6}>
          <Zoom in={true} style={{ transitionDelay: '200ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <SecurityIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Privacy & Security
                  </Typography>
                </Box>

                <List dense>
                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Auto-save" 
                      secondary="Automatically save your work"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.autoSave}
                        onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Data Collection" 
                      secondary="Allow usage analytics"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.dataCollection}
                        onChange={(e) => handleSettingChange('dataCollection', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Analytics" 
                      secondary="Help improve the app"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.analytics}
                        onChange={(e) => handleSettingChange('analytics', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Session Timeout" 
                      secondary={`${settings.sessionTimeout} minutes`}
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Slider
                        value={settings.sessionTimeout}
                        onChange={(_, value) => handleSettingChange('sessionTimeout', value)}
                        min={5}
                        max={120}
                        step={5}
                        sx={{ width: { xs: 80, sm: 100 } }}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Performance Settings */}
        <Grid item xs={12} lg={6}>
          <Zoom in={true} style={{ transitionDelay: '300ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <SpeedIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Performance
                  </Typography>
                </Box>

                <List dense>
                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Cache Enabled" 
                      secondary="Store data locally for faster access"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.cacheEnabled}
                        onChange={(e) => handleSettingChange('cacheEnabled', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Auto Refresh" 
                      secondary="Automatically refresh data"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.autoRefresh}
                        onChange={(e) => handleSettingChange('autoRefresh', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                    <ListItemText 
                      primary="Low Bandwidth Mode" 
                      secondary="Reduce data usage"
                      primaryTypographyProps={{
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                      secondaryTypographyProps={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                      }}
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.lowBandwidthMode}
                        onChange={(e) => handleSettingChange('lowBandwidthMode', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Chat Settings */}
        <Grid item xs={12}>
          <Zoom in={true} style={{ transitionDelay: '400ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <StorageIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Chat Settings
                  </Typography>
                </Box>

                <Grid container spacing={{ xs: 2, sm: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <List dense>
                      <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                        <ListItemText 
                          primary="Typing Indicators" 
                          secondary="Show when someone is typing"
                          primaryTypographyProps={{
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }}
                          secondaryTypographyProps={{
                            fontSize: { xs: '0.75rem', sm: '0.875rem' }
                          }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={settings.typingIndicators}
                            onChange={(e) => handleSettingChange('typingIndicators', e.target.checked)}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>

                      <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                        <ListItemText 
                          primary="Read Receipts" 
                          secondary="Show message read status"
                          primaryTypographyProps={{
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }}
                          secondaryTypographyProps={{
                            fontSize: { xs: '0.75rem', sm: '0.875rem' }
                          }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={settings.readReceipts}
                            onChange={(e) => handleSettingChange('readReceipts', e.target.checked)}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <List dense>
                      <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                        <ListItemText 
                          primary="Auto Scroll" 
                          secondary="Automatically scroll to new messages"
                          primaryTypographyProps={{
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }}
                          secondaryTypographyProps={{
                            fontSize: { xs: '0.75rem', sm: '0.875rem' }
                          }}
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={settings.autoScroll}
                            onChange={(e) => handleSettingChange('autoScroll', e.target.checked)}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>

                      <ListItem sx={{ px: { xs: 0, sm: 1 } }}>
                        <ListItemText 
                          primary="Message History" 
                          secondary={`Keep last ${settings.messageHistory} messages`}
                          primaryTypographyProps={{
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                          }}
                          secondaryTypographyProps={{
                            fontSize: { xs: '0.75rem', sm: '0.875rem' }
                          }}
                        />
                        <ListItemSecondaryAction>
                          <Slider
                            value={settings.messageHistory}
                            onChange={(_, value) => handleSettingChange('messageHistory', value)}
                            min={50}
                            max={500}
                            step={50}
                            sx={{ width: { xs: 80, sm: 100 } }}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Zoom in={true} style={{ transitionDelay: '500ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: { xs: 1, sm: 2 }, 
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Actions
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Save or reset your settings
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 2 }
                  }}>
                    <Button
                      variant="outlined"
                      onClick={handleReset}
                      startIcon={<RefreshIcon />}
                      sx={{ 
                        py: { xs: 1.5, sm: 1 },
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                    >
                      Reset to Defaults
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSave}
                      disabled={isUpdating}
                      startIcon={<SaveIcon />}
                      sx={{ 
                        py: { xs: 1.5, sm: 1 },
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }}
                    >
                      {isUpdating ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </Box>
                </Box>
                
                {(isUpdating || isResetting) && (
                  <LinearProgress sx={{ mt: 2 }} />
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings; 