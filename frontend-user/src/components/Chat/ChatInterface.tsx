import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Analytics as AnalyticsIcon,
  Logout as LogoutIcon,
  Bookmark as BookmarkIcon,
  Rocket as RocketIcon,
  Notifications as NotificationsIcon,
  Help as HelpIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { createSession, deleteSession, getSessions } from '../../store/slices/chatSlice';
import ChatTab from './ChatTab';
import ChatInput from './ChatInput';
import ConversationList from './ConversationList';
import QuerySettings from './QuerySettings';
import SourcesPanel from './SourcesPanel';

const ChatInterface: React.FC = () => {
  console.log('ChatInterface - Component rendering with enhanced UI...');
  
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  // Responsive breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  
  // Dynamic drawer width based on screen size
  const drawerWidth = isMobile ? 280 : isTablet ? 300 : 320;
  
  const { user } = useAppSelector((state: any) => state.auth);
  const { sessions, currentSession } = useAppSelector((state: any) => state.chat);
  
  console.log('ChatInterface - user:', user);
  console.log('ChatInterface - sessions:', sessions);
  console.log('ChatInterface - currentSession:', currentSession);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showSources, setShowSources] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  // Load sessions when component mounts
  useEffect(() => {
    if (user) {
      console.log('ChatInterface - Loading sessions for user');
      dispatch(getSessions());
    }
  }, [dispatch, user]);

  // Auto-create session if user is authenticated but no sessions exist
  useEffect(() => {
    // Ensure sessions is an array for length check
    const sessionsArray = Array.isArray(sessions) ? sessions : [];
    if (user && sessionsArray.length === 0 && !currentSession) {
      console.log('ChatInterface - Auto-creating session for authenticated user');
      handleNewTab();
    }
  }, [user, sessions, currentSession]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    handleProfileMenuClose();
  };

  const handleNewTab = async () => {
    try {
      // Ensure sessions is an array for length calculation
      const sessionsArray = Array.isArray(sessions) ? sessions : [];
      const title = `New Chat ${sessionsArray.length + 1}`;
      await dispatch(createSession(title)).unwrap();
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (sessionToDelete) {
      try {
        await dispatch(deleteSession(sessionToDelete)).unwrap();
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  const navigationItems = [
    { text: 'Chat', icon: <BookmarkIcon />, path: '/', testId: 'nav-chat' },

    { text: 'Profile', icon: <PersonIcon />, path: '/profile', testId: 'nav-profile' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings', testId: 'nav-settings' },
    { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics', testId: 'nav-analytics' },
  ];

  const speedDialActions = [
    { icon: <AddIcon />, name: 'New Chat', action: handleNewTab },
  ];

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      width: drawerWidth,
      maxWidth: drawerWidth,
    }}>
      {/* Header */}
      <Box sx={{ 
        p: { xs: 1.5, sm: 2 }, 
        borderBottom: 1, 
        borderColor: 'divider', 
        flexShrink: 0 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            sx={{ 
              width: { xs: 32, sm: 40 }, 
              height: { xs: 32, sm: 40 }, 
              mr: { xs: 1, sm: 2 },
              bgcolor: theme.palette.primary.main,
              color: 'white'
            }}
          >
            {user?.username?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '1rem' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {user?.username || 'User'}
            </Typography>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              {user?.role || 'User'}
            </Typography>
          </Box>
        </Box>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 'bold', 
            color: theme.palette.primary.main,
            fontSize: { xs: '1.125rem', sm: '1.25rem' }
          }}
        >
          RAG Chat
        </Typography>
      </Box>

      {/* Navigation */}
      <Box sx={{ flexShrink: 0 }}>
        <List sx={{ py: 0 }}>
          {navigationItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton 
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                data-testid={item.testId}
                sx={{
                  borderRadius: 1,
                  mx: { xs: 0.5, sm: 1 },
                  mb: 0.5,
                  py: { xs: 1, sm: 1.5 },
                  '&:hover': {
                    backgroundColor: theme.palette.primary.light + '20',
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  color: theme.palette.primary.main,
                  minWidth: { xs: 36, sm: 40 }
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ 
                    fontWeight: 500,
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: { xs: 1, sm: 2 } }} />
      </Box>

      {/* Conversations */}
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <ConversationList />
      </Box>

      {/* Footer */}
      <Box sx={{ 
        p: { xs: 1.5, sm: 2 }, 
        borderTop: 1, 
        borderColor: 'divider', 
        flexShrink: 0 
      }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleNewTab}
          sx={{ 
            mb: 1,
            py: { xs: 0.75, sm: 1 },
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}
        >
          New Chat
        </Button>
        <Button
          fullWidth
          variant="text"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          color="error"
          sx={{ 
            py: { xs: 0.75, sm: 1 },
            fontSize: { xs: '0.875rem', sm: '1rem' }
          }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh', 
      overflow: 'hidden',
      width: '100vw',
      maxWidth: '100vw'
    }}>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: drawerWidth,
            maxWidth: '90vw'
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: drawerWidth,
            overflow: 'hidden',
            position: 'fixed',
            height: '100vh',
            zIndex: 1200,
            left: 0,
            top: 0,
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100vw - ${drawerWidth}px)` },
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          ml: { md: `${drawerWidth}px` },
          position: 'relative',
          overflow: 'hidden',
          maxWidth: '100%',
        }}
      >
        {/* App Bar */}
        <AppBar
          position="static"
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
            flexShrink: 0,
            zIndex: 1100,
          }}
          elevation={0}
        >
          <Toolbar sx={{ 
            px: { xs: 1, sm: 2 },
            py: { xs: 0.5, sm: 1 }
          }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ 
                mr: { xs: 1, sm: 2 }, 
                display: { md: 'none' },
                color: theme.palette.text.primary
              }}
            >
              <MenuIcon />
            </IconButton>

            <Typography 
              variant="h6" 
              noWrap 
              component="div" 
              sx={{ 
                flexGrow: 1, 
                color: theme.palette.text.primary,
                fontSize: { xs: '1rem', sm: '1.25rem' },
                fontWeight: 600
              }}
            >
              RAG Query System
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="User Menu">
                <IconButton
                  color="inherit"
                  onClick={handleProfileMenuOpen}
                  sx={{ color: theme.palette.text.primary }}
                >
                  <Avatar sx={{ 
                    width: { xs: 28, sm: 32 }, 
                    height: { xs: 28, sm: 32 } 
                  }}>
                    {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Chat Content */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <ChatTab />
          <ChatInput />
          
          {/* Speed Dial for Quick Actions */}
          <SpeedDial
            ariaLabel="Quick actions"
            sx={{ 
              position: 'absolute', 
              bottom: { xs: 70, sm: 80 },
              right: { xs: 12, sm: 16 },
              zIndex: 50,
            }}
            icon={<SpeedDialIcon />}
            open={speedDialOpen}
            onOpen={() => setSpeedDialOpen(true)}
            onClose={() => setSpeedDialOpen(false)}
          >
            {speedDialActions.map((action) => (
              <SpeedDialAction
                key={action.name}
                icon={action.icon}
                tooltipTitle={action.name}
                onClick={action.action}
              />
            ))}
          </SpeedDial>
        </Box>

        {/* Sources Panel */}
        {showSources && (
          <SourcesPanel />
        )}

        {/* Settings Panel */}
        {showSettings && (
          <QuerySettings />
        )}
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            minWidth: { xs: 150, sm: 180 },
            mt: 1
          }
        }}
      >
        <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { navigate('/settings'); handleProfileMenuClose(); }}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleCancelDelete}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Delete Conversation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this conversation? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatInterface; 