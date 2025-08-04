import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  CircularProgress,
  Menu,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Message as MessageIcon,
  Timer as TimerIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useGetUserAnalyticsQuery, useGetUserPerformanceQuery, useGetUserTrendsQuery } from '../../services/api';
import { UserAnalyticsResponse, PerformanceMetricsResponse, UsageTrendsResponse } from '../../types';

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);

  // Fetch analytics data
  const { 
    data: analyticsData, 
    isLoading: isAnalyticsLoading, 
    error: analyticsError,
    refetch: refetchAnalytics 
  } = useGetUserAnalyticsQuery(timeRange);

  const { 
    data: performanceData, 
    isLoading: isPerformanceLoading, 
    error: performanceError 
  } = useGetUserPerformanceQuery(timeRange);

  const { 
    data: trendsData, 
    isLoading: isTrendsLoading, 
    error: trendsError 
  } = useGetUserTrendsQuery(timeRange);

  const handleRefresh = () => {
    setIsLoading(true);
    refetchAnalytics();
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    console.log('Export button clicked');
    console.log('Analytics data available:', !!analyticsData);
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    console.log('Export menu closing');
    setExportAnchorEl(null);
  };

  const exportToCSV = () => {
    if (!analyticsData) {
      console.log('No analytics data available for CSV export');
      return;
    }

    console.log('Exporting to CSV:', analyticsData);

    const csvData = [
      // Header
      ['Metric', 'Value'],
      ['Total Queries', analyticsData.statistics.total_queries],
      ['Successful Queries', analyticsData.statistics.successful_queries],
      ['Failed Queries', analyticsData.statistics.failed_queries],
      ['Success Rate (%)', analyticsData.statistics.success_rate],
      ['Average Response Time (s)', analyticsData.statistics.avg_response_time],
      ['Total Response Time (s)', analyticsData.statistics.total_response_time],
      ['Unique Sessions', analyticsData.statistics.unique_sessions],
      [],
      ['Date', 'Queries', 'Avg Response Time (s)', 'Success Rate (%)'],
      ...analyticsData.trends.map(trend => [
        trend.date,
        trend.queries,
        trend.avg_response_time,
        trend.success_rate
      ]),
      [],
      ['Query Type', 'Count', 'Percentage (%)', 'Avg Response Time (s)'],
      ...analyticsData.query_types.map(type => [
        type.query_type,
        type.count,
        type.percentage,
        type.avg_response_time
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    console.log('CSV Content:', csvContent);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleExportClose();
    console.log('CSV export completed');
  };

  const exportToJSON = () => {
    if (!analyticsData) {
      console.log('No analytics data available for JSON export');
      return;
    }

    console.log('Exporting to JSON:', analyticsData);

    const exportData = {
      export_date: new Date().toISOString(),
      time_range: timeRange,
      analytics: analyticsData,
      performance: performanceData,
      trends: trendsData
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    console.log('JSON Content length:', jsonContent.length);
    
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_${timeRange}_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    handleExportClose();
    console.log('JSON export completed');
  };

  // Show loading state
  if (isAnalyticsLoading || isPerformanceLoading || isTrendsLoading) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  // Show error state
  if (analyticsError || performanceError || trendsError) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load analytics data. Please try again.
        </Alert>
        <Button variant="contained" onClick={handleRefresh}>
          Retry
        </Button>
      </Box>
    );
  }

  // Use real data or fallback to empty state
  const data = analyticsData || {
    statistics: {
      total_queries: 0,
      successful_queries: 0,
      failed_queries: 0,
      success_rate: 0,
      avg_response_time: 0,
      total_response_time: 0,
      unique_sessions: 0
    },
    trends: [],
    query_types: [],
    performance: {
      response_time_buckets: {},
      hourly_usage: [],
      daily_usage: [],
      weekly_usage: []
    },
    recent_activity: []
  };

  const performance = performanceData || {
    avg_response_time: 0,
    median_response_time: 0,
    p95_response_time: 0,
    p99_response_time: 0,
    min_response_time: 0,
    max_response_time: 0,
    response_time_distribution: {},
    hourly_performance: []
  };

  const trends = trendsData?.trends || [];

  // Prepare chart data
  const usageStats = data.trends.map(trend => ({
    date: trend.date,
    queries: trend.queries,
    responses: trend.queries, // Assuming all queries get responses
    avgTime: trend.avg_response_time
  }));

  const queryTypesData = data.query_types.map(type => ({
    name: type.query_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: type.count,
    color: getQueryTypeColor(type.query_type)
  }));

  const responseTimeData = Object.entries(performance.response_time_distribution).map(([bucket, count]) => ({
    time: bucket,
    avg: count
  }));

  function getQueryTypeColor(queryType: string): string {
    const colors = {
      'general': '#8884d8',
      'code_analysis': '#82ca9d',
      'document_search': '#ffc658',
      'data_analysis': '#ff7300',
      'comparison': '#8dd1e1',
      'technical_support': '#ff6b6b',
      'research': '#4ecdc4',
      'learning': '#45b7d1',
      'business': '#96ceb4'
    };
    return colors[queryType as keyof typeof colors] || '#8884d8';
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Analytics Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh data">
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            size="small"
            onClick={handleExportClick}
            disabled={!analyticsData}
          >
            Export
          </Button>
          <Menu
            anchorEl={exportAnchorEl}
            open={Boolean(exportAnchorEl)}
            onClose={handleExportClose}
          >
            <MenuItem onClick={exportToCSV}>
              Export as CSV
            </MenuItem>
            <MenuItem onClick={exportToJSON}>
              Export as JSON
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Performance Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <MessageIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Total Queries
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  {data.statistics.total_queries.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {data.statistics.success_rate.toFixed(1)}% success rate
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} style={{ transitionDelay: '100ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckCircleIcon color="success" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Success Rate
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  {data.statistics.success_rate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {data.statistics.successful_queries} successful queries
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} style={{ transitionDelay: '200ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TimerIcon color="warning" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Avg Response
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                  {data.statistics.avg_response_time.toFixed(1)}s
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {performance.p95_response_time.toFixed(1)}s p95
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Zoom in={true} style={{ transitionDelay: '300ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SpeedIcon color="info" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Sessions
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main' }}>
                  {data.statistics.unique_sessions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active sessions
                </Typography>
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Usage Over Time */}
        <Grid item xs={12} lg={8}>
          <Zoom in={true} style={{ transitionDelay: '400ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <TrendingUpIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Usage Over Time
                  </Typography>
                </Box>
                {usageStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={usageStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Area 
                        type="monotone" 
                        dataKey="queries" 
                        stackId="1" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                    <Typography color="text.secondary">No data available for the selected time range</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Query Types Distribution */}
        <Grid item xs={12} lg={4}>
          <Zoom in={true} style={{ transitionDelay: '500ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <MessageIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Query Types
                  </Typography>
                </Box>
                {queryTypesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={queryTypesData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {queryTypesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                    <Typography color="text.secondary">No query type data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Response Time Distribution */}
        <Grid item xs={12} lg={6}>
          <Zoom in={true} style={{ transitionDelay: '600ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <TimerIcon color="warning" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Response Time Distribution
                  </Typography>
                </Box>
                {responseTimeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={responseTimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="avg" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                    <Typography color="text.secondary">No response time data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} lg={6}>
          <Zoom in={true} style={{ transitionDelay: '700ms' }}>
            <Card elevation={3} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <MessageIcon color="primary" sx={{ mr: 2 }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Recent Activity
                  </Typography>
                </Box>
                {data.recent_activity.length > 0 ? (
                  <List dense>
                    {data.recent_activity.slice(0, 5).map((activity, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          {activity.success ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            <ErrorIcon color="error" />
                          )}
                        </ListItemIcon>
                        <ListItemText 
                          primary={activity.query} 
                          secondary={new Date(activity.timestamp).toLocaleString()}
                        />
                        <ListItemSecondaryAction>
                          <Chip 
                            label={activity.success ? "Success" : "Error"} 
                            color={activity.success ? "success" : "error"} 
                            size="small" 
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                    <Typography color="text.secondary">No recent activity</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Zoom>
        </Grid>
      </Grid>

      {/* Loading Indicator */}
      {isLoading && (
        <Fade in={isLoading}>
          <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
            <LinearProgress />
          </Box>
        </Fade>
      )}
    </Box>
  );
};

export default Analytics; 