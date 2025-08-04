import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Provider } from 'react-redux';
import { SnackbarProvider } from 'notistack';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './store';
import { getCurrentUser } from './store/slices/authSlice';
import { UIProvider } from './contexts/UIContext';

// Components
import ChatInterface from './components/Chat/ChatInterface';
// import ModernChatInterface from './components/Chat/ModernChatInterface';
import PageTransition from './components/Common/PageTransition';
import RealTimeMetrics from './components/Performance/RealTimeMetrics';
import DebugLogin from './pages/Auth/DebugLogin';
import TestPage from './pages/Auth/TestPage';
import AppLayout from './components/Layout/AppLayout';

import Login from './pages/Auth/Login';
import Profile from './pages/Profile/Profile';
import Settings from './pages/Settings/Settings';
import Analytics from './pages/Analytics/Analytics';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import LoadingSpinner from './components/Common/LoadingSpinner';

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);
  const hasAttemptedAuth = useRef(false);

  // Debug logs reduced to prevent console spam

  useEffect(() => {
    // Only attempt to get user once if we have a token but not authenticated
    if (localStorage.getItem('token') && !isAuthenticated && !isLoading && !hasAttemptedAuth.current) {
      console.log('Token exists but not authenticated, trying to get user...');
      hasAttemptedAuth.current = true;
      dispatch(getCurrentUser());
    }
  }, [dispatch, isAuthenticated, isLoading]);

  // Show loading spinner for initial auth check or when we have a token but no user yet
  if (isLoading || (localStorage.getItem('token') && !isAuthenticated)) {
    console.log('AppContent - showing loading spinner for auth');
    return <LoadingSpinner />;
  }

  console.log('AppContent - rendering routes, isAuthenticated:', isAuthenticated);

  return (
    <Router>
      <Box sx={{ 
        display: 'flex', 
        minHeight: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        overflow: 'hidden'
      }}>
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login />
          } />
          
          <Route path="/debug-login" element={<DebugLogin />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/debug-storage" element={
            <div style={{ padding: '20px' }}>
              <h2>Storage Debug</h2>
              <p>Visit <a href="/clear-storage.html" target="_blank">/clear-storage.html</a> to clear localStorage</p>
            </div>
          } />
          
          <Route path="/" element={
            <ProtectedRoute>
              <ChatInterface />
            </ProtectedRoute>
          } />
          
          <Route path="/classic" element={
            <ProtectedRoute>
              <ChatInterface />
            </ProtectedRoute>
          } />
          

          
          <Route path="/profile" element={
            <ProtectedRoute>
              <AppLayout>
                <Profile />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout>
                <Settings />
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/analytics" element={
            <ProtectedRoute>
              <AppLayout>
                <PageTransition loadingMessage="Loading Analytics">
                  <Analytics />
                </PageTransition>
              </AppLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/performance" element={
            <ProtectedRoute>
              <AppLayout>
                <PageTransition loadingMessage="Loading Performance Metrics">
                  <RealTimeMetrics />
                </PageTransition>
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </Box>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <UIProvider>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <AppContent />
        </SnackbarProvider>
      </UIProvider>
    </Provider>
  );
};

export default App; 