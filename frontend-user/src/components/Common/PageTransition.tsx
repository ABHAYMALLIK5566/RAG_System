import React, { useState, useEffect } from 'react';
import {
  Box,
  Fade,
  Slide,
  CircularProgress,
  Typography,
  useTheme,
  alpha,
  Backdrop,
} from '@mui/material';
import { Rocket as RocketIcon } from '@mui/icons-material';
import { usePerformanceMonitoring } from '../../services/performanceAgent';

interface PageTransitionProps {
  children: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  transitionDuration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const LoadingOverlay: React.FC<{ message: string; show: boolean }> = ({ message, show }) => {
  const theme = useTheme();
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (show) {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    }
  }, [show]);

  return (
    <Backdrop
      open={show}
      sx={{
        color: '#fff',
        zIndex: theme.zIndex.drawer + 1,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.secondary.main, 0.9)} 100%)`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress
            size={80}
            thickness={2}
            sx={{
              color: 'white',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'spin 3s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          >
            <RocketIcon sx={{ fontSize: 32, color: 'white' }} />
          </Box>
        </Box>
        
        <Typography
          variant="h6"
          sx={{
            color: 'white',
            fontWeight: 600,
            textAlign: 'center',
            minHeight: 32,
          }}
        >
          {message}{dots}
        </Typography>
        
        <Box
          sx={{
            width: 200,
            height: 4,
            bgcolor: alpha(theme.palette.common.white, 0.2),
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              bgcolor: 'white',
              borderRadius: 2,
              animation: 'loading 2s ease-in-out infinite',
              '@keyframes loading': {
                '0%': { transform: 'translateX(-100%)' },
                '50%': { transform: 'translateX(0%)' },
                '100%': { transform: 'translateX(100%)' },
              },
            }}
          />
        </Box>
      </Box>
    </Backdrop>
  );
};

const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  loading = false,
  loadingMessage = 'Loading amazing content',
  transitionDuration = 500,
  direction = 'up',
}) => {
  const { timeUIOperation, endTimer } = usePerformanceMonitoring();
  const [isVisible, setIsVisible] = useState(false);


  useEffect(() => {
    const timer = timeUIOperation('PageTransition', { direction, loading });

    // Delay to show transition effect
    const timeout = setTimeout(() => {
      setIsVisible(true);
      if (timer) {
        endTimer(timer);
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (timer) {
        endTimer(timer);
      }
    };
  }, [timeUIOperation, endTimer, direction, loading]);

  const getSlideDirection = () => {
    switch (direction) {
      case 'up': return 'up';
      case 'down': return 'down';
      case 'left': return 'left';
      case 'right': return 'right';
      default: return 'up';
    }
  };

  return (
    <>
      <LoadingOverlay message={loadingMessage} show={loading} />
      
      <Slide
        direction={getSlideDirection()}
        in={isVisible && !loading}
        timeout={transitionDuration}
        easing="cubic-bezier(0.4, 0, 0.2, 1)"
      >
        <Box>
          <Fade
            in={isVisible && !loading}
            timeout={transitionDuration + 200}
            easing="cubic-bezier(0.4, 0, 0.2, 1)"
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
              }}
            >
              {children}
            </Box>
          </Fade>
        </Box>
      </Slide>
    </>
  );
};

export default PageTransition;

// Hook for programmatic page transitions
export const usePageTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('Loading...');
  const { timeUIOperation, endTimer } = usePerformanceMonitoring();

  const startTransition = (message?: string) => {
    const timer = timeUIOperation('StartPageTransition');
    setTransitionMessage(message || 'Loading...');
    setIsTransitioning(true);
    
    setTimeout(() => {
      endTimer(timer);
    }, 100);
  };

  const endTransition = () => {
    const timer = timeUIOperation('EndPageTransition');
    setIsTransitioning(false);
    
    setTimeout(() => {
      endTimer(timer);
    }, 100);
  };

  return {
    isTransitioning,
    transitionMessage,
    startTransition,
    endTransition,
  };
}; 