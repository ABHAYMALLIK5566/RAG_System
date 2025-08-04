import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  CircularProgress,
  Chip,
  Avatar,
  Tooltip,
  Card,
  CardContent,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Drawer,
  AppBar,
  Toolbar,
  useTheme,
  alpha,
  Snackbar,
  Alert,
  Fade,
  Slide,
} from '@mui/material';
import {
  Send as SendIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Bookmark as BookmarkIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  AutoAwesome as AutoAwesomeIcon,
  Psychology as PsychologyIcon,
  Rocket as RocketIcon,
  ChatBubble as ChatBubbleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store';
import { 
  createSession, 
  setCurrentSession, 
  deleteSession, 
  sendMessage,
  getSessions 
} from '../../store/slices/chatSlice';
import { usePerformanceMonitoring } from '../../services/performanceAgent';

// Enhanced CSS animations
const fadeInUp = {
  '@keyframes fadeInUp': {
    '0%': {
      opacity: 0,
      transform: 'translateY(30px)',
    },
    '100%': {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
};

const slideInLeft = {
  '@keyframes slideInLeft': {
    '0%': {
      opacity: 0,
      transform: 'translateX(-100px)',
    },
    '100%': {
      opacity: 1,
      transform: 'translateX(0)',
    },
  },
};

const slideInRight = {
  '@keyframes slideInRight': {
    '0%': {
      opacity: 0,
      transform: 'translateX(100px)',
    },
    '100%': {
      opacity: 1,
      transform: 'translateX(0)',
    },
  },
};

const bounce = {
  '@keyframes bounce': {
    '0%, 20%, 53%, 80%, 100%': {
      transform: 'translate3d(0,0,0)',
    },
    '40%, 43%': {
      transform: 'translate3d(0, -30px, 0)',
    },
    '70%': {
      transform: 'translate3d(0, -15px, 0)',
    },
    '90%': {
      transform: 'translate3d(0, -4px, 0)',
    },
  },
};

// Performance-optimized message component
const MessageComponent = React.memo(({ message, index, isLatest }: any) => {
  const theme = useTheme();
  const { timeRender, endTimer } = usePerformanceMonitoring();
  
  const renderTimer = useMemo(() => timeRender('MessageComponent', { 
    messageId: message.id, 
    index, 
    isLatest 
  }), [message.id, index, isLatest]);

  useEffect(() => {
    endTimer(renderTimer);
  }, [renderTimer, endTimer]);

  const isUser = message.role === 'user';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 3,
        px: 2,
        width: '100%',
        animation: isUser ? 'slideInRight 0.5s ease-out' : 'slideInLeft 0.5s ease-out',
        ...slideInLeft,
        ...slideInRight,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          maxWidth: '95%',
          width: '100%',
          flexDirection: isUser ? 'row-reverse' : 'row',
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: isUser ? 'primary.main' : 'secondary.main',
            fontSize: '1rem',
            flexShrink: 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'scale(1.1) rotate(5deg)',
              boxShadow: theme.shadows[8],
            },
          }}
        >
          {isUser ? 'U' : <AutoAwesomeIcon />}
        </Avatar>
        
        <Card
          elevation={4}
          sx={{
            bgcolor: isUser 
              ? 'primary.main' 
              : alpha(theme.palette.background.paper, 0.95),
            color: isUser ? 'primary.contrastText' : 'text.primary',
            borderRadius: 4,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            position: 'relative',
            overflow: 'visible',
            flex: 1,
            minWidth: 0,
            maxWidth: '100%',
            '&:hover': {
              transform: 'translateY(-4px) scale(1.02)',
              boxShadow: theme.shadows[12],
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 'inherit',
              background: isUser 
                ? 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)'
                : 'linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 100%)',
              pointerEvents: 'none',
            },
          }}
        >
          <CardContent sx={{ 
            p: 3, 
            '&:last-child': { pb: 3 }, 
            width: '100%',
            minWidth: 0,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}>
            <Typography
              variant="body1"
              sx={{
                lineHeight: 1.7,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                fontSize: '1.1rem',
                fontWeight: 400,
                width: '100%',
                overflowWrap: 'break-word',
                hyphens: 'auto',
                minWidth: 0,
              }}
            >
              {message.content}
            </Typography>
            
            {message.metadata && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {message.metadata.processing_time && (
                  <Chip
                    size="small"
                    icon={<SpeedIcon />}
                    label={`${message.metadata.processing_time}ms`}
                    variant="outlined"
                    sx={{ 
                      fontSize: '0.75rem',
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      color: 'success.main',
                      borderColor: 'success.main',
                    }}
                  />
                )}
                {message.metadata.confidence && (
                  <Chip
                    size="small"
                    icon={<PsychologyIcon />}
                    label={`${Math.round(message.metadata.confidence * 100)}%`}
                    variant="outlined"
                    sx={{ 
                      fontSize: '0.75rem',
                      bgcolor: alpha(theme.palette.info.main, 0.1),
                      color: 'info.main',
                      borderColor: 'info.main',
                    }}
                  />
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
});

// Real-time performance dashboard
const PerformanceMetrics = React.memo(({ open, onClose }: any) => {
  const { summary, exportMetrics, clearMetrics } = usePerformanceMonitoring();
  const theme = useTheme();

  useEffect(() => {
    if (open) {
      const interval = setInterval(() => {
        // Trigger re-render for real-time updates
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          backdropFilter: 'blur(30px)',
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          minHeight: '70vh',
        },
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.1),
        color: 'primary.main',
      }}>
        <TrendingUpIcon sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={600}>
          Performance Dashboard
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Tooltip title="Export Metrics">
            <IconButton 
              onClick={() => {
                const data = exportMetrics();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `performance-metrics-${Date.now()}.json`;
                a.click();
              }}
              sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear Metrics">
            <IconButton 
              onClick={clearMetrics}
              sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Real-time metrics grid */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: 3 
          }}>
            <Card elevation={3} sx={{ 
              bgcolor: alpha(theme.palette.success.main, 0.1),
              borderLeft: `4px solid ${theme.palette.success.main}`,
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <SpeedIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Typography variant="h3" color="success.main" fontWeight={700}>
                  {summary.currentFps}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Frames Per Second
                </Typography>
              </CardContent>
            </Card>

            <Card elevation={3} sx={{ 
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              borderLeft: `4px solid ${theme.palette.warning.main}`,
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <MemoryIcon sx={{ fontSize: 48, color: 'warning.main', mb: 1 }} />
                <Typography variant="h3" color="warning.main" fontWeight={700}>
                  {summary.memoryUsage.percentage.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Memory Usage
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={summary.memoryUsage.percentage}
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
              </CardContent>
            </Card>

            <Card elevation={3} sx={{ 
              bgcolor: alpha(theme.palette.info.main, 0.1),
              borderLeft: `4px solid ${theme.palette.info.main}`,
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <TimelineIcon sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
                <Typography variant="h3" color="info.main" fontWeight={700}>
                  {summary.averageResponseTime.toFixed(0)}ms
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Response Time
                </Typography>
              </CardContent>
            </Card>

            <Card elevation={3} sx={{ 
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              borderLeft: `4px solid ${theme.palette.primary.main}`,
            }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <ChatBubbleIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="h3" color="primary.main" fontWeight={700}>
                  {summary.totalOperations}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Operations
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Category breakdown */}
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Operation Categories
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {Object.entries(summary.categoryBreakdown).map(([category, count]) => (
                  <Chip
                    key={category}
                    label={`${category}: ${count}`}
                    variant="filled"
                    size="medium"
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                      color: 'primary.main',
                      fontWeight: 600,
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Slowest operations */}
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Performance Insights
              </Typography>
              <List>
                {summary.slowestOperations.map((op, index) => (
                  <ListItem key={index} sx={{ 
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    borderRadius: 2,
                    mb: 1,
                    bgcolor: alpha(theme.palette.background.paper, 0.5),
                  }}>
                    <ListItemIcon>
                      <Chip 
                        label={`#${index + 1}`} 
                        size="small" 
                        color="primary"
                        sx={{ minWidth: 40 }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={op.operation}
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          <Chip
                            size="small"
                            label={`${op.duration.toFixed(2)}ms`}
                            color="error"
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={op.category}
                            color="default"
                            variant="outlined"
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
        <Button onClick={onClose} variant="contained" size="large">
          Close Dashboard
        </Button>
      </DialogActions>
    </Dialog>
  );
});

// Main modern chat interface
const ModernChatInterface: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { sessions, currentSession, isSendingMessage, error } = useAppSelector(state => state.chat);
  const { timeUIOperation, timeUserInteraction, timeNetworkRequest, endTimer } = usePerformanceMonitoring();
  
  // State management
  const [inputValue, setInputValue] = useState('');
  const [showMetrics, setShowMetrics] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  // Refs for performance optimization
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Memoized messages for performance
  const messages = useMemo(() => currentSession?.messages || [], [currentSession?.messages]);

  // Smooth auto-scroll with performance tracking
  const scrollToBottom = useCallback(() => {
    const timer = timeUIOperation('ScrollToBottom');
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
    setTimeout(() => endTimer(timer), 150);
  }, [timeUIOperation, endTimer]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load sessions with performance tracking
  useEffect(() => {
    const timer = timeNetworkRequest('/chat/sessions', 'GET');
    dispatch(getSessions()).finally(() => endTimer(timer));
  }, [dispatch, timeNetworkRequest, endTimer]);

  // Enhanced message submission with performance tracking
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSendingMessage || !currentSession) return;

    const interactionTimer = timeUserInteraction('SendMessage', { 
      messageLength: inputValue.length,
      sessionId: currentSession.id 
    });

    try {
      await dispatch(sendMessage({
        sessionId: currentSession.id,
        message: inputValue.trim()
      })).unwrap();
      
      setInputValue('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      endTimer(interactionTimer);
    }
  }, [inputValue, isSendingMessage, currentSession, dispatch, timeUserInteraction, endTimer]);

  // Session management with performance tracking
  const handleCreateSession = useCallback(async () => {
    const timer = timeUserInteraction('CreateSession');
    try {
      await dispatch(createSession(`Chat ${sessions.length + 1}`)).unwrap();
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      endTimer(timer);
    }
  }, [dispatch, sessions.length, timeUserInteraction, endTimer]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const timer = timeUserInteraction('DeleteSession', { sessionId });
    try {
      console.log('Deleting session:', sessionId);
      await dispatch(deleteSession(sessionId)).unwrap();
      console.log('Session deleted successfully:', sessionId);
      
      // Refresh sessions list to ensure UI is updated
      await dispatch(getSessions());
      
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
      // Show error message to user
      alert('Failed to delete session. Please try again.');
    } finally {
      endTimer(timer);
    }
  }, [dispatch, timeUserInteraction, endTimer]);

  const handleSessionSwitch = useCallback((session: any) => {
    const timer = timeUserInteraction('SwitchSession', { sessionId: session.id });
    dispatch(setCurrentSession(session));
    setShowSessionDrawer(false);
    endTimer(timer);
  }, [dispatch, timeUserInteraction, endTimer]);

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            handleCreateSession();
            break;
          case 'm':
            e.preventDefault();
            setShowMetrics(!showMetrics);
            break;
          case 'f':
            e.preventDefault();
            setIsFullscreen(!isFullscreen);
            break;
          case 'b':
            e.preventDefault();
            setShowSessionDrawer(!showSessionDrawer);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCreateSession, showMetrics, isFullscreen, showSessionDrawer]);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
        ...fadeInUp,
      }}
    >
      {/* Enhanced Header */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(30px)',
          color: 'text.primary',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
        }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          <IconButton
            onClick={() => setShowSessionDrawer(true)}
            sx={{ 
              mr: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
                transform: 'scale(1.05)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            <BookmarkIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <RocketIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {currentSession?.title || 'Ultra-Fast AI'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {messages.length} messages • {sessions.length} sessions
              </Typography>
            </Box>
          </Box>

          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Tooltip title="Performance Dashboard (Ctrl+M)">
              <IconButton 
                onClick={() => setShowMetrics(true)}
                sx={{ 
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.2) },
                }}
              >
                <SpeedIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="New Session (Ctrl+N)">
              <IconButton 
                onClick={handleCreateSession}
                sx={{ 
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.2) },
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Toggle Fullscreen (Ctrl+F)">
              <IconButton 
                onClick={() => setIsFullscreen(!isFullscreen)}
                sx={{ 
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.2) },
                }}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
            
            {currentSession && (
              <Tooltip title="Delete Current Session">
                <IconButton 
                  onClick={() => {
                    setSessionToDelete(currentSession.id);
                    setDeleteDialogOpen(true);
                  }}
                  sx={{ 
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    '&:hover': { 
                      bgcolor: alpha(theme.palette.error.main, 0.2),
                      transform: 'scale(1.05)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Enhanced Messages Area */}
      <Box
        ref={messagesContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          '&::-webkit-scrollbar': {
            width: 12,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: alpha(theme.palette.divider, 0.1),
            borderRadius: 6,
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.primary.main, 0.3),
            borderRadius: 6,
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.5),
            },
          },
        }}
      >
        {messages.length === 0 ? (
          <Fade in timeout={1000}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                p: 4,
                textAlign: 'center',
                animation: 'fadeInUp 1s ease-out',
                ...fadeInUp,
              }}
            >
              <Box
                sx={{
                  animation: 'bounce 2s infinite',
                  ...bounce,
                }}
              >
                <RocketIcon sx={{ fontSize: 120, color: 'primary.main', mb: 3 }} />
              </Box>
              <Typography variant="h3" gutterBottom fontWeight={700} color="primary.main">
                Welcome to Ultra-Fast AI
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mb: 4 }}>
                Experience lightning-fast AI conversations with real-time performance monitoring.
                Every interaction is tracked and optimized for maximum speed.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip
                  icon={<SpeedIcon />}
                  label="Sub-second responses"
                  color="success"
                  variant="outlined"
                  size="medium"
                />
                <Chip
                  icon={<PsychologyIcon />}
                  label="Smart analysis"
                  color="info"
                  variant="outlined"
                  size="medium"
                />
                <Chip
                  icon={<MemoryIcon />}
                  label="Memory optimized"
                  color="warning"
                  variant="outlined"
                  size="medium"
                />
              </Box>
            </Box>
          </Fade>
        ) : (
          messages.map((message, index) => (
            <MessageComponent
              key={message.id}
              message={message}
              index={index}
              isLatest={index === messages.length - 1}
            />
          ))
        )}
        
        {/* Enhanced typing indicator */}
        {isSendingMessage && (
          <Slide direction="up" in={isSendingMessage} timeout={300}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 3, px: 2 }}>
              <Card
                elevation={6}
                sx={{
                  bgcolor: alpha(theme.palette.background.paper, 0.95),
                  borderRadius: 4,
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                }}
              >
                <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={20} thickness={4} />
                  <Typography variant="body1" color="text.secondary" fontWeight={500}>
                    AI is crafting your response...
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Slide>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Enhanced Input Area */}
      <Paper
        elevation={12}
        sx={{
          p: 3,
          bgcolor: alpha(theme.palette.background.paper, 0.98),
          backdropFilter: 'blur(30px)',
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          boxShadow: `0 -8px 32px ${alpha(theme.palette.common.black, 0.1)}`,
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <TextField
            ref={inputRef}
            fullWidth
            multiline
            maxRows={6}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message here... (Press Enter to send)"
            variant="outlined"
            disabled={isSendingMessage}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 4,
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(20px)',
                fontSize: '1.1rem',
                minHeight: 56,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  bgcolor: alpha(theme.palette.background.paper, 0.95),
                  transform: 'translateY(-2px)',
                },
                '&.Mui-focused': {
                  bgcolor: alpha(theme.palette.background.paper, 1),
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[12],
                },
              },
            }}
          />
          
          <IconButton
            type="submit"
            disabled={!inputValue.trim() || isSendingMessage}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              width: 56,
              height: 56,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                bgcolor: 'primary.dark',
                transform: 'scale(1.1) rotate(5deg)',
                boxShadow: theme.shadows[8],
              },
              '&:disabled': {
                bgcolor: 'action.disabledBackground',
                transform: 'none',
              },
            }}
          >
            {isSendingMessage ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              <SendIcon sx={{ fontSize: 24 }} />
            )}
          </IconButton>
        </Box>
        
        {/* Keyboard shortcuts hint */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label="Ctrl+N: New Session" variant="outlined" />
          <Chip size="small" label="Ctrl+M: Metrics" variant="outlined" />
          <Chip size="small" label="Ctrl+B: Sessions" variant="outlined" />
          <Chip size="small" label="Ctrl+F: Fullscreen" variant="outlined" />
        </Box>
      </Paper>

      {/* Enhanced Session Drawer */}
      <Drawer
        anchor="left"
        open={showSessionDrawer}
        onClose={() => setShowSessionDrawer(false)}
        PaperProps={{
          sx: {
            width: 380,
            bgcolor: alpha(theme.palette.background.paper, 0.98),
            backdropFilter: 'blur(30px)',
            borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom fontWeight={600} color="primary.main">
            Chat Sessions
          </Typography>
          
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateSession}
            sx={{ 
              mb: 3,
              height: 48,
              borderRadius: 3,
              fontWeight: 600,
              fontSize: '1.1rem',
            }}
          >
            Create New Session
          </Button>
          
          <List sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
            {sessions.map((session: any) => (
              <ListItem
                key={session.id}
                button
                selected={currentSession?.id === session.id}
                onClick={() => handleSessionSwitch(session)}
                sx={{
                  borderRadius: 3,
                  mb: 1,
                  p: 2,
                  transition: 'all 0.3s ease',
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                    },
                  },
                  '&:hover': {
                    bgcolor: alpha(theme.palette.action.hover, 0.1),
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="subtitle1" fontWeight={600}>
                      {session.title}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      {session.messages?.length || 0} messages • {new Date(session.updated_at).toLocaleDateString()}
                    </Typography>
                  }
                />
                <IconButton
                  size="medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSessionToDelete(session.id);
                    setDeleteDialogOpen(true);
                  }}
                  sx={{
                    bgcolor: alpha(theme.palette.error.main, 0.15),
                    color: 'error.main',
                    width: 36,
                    height: 36,
                    ml: 1,
                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.error.main, 0.25),
                      transform: 'scale(1.1)',
                      boxShadow: theme.shadows[4],
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <DeleteIcon fontSize="medium" />
                </IconButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Performance Metrics Dashboard */}
      <PerformanceMetrics
        open={showMetrics}
        onClose={() => setShowMetrics(false)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 4,
            bgcolor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(20px)',
          },
        }}
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>
            Delete Session
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this chat session? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button 
            onClick={() => sessionToDelete && handleDeleteSession(sessionToDelete)} 
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity="error" 
          variant="filled"
          sx={{ 
            borderRadius: 3,
            fontWeight: 600,
          }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ModernChatInterface; 