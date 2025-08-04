import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDashboardStats } from '@/store/slices/analyticsSlice';

const Analytics: React.FC = () => {
  const dispatch = useAppDispatch();
  const { dashboardStats: stats, isLoading } = useAppSelector((state) => state.analytics);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const performanceMetrics = stats?.performance_metrics || {};
  const avgResponseTime = performanceMetrics.avg_response_time || 0;
  const successRate = performanceMetrics.success_rate || 0;
  const totalQueriesToday = performanceMetrics.total_queries_today || 0;
  const uniqueUsersToday = performanceMetrics.unique_users_today || 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Advanced Analytics
      </Typography>

      <Paper sx={{ p: 3 }} data-testid="analytics-chart">
        <Typography variant="h6" gutterBottom>
          Analytics Overview
        </Typography>
        <Grid container spacing={3} data-testid="analytics-data">
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {totalQueriesToday.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Queries Today
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {(avgResponseTime / 1000).toFixed(1)}s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average Response Time
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {successRate.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Success Rate
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {uniqueUsersToday}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Users Today
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Typography variant="body1" color="text.secondary">
            Real-time analytics data from the RAG system. Metrics are updated automatically as queries are processed.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default Analytics; 