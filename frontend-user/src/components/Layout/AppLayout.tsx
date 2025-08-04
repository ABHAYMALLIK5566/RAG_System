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
  Button,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Person as PersonIcon,
  Analytics as AnalyticsIcon,
  Logout as LogoutIcon,
  Bookmark as BookmarkIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { logout } from '../../store/slices/authSlice';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  
  // Responsive breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  
  // Dynamic drawer width based on screen size
  const drawerWidth = isMobile ? 280 : isTablet ? 300 : 320;
  
  const { user } = useAppSelector((state: any) => state.auth);
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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

  const navigationItems = [
    { text: 'Chat', icon: <BookmarkIcon />, path: '/', testId: 'nav-chat' },
    { text: 'Profile', icon: <PersonIcon />, path: '/profile', testId: 'nav-profile' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings', testId: 'nav-settings' },
    { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics', testId: 'nav-analytics' },
  ];

  const drawer = (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      bgcolor: 'background.paper',
      borderRight: '1px solid',
      borderColor: 'divider'
    }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: '1px solid', 
        borderColor: 'divider',
        bgcolor: 'background.default'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            sx={{ 
              width: 48, 
              height: 48, 
              mr: 2,
              bgcolor: 'primary.main',
              fontSize: '1.25rem',
              fontWeight: 'bold'
            }}
          >
            {user?.username?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
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
                selected={location.pathname === item.path}
                data-testid={item.testId}
                sx={{
                  borderRadius: 1,
                  mx: { xs: 0.5, sm: 1 },
                  mb: 0.5,
                  py: { xs: 1, sm: 1.5 },
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.light + '20',
                    '&:hover': {
                      backgroundColor: theme.palette.primary.light + '30',
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.primary.light + '20',
                  },
                }}
              >
                <ListItemIcon sx={{ 
                  color: location.pathname === item.path ? theme.palette.primary.main : 'inherit',
                  minWidth: { xs: 36, sm: 40 }
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontWeight: location.pathname === item.path ? 600 : 400,
                      color: location.pathname === item.path ? theme.palette.primary.main : 'inherit',
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ 
        mt: 'auto', 
        p: 2, 
        borderTop: '1px solid', 
        borderColor: 'divider',
        bgcolor: 'background.default'
      }}>
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

        {/* Page Content */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'auto',
          position: 'relative',
        }}>
          {children}
        </Box>
      </Box>

      {/* User Menu */}
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
    </Box>
  );
};

export default AppLayout; 