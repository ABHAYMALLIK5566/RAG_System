import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import { useAppSelector } from '../../store';

const TestPage: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAppSelector((state) => state.auth);

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Frontend Test Page
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        This page helps verify that the frontend is working correctly.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Authentication Status
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Is Authenticated: {isAuthenticated ? 'Yes' : 'No'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Is Loading: {isLoading ? 'Yes' : 'No'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            User: {user ? user.username : 'None'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Token in localStorage: {localStorage.getItem('token') ? 'Yes' : 'No'}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={() => {
                localStorage.removeItem('token');
                window.location.reload();
              }}
            >
              Clear Token & Reload
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                console.log('Current auth state:', { isAuthenticated, user, isLoading });
                console.log('localStorage token:', localStorage.getItem('token'));
              }}
            >
              Log State to Console
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TestPage; 