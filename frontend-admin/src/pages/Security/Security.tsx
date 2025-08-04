import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
} from '@mui/material';

const Security: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Security Monitoring
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Security Overview
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="error.main">
                5
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Critical Events
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                23
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Failed Login Attempts
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                156
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Security Events Today
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                98%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                System Security Score
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Typography variant="body1" color="text.secondary">
            Security monitoring interface will be implemented here with event logs, threat detection, and security analytics.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default Security; 