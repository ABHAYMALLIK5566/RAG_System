import React, { useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  People as PeopleIcon,
  Description as DocumentsIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDashboardStats } from '@/store/slices/analyticsSlice';
import { ActivityItem } from '@/types';

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { dashboardStats: stats, isLoading: loading } = useAppSelector((state) => state.analytics);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_login':
        return <PeopleIcon />;
      case 'document_upload':
        return <DocumentsIcon />;
      case 'query_executed':
        return <SearchIcon />;
      case 'security_event':
        return <WarningIcon />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  // Real data from API
  const queryData = stats?.query_trends?.map((trend: any) => ({
    name: new Date(trend.date).toLocaleDateString('en-US', { weekday: 'short' }),
    queries: trend.query_count || 0,
    avgResponseTime: trend.avg_response_time || 0
  })) || [];

  const userData = stats?.query_trends?.map((trend: any) => ({
    name: new Date(trend.date).toLocaleDateString('en-US', { month: 'short' }),
    users: trend.successful_queries || 0
  })) || [];

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }} data-testid="dashboard-stats">
        <Grid item xs={12} sm={6} md={3}>
          <Card data-testid="stats-card">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <PeopleIcon />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Users
                  </Typography>
                  <Typography variant="h4">
                    {stats?.total_users || 0}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon color="success" sx={{ mr: 1, fontSize: 16 }} />
                {stats?.users_growth_percent && (
                  <Typography variant="body2" color="success.main">
                    +{stats.users_growth_percent}% from last month
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card data-testid="stats-card">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                  <DocumentsIcon />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Documents
                  </Typography>
                  <Typography variant="h4">
                    {stats?.total_documents || 0}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon color="success" sx={{ mr: 1, fontSize: 16 }} />
                {stats?.documents_growth_percent && (
                  <Typography variant="body2" color="success.main">
                    +{stats.documents_growth_percent}% from last month
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card data-testid="stats-card">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <SearchIcon />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Queries
                  </Typography>
                  <Typography variant="h4">
                    {stats?.total_queries || 0}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon color="success" sx={{ mr: 1, fontSize: 16 }} />
                {stats?.queries_growth_percent && (
                  <Typography variant="body2" color="success.main">
                    +{stats.queries_growth_percent}% from last month
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card data-testid="stats-card">
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <CheckCircleIcon />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Active Sessions
                  </Typography>
                  <Typography variant="h4">
                    {stats?.active_sessions || 0}
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={stats?.system_health || 'unknown'}
                color={getHealthColor(stats?.system_health || 'unknown')}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }} data-testid="dashboard-charts">
        <Grid item xs={12} md={6}>
          <Card data-testid="query-activity-chart">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Query Activity (Last 7 Days)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={queryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="queries" stroke="#1976d2" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card data-testid="user-growth-chart">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                User Growth (Last 6 Months)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="users" fill="#42a5f5" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card data-testid="recent-activity">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <List>
                {stats?.recent_activity?.map((activity: ActivityItem) => (
                  <ListItem key={activity.id} divider>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: 'grey.100' }}>
                        {getActivityIcon(activity.type)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={activity.description}
                      secondary={new Date(activity.timestamp).toLocaleString()}
                    />
                    {activity.severity && (
                      <Chip
                        label={activity.severity}
                        color={getSeverityColor(activity.severity)}
                        size="small"
                      />
                    )}
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card data-testid="quick-actions">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Status
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  CPU Usage
                </Typography>
                <LinearProgress variant="determinate" value={65} sx={{ mt: 1 }} />
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  65%
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Memory Usage
                </Typography>
                <LinearProgress variant="determinate" value={45} sx={{ mt: 1 }} />
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  45%
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Disk Usage
                </Typography>
                <LinearProgress variant="determinate" value={78} sx={{ mt: 1 }} />
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  78%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 