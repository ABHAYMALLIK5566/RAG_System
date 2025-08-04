import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';

const NotificationsMenu: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications] = useState([
    { id: 1, title: 'New user registered', message: 'User john@example.com has registered', read: false },
    { id: 2, title: 'Document uploaded', message: 'New document uploaded to system', read: false },
  ]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ mr: 1 }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 320, maxHeight: 400 },
        }}
      >
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <MenuItem key={notification.id} onClick={handleClose}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: notification.read ? 400 : 600 }}>
                  {notification.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {notification.message}
                </Typography>
              </Box>
            </MenuItem>
          ))
        ) : (
          <MenuItem>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default NotificationsMenu; 