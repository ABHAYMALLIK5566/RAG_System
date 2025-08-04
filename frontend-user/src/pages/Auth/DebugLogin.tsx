import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
} from '@mui/material';
import axios from 'axios';

const DebugLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔍 [Debug] Testing direct API call...');
      
      // Direct API call without interceptors
      const response = await axios.post('http://localhost:8000/api/v1/auth/login', {
        username,
        password
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('🔍 [Debug] Response:', response.status, response.data);
      
      if (response.data.access_token) {
        setSuccess(`Login successful! Token: ${response.data.access_token.substring(0, 20)}...`);
        localStorage.setItem('token', response.data.access_token);
      } else {
        setError('No access token in response');
      }
    } catch (err: any) {
      console.error('🔍 [Debug] Error:', err);
      if (err.response) {
        console.error('🔍 [Debug] Response error:', err.response.status, err.response.data);
        setError(`HTTP ${err.response.status}: ${err.response.data?.detail || 'Unknown error'}`);
      } else if (err.request) {
        console.error('🔍 [Debug] Network error:', err.request);
        setError('Network error - cannot reach server');
      } else {
        console.error('🔍 [Debug] Other error:', err.message);
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
        <Typography variant="h4" align="center" gutterBottom>
          Debug Login
        </Typography>
        
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Direct API test without performance monitoring
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Test Login'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Try: admin/admin or test/test
        </Typography>
      </Paper>
    </Container>
  );
};

export default DebugLogin; 