import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Description as DocumentsIcon,

  VpnKey as ApiKeysIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Email as NotificationsIcon,
  AccountCircle,
  Logout,
  Visibility,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { usePermissions } from '@/hooks/usePermissions';
import SidebarItem from './SidebarItem';
import NotificationsMenu from './NotificationsMenu';

const drawerWidth = 240;

const Layout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { permissions, userRole, isViewOnly } = usePermissions();

  // Add null check for user to prevent errors during initial render
  const userDisplayName = user?.full_name || user?.username || 'User';
  const userInitial = userDisplayName.charAt(0).toUpperCase();

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

  // Filter menu items based on permissions
  const menuItems = [
    { 
      text: 'Dashboard', 
      icon: <DashboardIcon />, 
      path: '/dashboard', 
      testId: 'nav-dashboard',
      show: permissions.canViewDashboard
    },
    { 
      text: 'Users', 
      icon: <PeopleIcon />, 
      path: '/users', 
      testId: 'nav-users',
      show: permissions.canViewUsers
    },
    { 
      text: 'Documents', 
      icon: <DocumentsIcon />, 
      path: '/documents', 
      testId: 'nav-documents',
      show: permissions.canViewDocuments
    },

    { 
      text: 'API Keys', 
      icon: <ApiKeysIcon />, 
      path: '/api-keys', 
      testId: 'nav-api-keys',
      show: permissions.canViewApiKeys
    },
    { 
      text: 'Security', 
      icon: <SecurityIcon />, 
      path: '/security', 
      testId: 'nav-security',
      show: permissions.canViewSecurityEvents
    },
    { 
      text: 'Analytics', 
      icon: <AnalyticsIcon />, 
      path: '/analytics', 
      testId: 'nav-analytics',
      show: permissions.canViewAnalytics
    },
    { 
      text: 'Settings', 
      icon: <SettingsIcon />, 
      path: '/settings', 
      testId: 'nav-settings',
      show: permissions.canViewSettings
    },
    { 
      text: 'Notifications', 
      icon: <NotificationsIcon />, 
      path: '/notifications', 
      testId: 'nav-notifications',
      show: permissions.system_config
    },
  ].filter(item => item.show);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'error';
      case 'admin': return 'primary';
      case 'developer': return 'secondary';
      case 'analyst': return 'info';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'developer': return 'Developer';
      case 'analyst': return 'Analyst';
      default: return role;
    }
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
            RAG Admin
          </Typography>
          <Chip
            size="small"
            label={getRoleLabel(userRole)}
            color={getRoleColor(userRole) as any}
            icon={isViewOnly ? <Visibility /> : undefined}
            sx={{ mt: 1, alignSelf: 'flex-start' }}
          />
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <SidebarItem
            key={item.text}
            text={item.text}
            icon={item.icon}
            path={item.path}
            testId={item.testId}
            onClick={() => isMobile && setMobileOpen(false)}
          />
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            RAG System Administration
            {isViewOnly && (
              <Chip
                size="small"
                label="View Only"
                color="warning"
                icon={<Visibility />}
                sx={{ ml: 2 }}
              />
            )}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsMenu />
            
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="primary-search-account-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {userInitial}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem>
          <AccountCircle sx={{ mr: 1 }} />
          Profile ({getRoleLabel(userRole)})
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <Logout sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout; 