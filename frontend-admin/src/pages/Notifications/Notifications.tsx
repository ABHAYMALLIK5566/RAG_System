import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Email,
  Security,
  Warning,
  Settings,
  ExpandMore,
  Send,
  Refresh,
  Info,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { usePermissions } from '@/hooks/usePermissions';

interface EmailStatus {
  email_service_active: boolean;
  providers_configured: string[];
  enabled_notifications: string[];
  queue_size: number;
}

interface EmailTemplate {
  templates: string[];
  count: number;
}

const Notifications: React.FC = () => {
  const { permissions } = usePermissions();
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Test email form state
  const [testEmail, setTestEmail] = useState('');
  const [testNotificationType, setTestNotificationType] = useState('system_maintenance');
  const [testTemplate, setTestTemplate] = useState('system_notification');

  // Security alert form state
  const [securityAlert, setSecurityAlert] = useState({
    user_email: '',
    user_name: '',
    event_type: '',
    ip_address: '',
    admin_email: '',
  });

  // System maintenance form state
  const [maintenanceAlert, setMaintenanceAlert] = useState({
    admin_emails: '',
    maintenance_type: '',
    scheduled_time: '',
    duration: '',
    description: '',
  });

  // Error notification form state
  const [errorAlert, setErrorAlert] = useState({
    admin_emails: '',
    error_type: '',
    error_message: '',
    error_context: '',
  });

  useEffect(() => {
    if (permissions.system_config) {
      fetchEmailStatus();
      fetchEmailTemplates();
    }
  }, [permissions.system_config]);

  const fetchEmailStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/admin/notifications/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmailStatus(data);
      } else {
        setError('Failed to fetch email status');
      }
    } catch (err) {
      setError('Failed to fetch email status');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const response = await fetch('/api/v1/admin/notifications/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmailTemplates(data);
      }
    } catch (err) {
      // Silently fail for templates
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      setError('Please enter an email address');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/admin/notifications/test?to_email=${encodeURIComponent(testEmail)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess('Test email sent successfully!');
          setTestEmail('');
        } else {
          setError(data.message || 'Failed to send test email');
        }
      } else {
        setError('Failed to send test email');
      }
    } catch (err) {
      setError('Failed to send test email');
    } finally {
      setIsLoading(false);
    }
  };

  const sendSecurityAlert = async () => {
    if (!securityAlert.user_email || !securityAlert.user_name || !securityAlert.event_type || !securityAlert.ip_address) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/v1/admin/notifications/security-alert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(securityAlert),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess('Security alert sent successfully!');
          setSecurityAlert({
            user_email: '',
            user_name: '',
            event_type: '',
            ip_address: '',
            admin_email: '',
          });
        } else {
          setError(data.message || 'Failed to send security alert');
        }
      } else {
        setError('Failed to send security alert');
      }
    } catch (err) {
      setError('Failed to send security alert');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMaintenanceAlert = async () => {
    if (!maintenanceAlert.admin_emails || !maintenanceAlert.maintenance_type || !maintenanceAlert.scheduled_time || !maintenanceAlert.duration || !maintenanceAlert.description) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const adminEmails = maintenanceAlert.admin_emails.split(',').map(email => email.trim());
      
      const response = await fetch('/api/v1/admin/notifications/system-maintenance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...maintenanceAlert,
          admin_emails: adminEmails,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess('Maintenance notification sent successfully!');
          setMaintenanceAlert({
            admin_emails: '',
            maintenance_type: '',
            scheduled_time: '',
            duration: '',
            description: '',
          });
        } else {
          setError(data.message || 'Failed to send maintenance notification');
        }
      } else {
        setError('Failed to send maintenance notification');
      }
    } catch (err) {
      setError('Failed to send maintenance notification');
    } finally {
      setIsLoading(false);
    }
  };

  const sendErrorAlert = async () => {
    if (!errorAlert.admin_emails || !errorAlert.error_type || !errorAlert.error_message) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const adminEmails = errorAlert.admin_emails.split(',').map(email => email.trim());
      
      const response = await fetch('/api/v1/admin/notifications/error-notification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...errorAlert,
          admin_emails: adminEmails,
          error_context: errorAlert.error_context ? JSON.parse(errorAlert.error_context) : {},
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess('Error notification sent successfully!');
          setErrorAlert({
            admin_emails: '',
            error_type: '',
            error_message: '',
            error_context: '',
          });
        } else {
          setError(data.message || 'Failed to send error notification');
        }
      } else {
        setError('Failed to send error notification');
      }
    } catch (err) {
      setError('Failed to send error notification');
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  if (!permissions.system_config) {
    return (
      <Box p={3}>
        <Alert severity="error">
          You don't have permission to access notifications.
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        <Email sx={{ mr: 1, verticalAlign: 'middle' }} />
        Email Notifications
      </Typography>

      {error && (
        <Alert severity="error" onClose={clearMessages} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={clearMessages} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Email Service Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
                Email Service Status
              </Typography>
              
              {isLoading ? (
                <CircularProgress size={20} />
              ) : emailStatus ? (
                <Box>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Chip
                      icon={emailStatus.email_service_active ? <CheckCircle /> : <Error />}
                      label={emailStatus.email_service_active ? 'Active' : 'Inactive'}
                      color={emailStatus.email_service_active ? 'success' : 'error'}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Providers:</strong> {emailStatus.providers_configured.join(', ') || 'None'}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Enabled Notifications:</strong> {emailStatus.enabled_notifications.join(', ')}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Queue Size:</strong> {emailStatus.queue_size}
                  </Typography>
                  
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={fetchEmailStatus}
                    sx={{ mt: 1 }}
                  >
                    Refresh Status
                  </Button>
                </Box>
              ) : (
                <Typography color="text.secondary">No status available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Email Templates */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
                Email Templates
              </Typography>
              
              {emailTemplates ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Available Templates:</strong> {emailTemplates.count}
                  </Typography>
                  
                  <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                    {emailTemplates.templates.map((template) => (
                      <Chip key={template} label={template} size="small" />
                    ))}
                  </Box>
                </Box>
              ) : (
                <Typography color="text.secondary">No templates available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Test Email */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Send sx={{ mr: 1, verticalAlign: 'middle' }} />
                Test Email Notification
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Template</InputLabel>
                    <Select
                      value={testTemplate}
                      onChange={(e) => setTestTemplate(e.target.value)}
                      label="Template"
                    >
                      {emailTemplates?.templates.map((template) => (
                        <MenuItem key={template} value={template}>
                          {template}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={<Send />}
                    onClick={sendTestEmail}
                    disabled={isLoading || !testEmail}
                  >
                    Send Test Email
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Alert */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">
                <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
                Security Alert Notification
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="User Email"
                    value={securityAlert.user_email}
                    onChange={(e) => setSecurityAlert({ ...securityAlert, user_email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="User Name"
                    value={securityAlert.user_name}
                    onChange={(e) => setSecurityAlert({ ...securityAlert, user_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Event Type"
                    value={securityAlert.event_type}
                    onChange={(e) => setSecurityAlert({ ...securityAlert, event_type: e.target.value })}
                    placeholder="Failed Login Attempt"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IP Address"
                    value={securityAlert.ip_address}
                    onChange={(e) => setSecurityAlert({ ...securityAlert, ip_address: e.target.value })}
                    placeholder="192.168.1.1"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Admin Email (Optional)"
                    value={securityAlert.admin_email}
                    onChange={(e) => setSecurityAlert({ ...securityAlert, admin_email: e.target.value })}
                    placeholder="admin@example.com"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<Security />}
                    onClick={sendSecurityAlert}
                    disabled={isLoading || !securityAlert.user_email || !securityAlert.user_name || !securityAlert.event_type || !securityAlert.ip_address}
                  >
                    Send Security Alert
                  </Button>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* System Maintenance */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">
                <Settings sx={{ mr: 1, verticalAlign: 'middle' }} />
                System Maintenance Notification
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Admin Emails (comma-separated)"
                    value={maintenanceAlert.admin_emails}
                    onChange={(e) => setMaintenanceAlert({ ...maintenanceAlert, admin_emails: e.target.value })}
                    placeholder="admin1@example.com, admin2@example.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Maintenance Type"
                    value={maintenanceAlert.maintenance_type}
                    onChange={(e) => setMaintenanceAlert({ ...maintenanceAlert, maintenance_type: e.target.value })}
                    placeholder="Database Update"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Scheduled Time"
                    value={maintenanceAlert.scheduled_time}
                    onChange={(e) => setMaintenanceAlert({ ...maintenanceAlert, scheduled_time: e.target.value })}
                    placeholder="2024-01-15 02:00 UTC"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Duration"
                    value={maintenanceAlert.duration}
                    onChange={(e) => setMaintenanceAlert({ ...maintenanceAlert, duration: e.target.value })}
                    placeholder="2 hours"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={maintenanceAlert.description}
                    onChange={(e) => setMaintenanceAlert({ ...maintenanceAlert, description: e.target.value })}
                    placeholder="Scheduled database maintenance"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="info"
                    startIcon={<Settings />}
                    onClick={sendMaintenanceAlert}
                    disabled={isLoading || !maintenanceAlert.admin_emails || !maintenanceAlert.maintenance_type || !maintenanceAlert.scheduled_time || !maintenanceAlert.duration || !maintenanceAlert.description}
                  >
                    Send Maintenance Notification
                  </Button>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Error Notification */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">
                <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
                Error Notification
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Admin Emails (comma-separated)"
                    value={errorAlert.admin_emails}
                    onChange={(e) => setErrorAlert({ ...errorAlert, admin_emails: e.target.value })}
                    placeholder="admin1@example.com, admin2@example.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Error Type"
                    value={errorAlert.error_type}
                    onChange={(e) => setErrorAlert({ ...errorAlert, error_type: e.target.value })}
                    placeholder="Database Connection Error"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Error Message"
                    value={errorAlert.error_message}
                    onChange={(e) => setErrorAlert({ ...errorAlert, error_message: e.target.value })}
                    placeholder="Failed to connect to database"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Error Context (JSON)"
                    value={errorAlert.error_context}
                    onChange={(e) => setErrorAlert({ ...errorAlert, error_context: e.target.value })}
                    placeholder='{"component": "database", "severity": "high"}'
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Warning />}
                    onClick={sendErrorAlert}
                    disabled={isLoading || !errorAlert.admin_emails || !errorAlert.error_type || !errorAlert.error_message}
                  >
                    Send Error Notification
                  </Button>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Notifications; 