import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Alert,
  Typography,
  Tooltip,
  Chip,
  Fade,
  Zoom,
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Mic as MicIcon,
  EmojiEmotions as EmojiIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { sendMessage, addMessage } from '../../store/slices/chatSlice';

const ChatInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();
  
  const dispatch = useAppDispatch();
  const { currentSession, isSendingMessage, error } = useAppSelector((state) => state.chat);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Focus textarea when session changes
  useEffect(() => {
    if (currentSession && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [currentSession]);

  const handleSend = async () => {
    if (message.trim() && currentSession?.id && !isSendingMessage) {
      const trimmedMessage = message.trim();
      const userMessage = {
        id: `user-${Date.now()}`,
        content: trimmedMessage,
        role: 'user' as const,
        timestamp: new Date().toISOString(),
      };

      // Add user message immediately for instant feedback
      dispatch(addMessage({ sessionId: currentSession.id, message: userMessage }));
      
      // Clear input immediately for better UX
      setMessage('');
      setIsTyping(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      try {
        // Send message to backend with optimized settings
        const response = await dispatch(sendMessage({
          sessionId: currentSession.id,
          message: trimmedMessage,
          stream: false,
        })).unwrap();
        
        // Add AI response to chat
        if (response && response.response) {
          const aiMessage = {
            id: response.response.id || `assistant-${Date.now()}`,
            content: response.response.content,
            role: 'assistant' as const,
            timestamp: new Date(response.response.timestamp * 1000).toISOString(),
            metadata: response.response.metadata,
          };
          dispatch(addMessage({ sessionId: currentSession.id, message: aiMessage }));
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        // Add error message to chat
        const errorMessage = {
          id: `error-${Date.now()}`,
          content: 'Sorry, I encountered an error. Please try again.',
          role: 'assistant' as const,
          timestamp: new Date().toISOString(),
        };
        dispatch(addMessage({ sessionId: currentSession.id, message: errorMessage }));
      }
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    setIsTyping(e.target.value.length > 0);
  };

  const handleClear = () => {
    setMessage('');
    setIsTyping(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Handle file upload logic here
      console.log('File selected:', file.name);
    }
  };

  const handleVoiceInput = () => {
    // Implement voice input functionality
    console.log('Voice input not implemented yet');
  };

  const isDisabled = !message.trim() || isSendingMessage || !currentSession;
  const hasContent = message.trim().length > 0;

  return (
    <Box sx={{ 
      p: 2, 
      borderTop: '2px solid',
      borderColor: 'primary.main',
      backgroundColor: 'background.paper',
      flexShrink: 0, // Prevent the input from shrinking
      zIndex: 9999, // Extremely high z-index to ensure it stays on top
      position: 'sticky', // Make it stick to the bottom
      bottom: 0, // Position at the bottom
      left: 0,
      right: 0,
      minHeight: '160px', // Ensure minimum height for the input area
      boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', // Stronger shadow for better visibility
    }}>
      <Paper 
        elevation={2}
        sx={{ 
          p: 2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: isSendingMessage ? 'primary.main' : 'divider',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          },
        }}
      >
        {error && (
          <Fade in={!!error}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          </Fade>
        )}
        
        {/* Typing indicator when sending */}
        {isSendingMessage && (
          <Fade in={isSendingMessage}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Processing your message...
              </Typography>
              <Chip 
                label="AI Thinking" 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            </Box>
          </Fade>
        )}
        
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          {/* File Upload Button */}
          <Tooltip title="Attach file">
            <IconButton
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={!currentSession}
              sx={{ 
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <AttachFileIcon />
            </IconButton>
          </Tooltip>

          {/* Voice Input Button */}
          <Tooltip title="Voice input">
            <IconButton
              size="small"
              onClick={handleVoiceInput}
              disabled={!currentSession}
              sx={{ 
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <MicIcon />
            </IconButton>
          </Tooltip>

          {/* Text Input */}
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={
              !currentSession 
                ? "Start a new conversation to begin chatting..." 
                : isSendingMessage 
                ? "Processing..." 
                : "Type your message..."
            }
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            variant="outlined"
            size="small"
            disabled={!currentSession || isSendingMessage}
            data-testid="chat-input"
            inputRef={textareaRef}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: isSendingMessage ? 'none' : 'translateY(-1px)',
                  boxShadow: isSendingMessage ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                },
                '&.Mui-focused': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                },
              },
            }}
          />

          {/* Clear Button */}
          {hasContent && (
            <Zoom in={hasContent}>
              <Tooltip title="Clear message">
                <IconButton
                  size="small"
                  onClick={handleClear}
                  disabled={isSendingMessage}
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { color: 'error.main' }
                  }}
                >
                  <ClearIcon />
                </IconButton>
              </Tooltip>
            </Zoom>
          )}

          {/* Emoji Button */}
          <Tooltip title="Add emoji">
            <IconButton
              size="small"
              onClick={() => setShowEmoji(!showEmoji)}
              disabled={!currentSession}
              sx={{ 
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <EmojiIcon />
            </IconButton>
          </Tooltip>

          {/* Send Button */}
          <Zoom in={hasContent || isSendingMessage}>
            <Tooltip title="Send message">
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={isDisabled}
                data-testid="send-button"
                sx={{
                  transition: 'all 0.2s ease-in-out',
                  backgroundColor: hasContent ? 'primary.main' : 'transparent',
                  color: hasContent ? 'white' : 'text.secondary',
                  '&:hover': {
                    transform: isSendingMessage ? 'none' : 'scale(1.05)',
                    backgroundColor: hasContent ? 'primary.dark' : 'primary.light',
                  },
                  '&:disabled': {
                    backgroundColor: 'transparent',
                    color: 'text.disabled',
                  },
                }}
              >
                {isSendingMessage ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <SendIcon />
                )}
              </IconButton>
            </Tooltip>
          </Zoom>
        </Box>

        {/* Character count and typing indicator */}
        {hasContent && (
          <Fade in={hasContent}>
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {message.length} characters
              </Typography>
              {isTyping && (
                <Chip 
                  label="Typing..." 
                  size="small" 
                  color="secondary" 
                  variant="outlined"
                />
              )}
            </Box>
          </Fade>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          accept=".pdf,.doc,.docx,.txt,.md"
        />
      </Paper>
    </Box>
  );
};

export default ChatInput; 