import React, { useEffect, useRef } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useAppSelector, useAppDispatch } from '../../store';
import { getSessionMessages, createSession } from '../../store/slices/chatSlice';
import ChatMessages from './ChatMessages';

const ChatTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentSession, isSendingMessage, error } = useAppSelector((state) => state.chat);
  const { user } = useAppSelector((state) => state.auth);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  useEffect(() => {
    if (currentSession?.id) {
      dispatch(getSessionMessages(currentSession.id));
    }
  }, [dispatch, currentSession?.id]);

  // Auto-create session if user is authenticated but no current session
  useEffect(() => {
    if (user && !currentSession) {
      console.log('ChatTab - Auto-creating session for authenticated user');
      dispatch(createSession('New Chat'));
    }
  }, [dispatch, user, currentSession]);

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!currentSession) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          Welcome to RAG Chat
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Start a new conversation to begin querying your documents
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden', // Prevent overflow
      minHeight: 0, // Allow shrinking
      pb: 4, // More bottom padding to ensure space for input
      mb: 2, // Additional margin bottom
    }}>
      <ChatMessages messages={currentSession.messages || []} />
      
      {/* Subtle loading indicator when sending message */}
      {isSendingMessage && (
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'flex-start', 
            mb: 2,
            px: 2,
            opacity: 0.7
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              borderRadius: 1,
              backgroundColor: 'grey.100',
            }}
          >
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Processing...
            </Typography>
          </Box>
        </Box>
      )}
      
      <div ref={messagesEndRef} />
    </Box>
  );
};

export default ChatTab; 