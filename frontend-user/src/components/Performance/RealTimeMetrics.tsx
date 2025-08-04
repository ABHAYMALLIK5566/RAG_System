import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Grid,
  useTheme,
  alpha,
  Fade,
  Zoom,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  NetworkCheck as NetworkIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import { usePerformanceMonitoring } from '../../services/performanceAgent';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  progress?: number;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon,
  color,
  progress,
  trend,
  subtitle,
}) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return theme.palette.success.main;
      case 'down': return theme.palette.error.main;
      default: return theme.palette.text.secondary;
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '→';
    }
  };

  return (
    <Zoom in timeout={300}>
      <Card
        elevation={isHovered ? 8 : 3}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.1)} 0%, ${alpha(theme.palette[color].main, 0.05)} 100%)`,
          borderLeft: `4px solid ${theme.palette[color].main}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'none',
          cursor: 'pointer',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette[color].main, 0.2),
                color: theme.palette[color].main,
                mr: 2,
              }}
            >
              {icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {trend && (
              <Typography
                variant="h6"
                sx={{ color: getTrendColor(), fontWeight: 600 }}
              >
                {getTrendIcon()}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                color: theme.palette[color].main,
                lineHeight: 1,
              }}
            >
              {typeof value === 'number' ? value.toFixed(1) : value}
            </Typography>
            {unit && (
              <Typography
                variant="body1"
                sx={{ ml: 0.5, color: 'text.secondary', fontWeight: 500 }}
              >
                {unit}
              </Typography>
            )}
          </Box>

          {progress !== undefined && (
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: alpha(theme.palette[color].main, 0.1),
                '& .MuiLinearProgress-bar': {
                  bgcolor: theme.palette[color].main,
                  borderRadius: 4,
                },
              }}
            />
          )}
        </CardContent>
      </Card>
    </Zoom>
  );
};

const RealTimeMetrics: React.FC = () => {
  const { summary } = usePerformanceMonitoring();
  const [previousSummary, setPreviousSummary] = useState(summary);
  const intervalRef = useRef<any>();

  useEffect(() => {
    // Update metrics every second
    intervalRef.current = setInterval(() => {
      setPreviousSummary(summary);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [summary]);

  const getTrend = (current: number, previous: number) => {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'stable';
  };

  const getPerformanceGrade = () => {
    const fps = summary.currentFps;
    const memoryUsage = summary.memoryUsage.percentage;
    const responseTime = summary.averageResponseTime;

    let score = 0;
    
    // FPS scoring (30% weight)
    if (fps >= 55) score += 30;
    else if (fps >= 45) score += 25;
    else if (fps >= 30) score += 20;
    else score += 10;

    // Memory scoring (30% weight)
    if (memoryUsage <= 50) score += 30;
    else if (memoryUsage <= 70) score += 25;
    else if (memoryUsage <= 85) score += 20;
    else score += 10;

    // Response time scoring (40% weight)
    if (responseTime <= 100) score += 40;
    else if (responseTime <= 300) score += 30;
    else if (responseTime <= 500) score += 20;
    else score += 10;

    if (score >= 85) return { grade: 'A+', color: 'success' as const };
    if (score >= 75) return { grade: 'A', color: 'success' as const };
    if (score >= 65) return { grade: 'B', color: 'info' as const };
    if (score >= 55) return { grade: 'C', color: 'warning' as const };
    return { grade: 'D', color: 'error' as const };
  };

  const performanceGrade = getPerformanceGrade();

  return (
    <Fade in timeout={500}>
      <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
          {/* FPS */}
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Frames Per Second"
              subtitle="Rendering performance"
              value={summary.currentFps}
              unit="fps"
              icon={<SpeedIcon />}
              color="success"
              trend={getTrend(summary.currentFps, previousSummary.currentFps)}
            />
          </Grid>

          {/* Memory Usage */}
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Memory Usage"
              subtitle={`${(summary.memoryUsage.used / 1024 / 1024).toFixed(1)}MB used`}
              value={summary.memoryUsage.percentage}
              unit="%"
              icon={<MemoryIcon />}
              color={summary.memoryUsage.percentage > 80 ? 'error' : summary.memoryUsage.percentage > 60 ? 'warning' : 'info'}
              progress={summary.memoryUsage.percentage}
              trend={getTrend(summary.memoryUsage.percentage, previousSummary.memoryUsage.percentage)}
            />
          </Grid>

          {/* Response Time */}
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Avg Response Time"
              subtitle="Network & processing"
              value={summary.averageResponseTime}
              unit="ms"
              icon={<TimelineIcon />}
              color={summary.averageResponseTime > 500 ? 'error' : summary.averageResponseTime > 200 ? 'warning' : 'success'}
              trend={getTrend(summary.averageResponseTime, previousSummary.averageResponseTime)}
            />
          </Grid>

          {/* Total Operations */}
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Total Operations"
              subtitle="Last 60 seconds"
              value={summary.totalOperations}
              icon={<TrendingUpIcon />}
              color="primary"
              trend={getTrend(summary.totalOperations, previousSummary.totalOperations)}
            />
          </Grid>

          {/* Performance Grade */}
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Performance Grade"
              subtitle="Overall system health"
              value={performanceGrade.grade}
              icon={<PsychologyIcon />}
              color={performanceGrade.color}
            />
          </Grid>

          {/* Network Status */}
          <Grid item xs={12} sm={6} md={4}>
            <MetricCard
              title="Network Status"
              subtitle="Connection quality"
              value="Excellent"
              icon={<NetworkIcon />}
              color="success"
              trend="stable"
            />
          </Grid>
        </Grid>

        {/* Category Breakdown */}
        <Card elevation={3} sx={{ mt: 3 }}>
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
                    bgcolor: alpha(getColorForCategory(category), 0.2),
                    color: getColorForCategory(category),
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: alpha(getColorForCategory(category), 0.3),
                      transform: 'scale(1.05)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Fade>
  );
};

// Helper function to get color for category
const getColorForCategory = (category: string): string => {
  const colors: Record<string, string> = {
    ui: '#2196f3',
    network: '#4caf50',
    computation: '#ff9800',
    render: '#9c27b0',
    user_interaction: '#f44336',
  };
  return colors[category] || '#757575';
};

export default RealTimeMetrics; 