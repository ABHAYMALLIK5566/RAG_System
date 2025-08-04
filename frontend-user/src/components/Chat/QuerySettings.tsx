import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControlLabel,
  Switch,
  Slider,
  TextField,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface QuerySettings {
  maxTokens: number;
  temperature: number;
  topK: number;
  topP: number;
  includeSources: boolean;
  streamResponse: boolean;
  modelName: string;
}

const QuerySettings = () => {
  const [settings, setSettings] = useState<QuerySettings>({
    maxTokens: 1000,
    temperature: 0.7,
    topK: 5,
    topP: 0.9,
    includeSources: true,
    streamResponse: false,
    modelName: 'gpt-3.5-turbo',
  });

  const [isSaved, setIsSaved] = useState(false);

  const handleSettingChange = (key: keyof QuerySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsSaved(false);
  };

  const handleSave = () => {
    // Save settings to localStorage or backend
    localStorage.setItem('rag-query-settings', JSON.stringify(settings));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    const defaultSettings: QuerySettings = {
      maxTokens: 1000,
      temperature: 0.7,
      topK: 5,
      topP: 0.9,
      includeSources: true,
      streamResponse: false,
      modelName: 'gpt-3.5-turbo',
    };
    setSettings(defaultSettings);
    setIsSaved(false);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Query Settings
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Configure RAG query parameters
        </Typography>
      </Box>

      {/* Settings Form */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isSaved && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Settings saved successfully!
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Model Selection */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Model Configuration
            </Typography>
            <TextField
              fullWidth
              label="Model Name"
              value={settings.modelName}
              onChange={(e) => handleSettingChange('modelName', e.target.value)}
              size="small"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet'].map((model) => (
                <Chip
                  key={model}
                  label={model}
                  size="small"
                  variant={settings.modelName === model ? 'filled' : 'outlined'}
                  onClick={() => handleSettingChange('modelName', model)}
                  color={settings.modelName === model ? 'primary' : 'default'}
                />
              ))}
            </Box>
          </Paper>

          {/* Response Settings */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Response Settings
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Max Tokens: {settings.maxTokens}
              </Typography>
              <Slider
                value={settings.maxTokens}
                onChange={(_, value) => handleSettingChange('maxTokens', value)}
                min={100}
                max={4000}
                step={100}
                marks={[
                  { value: 100, label: '100' },
                  { value: 2000, label: '2000' },
                  { value: 4000, label: '4000' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Temperature: {settings.temperature}
              </Typography>
              <Slider
                value={settings.temperature}
                onChange={(_, value) => handleSettingChange('temperature', value)}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Top-K: {settings.topK}
              </Typography>
              <Slider
                value={settings.topK}
                onChange={(_, value) => handleSettingChange('topK', value)}
                min={1}
                max={20}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 10, label: '10' },
                  { value: 20, label: '20' },
                ]}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Top-P: {settings.topP}
              </Typography>
              <Slider
                value={settings.topP}
                onChange={(_, value) => handleSettingChange('topP', value)}
                min={0}
                max={1}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' },
                ]}
              />
            </Box>
          </Paper>

          {/* Feature Toggles */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Features
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.includeSources}
                  onChange={(e) => handleSettingChange('includeSources', e.target.checked)}
                />
              }
              label="Include Sources"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={settings.streamResponse}
                  onChange={(e) => handleSettingChange('streamResponse', e.target.checked)}
                />
              }
              label="Stream Response"
            />
          </Paper>
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
          >
            Save Settings
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
          >
            Reset
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default QuerySettings; 