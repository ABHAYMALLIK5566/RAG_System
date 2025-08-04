import React, { useEffect, useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  IconButton,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Snackbar,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store';
import { getSessions, setCurrentSession, createSession, deleteSession, shareSession } from '../../store/slices/chatSlice';

const ConversationList: React.FC = () => {
  console.log('ConversationList component rendered');
  const dispatch = useAppDispatch();
  const { sessions, currentSession, isLoading, error } = useAppSelector((state) => state.chat);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareSnackbarOpen, setShareSnackbarOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<any>(null);

  // Defensive: ensure sessions is always an array
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  console.log('ConversationList - sessions:', sessions);
  console.log('ConversationList - safeSessions:', safeSessions);

  useEffect(() => {
    dispatch(getSessions());
  }, [dispatch]);

  const handleCreateSession = async () => {
    try {
      const title = `New Chat ${safeSessions.length + 1}`;
      await dispatch(createSession(title)).unwrap();
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSessionSelect = (session: any) => {
    dispatch(setCurrentSession(session));
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, session: any) => {
    console.log('Menu clicked for session:', session.id);
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedSession(session);
    console.log('selectedSession set to:', session);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedSession(null);
  };

  const handleDeleteClick = () => {
    console.log('Delete menu item clicked for session:', selectedSession?.id);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    console.log('handleDeleteConfirm called with sessionToDelete:', sessionToDelete);
    if (sessionToDelete) {
      try {
        console.log('Attempting to delete session:', sessionToDelete.id);
        const result = await dispatch(deleteSession(sessionToDelete.id)).unwrap();
        console.log('Delete session result:', result);
        setDeleteDialogOpen(false);
        setSessionToDelete(null);
        console.log('Delete completed successfully');
      } catch (error) {
        console.error('Failed to delete session:', error);
        alert(`Failed to delete session: ${error}`);
      }
    } else {
      console.error('No session available for deletion');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  const handleShareClick = async () => {
    if (selectedSession) {
      try {
        const shareResponse = await dispatch(shareSession(selectedSession.id)).unwrap();
        const shareableUrl = shareResponse.share_url || `${window.location.origin}/chat/shared/${selectedSession.id}`;
        // Copy to clipboard
        navigator.clipboard.writeText(shareableUrl).then(() => {
          setShareSnackbarOpen(true);
        }).catch((err) => {
          console.error('Failed to copy to clipboard:', err);
        });
      } catch (error) {
        console.error('Failed to share session:', error);
        // Fallback to local URL generation
        const shareableUrl = `${window.location.origin}/chat/shared/${selectedSession.id}`;
        navigator.clipboard.writeText(shareableUrl).then(() => {
          setShareSnackbarOpen(true);
        }).catch((err) => {
          console.error('Failed to copy to clipboard:', err);
        });
      }
    }
    handleMenuClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Sessions List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {safeSessions.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No conversations yet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Start a new conversation to begin
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {safeSessions.map((session, index) => (
              <React.Fragment key={session.id}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    selected={currentSession?.id === session.id}
                    onClick={() => handleSessionSelect(session)}
                    sx={{
                      borderRadius: 1,
                      mx: 0.5,
                      '&.Mui-selected': {
                        backgroundColor: 'primary.light',
                        '&:hover': {
                          backgroundColor: 'primary.light',
                        },
                      },
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                    data-testid={`session-${session.id}`}
                  >
                    <ListItemIcon>
                      <ChatIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: currentSession?.id === session.id ? 600 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {session.title}
                          </Typography>
                          {session.is_active && (
                            <Chip
                              label="Active"
                              size="small"
                              color="primary"
                              sx={{ height: 16, fontSize: '0.625rem' }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {(session.messages ? session.messages.length : 0)} messages
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(session.updated_at)}
                          </Typography>
                        </Box>
                      }
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Menu button clicked for session:', session.id);
                        handleMenuClick(e, session);
                      }}
                      data-testid={`session-menu-${session.id}`}
                      data-session-id={session.id}
                      onMouseEnter={() => console.log('Menu button hovered for session:', session.id)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </ListItemButton>
                </ListItem>
                {index < safeSessions.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 3,
          sx: {
            minWidth: 160,
          },
        }}
      >
        <MenuItem onClick={handleShareClick} data-testid="share-session-btn">
          <ShareIcon sx={{ mr: 1 }} fontSize="small" />
          Share
        </MenuItem>
        <MenuItem 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Delete menu item clicked for session:', selectedSession?.id);
            setSessionToDelete(selectedSession);
            setDeleteDialogOpen(true);
            handleMenuClose();
          }} 
          sx={{ color: 'error.main' }} 
          data-testid="delete-session-btn"
          onMouseEnter={() => console.log('Delete menu item hovered')}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Conversation</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedSession?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Delete confirmation button clicked directly');
              handleDeleteConfirm();
            }} 
            color="error" 
            variant="contained"
            onMouseEnter={() => console.log('Delete confirmation button hovered')}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Success Snackbar */}
      <Snackbar
        open={shareSnackbarOpen}
        autoHideDuration={3000}
        onClose={() => setShareSnackbarOpen(false)}
        message="Share link copied to clipboard!"
      />
    </Box>
  );
};

export default ConversationList; 