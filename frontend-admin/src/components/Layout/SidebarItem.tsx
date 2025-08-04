import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';

interface SidebarItemProps {
  text: string;
  icon: React.ReactNode;
  path: string;
  onClick?: () => void;
  testId?: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ text, icon, path, onClick, testId }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === path;

  const handleClick = () => {
    navigate(path);
    onClick?.();
  };

  return (
    <Tooltip title={text} placement="right">
      <ListItem disablePadding>
        <ListItemButton
          onClick={handleClick}
          selected={isActive}
          data-testid={testId}
          sx={{
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            },
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <ListItemIcon
            sx={{
              color: isActive ? 'primary.contrastText' : 'inherit',
            }}
          >
            {icon}
          </ListItemIcon>
          <ListItemText 
            primary={text}
            sx={{
              '& .MuiListItemText-primary': {
                fontWeight: isActive ? 600 : 400,
              },
            }}
          />
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
};

export default SidebarItem; 