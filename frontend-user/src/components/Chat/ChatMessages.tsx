import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Chip,
  Link,
  Collapse,
  IconButton,
} from '@mui/material';
import { 
  Person as UserIcon, 
  SmartToy as BotIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { Message } from '../../store/slices/chatSlice';

interface ChatMessagesProps {
  messages: Message[];
}

const ChatMessages: React.FC<ChatMessagesProps> = React.memo(({ messages }) => {
  const [expandedSources, setExpandedSources] = React.useState<Set<string>>(new Set());

  const toggleSources = React.useCallback((messageId: string) => {
    setExpandedSources(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(messageId)) {
        newExpanded.delete(messageId);
      } else {
        newExpanded.add(messageId);
      }
      return newExpanded;
    });
  }, []);

  const formatTimestamp = React.useCallback((timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, []);

  return (
    <Box 
      sx={{ 
        flex: 1, 
        overflow: 'auto', 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
      data-testid="chat-messages"
    >
      {messages.map((message) => (
        <Box
          key={message.id}
          sx={{
            display: 'flex',
            justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            mb: 2,
            width: '100%',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              maxWidth: '95%',
              width: '100%',
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
              gap: 1.5,
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: message.role === 'user' ? 'primary.main' : 'grey.500',
                fontSize: '0.875rem',
                flexShrink: 0,
              }}
            >
              {message.role === 'user' ? <UserIcon /> : <BotIcon />}
            </Avatar>
            
            <Paper
              sx={{
                p: 2,
                flex: 1,
                minWidth: 0,
                maxWidth: '100%',
                backgroundColor: message.role === 'user' ? 'primary.main' : 'grey.100',
                color: message.role === 'user' ? 'white' : 'text.primary',
                position: 'relative',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {message.role === 'user' ? 'You' : 'RAG Assistant'}
                </Typography>
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ ml: 'auto' }}
                >
                  {formatTimestamp(message.timestamp)}
                </Typography>
              </Box>
              
              <Typography 
                variant="body2" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  width: '100%',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  hyphens: 'auto',
                  minWidth: 0,
                }}
              >
                {message.content}
              </Typography>

              {/* Sources and Metadata */}
              {message.role === 'assistant' && message.metadata && (
                <Box sx={{ mt: 2 }}>
                  {message.metadata.confidence && (
                    <Chip
                      label={`Confidence: ${(message.metadata.confidence * 100).toFixed(1)}%`}
                      size="small"
                      color={message.metadata.confidence > 0.8 ? 'success' : 'warning'}
                      sx={{ mr: 1, mb: 1 }}
                    />
                  )}
                  
                  {message.metadata.processing_time && (
                    <Chip
                      label={`${message.metadata.processing_time.toFixed(2)}s`}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  )}

                  {message.metadata.sources && message.metadata.sources.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Sources ({message.metadata.sources.length})
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => toggleSources(message.id)}
                          sx={{ ml: 1 }}
                        >
                          {expandedSources.has(message.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Box>
                      
                      <Collapse in={expandedSources.has(message.id)}>
                        <Box sx={{ mt: 1 }}>
                          {message.metadata.sources.map((source, index) => (
                            <Paper
                              key={index}
                              variant="outlined"
                              sx={{ p: 1, mb: 1, backgroundColor: 'background.paper' }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                                {source.title}
                              </Typography>
                              {source.url && (
                                <Link
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  variant="caption"
                                  sx={{ display: 'block', mb: 1 }}
                                >
                                  View Source
                                </Link>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {source.snippet}
                              </Typography>
                            </Paper>
                          ))}
                        </Box>
                      </Collapse>
                    </Box>
                  )}
                </Box>
              )}
            </Paper>
          </Box>
        </Box>
      ))}
    </Box>
  );
});

export default ChatMessages; 