import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Container,
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../store';
import { login } from '../../store/slices/authSlice';

const validationSchema = yup.object({
  username: yup
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
    .required('Username is required'),
  password: yup
    .string()
    .min(6, 'Password should be of minimum 6 characters length')
    .required('Password is required'),
});

const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error, isAuthenticated } = useAppSelector((state: any) => state.auth);

  const from = location.state?.from?.pathname || '/';

  // Debug logs removed to prevent infinite re-rendering noise

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
      remember_me: false,
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      console.log('🔐 [Login] Form submitted with values:', { username: values.username });
      try {
        console.log('🔐 [Login] Dispatching login action...');
        const result = await dispatch(login(values)).unwrap();
        console.log('🔐 [Login] Login successful:', result);
        console.log('🔐 [Login] Navigating to:', from);
        navigate(from, { replace: true });
      } catch (error) {
        console.error('🔐 [Login] Login failed:', error);
        // Error is handled by the Redux slice
      }
    },
  });

  return (
    <Container component="main" maxWidth="xs" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <LockIcon sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
            <Typography component="h1" variant="h4" sx={{ fontWeight: 'bold' }}>
              RAG Chat
            </Typography>
          </Box>

          <Typography component="h2" variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to start querying
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={formik.handleSubmit} sx={{ width: '100%' }} data-testid="login-form">
            <TextField
              fullWidth
              id="username"
              name="username"
              label="Username"
              value={formik.values.username}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.username && Boolean(formik.errors.username)}
              helperText={formik.touched.username && formik.errors.username}
              margin="normal"
              autoComplete="username"
              autoFocus
              data-testid="username-input"
            />

            <TextField
              fullWidth
              id="password"
              name="password"
              label="Password"
              type="password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.password && Boolean(formik.errors.password)}
              helperText={formik.touched.password && formik.errors.password}
              margin="normal"
              autoComplete="current-password"
              data-testid="password-input"
            />

            <FormControlLabel
              control={
                <Checkbox
                  id="remember_me"
                  name="remember_me"
                  checked={formik.values.remember_me}
                  onChange={formik.handleChange}
                  color="primary"
                />
              }
              label="Remember me"
              sx={{ mt: 1 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={isLoading}
              data-testid="login-button"
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Access advanced RAG query capabilities
          </Typography>
          
          <Typography variant="body2" color="primary" sx={{ mt: 1, cursor: 'pointer' }} onClick={() => navigate('/debug-login')}>
            Debug Login (Direct API Test)
          </Typography>
          <Typography variant="body2" color="primary" sx={{ mt: 1, cursor: 'pointer' }} onClick={() => navigate('/debug-storage')}>
            Debug Storage
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 