import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

interface UISettings {
  darkMode: boolean;
  fontSize: number;
  theme: 'light' | 'dark' | 'auto';
  compactMode: boolean;
  // Add other UI settings as needed
}

interface UIContextType {
  settings: UISettings;
  updateSetting: (key: keyof UISettings, value: any) => void;
  updateSettings: (newSettings: Partial<UISettings>) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

const defaultSettings: UISettings = {
  darkMode: false,
  fontSize: 14,
  theme: 'light',
  compactMode: false,
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

interface UIProviderProps {
  children: ReactNode;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UISettings>(defaultSettings);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('ui-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to parse UI settings:', error);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('ui-settings', JSON.stringify(settings));
    }
  }, [settings, isInitialized]);

  // Apply settings to document
  useEffect(() => {
    if (!isInitialized) return; // Don't apply settings until initialized
    
    console.log('UI Context: Applying settings:', settings); // Debug log
    
    // Apply dark mode class to body
    if (settings.darkMode) {
      document.body.classList.add('dark-mode');
      console.log('Added dark-mode class');
    } else {
      document.body.classList.remove('dark-mode');
      console.log('Removed dark-mode class');
    }

    // Apply compact mode class
    if (settings.compactMode) {
      document.body.classList.add('compact-mode');
      console.log('Added compact-mode class');
    } else {
      document.body.classList.remove('compact-mode');
      console.log('Removed compact-mode class');
    }

    // Apply font size
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
    console.log('Set font size to:', settings.fontSize);
  }, [settings, isInitialized]);

  const updateSetting = (key: keyof UISettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateSettings = (newSettings: Partial<UISettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Create MUI theme based on settings
  const theme = createTheme({
    palette: {
      mode: settings.darkMode ? 'dark' : 'light',
      primary: {
        main: '#2563eb',
        light: '#3b82f6',
        dark: '#1d4ed8',
      },
      secondary: {
        main: '#7c3aed',
        light: '#8b5cf6',
        dark: '#6d28d9',
      },
      background: {
        default: settings.darkMode ? '#0f172a' : '#f8fafc',
        paper: settings.darkMode ? '#1e293b' : '#ffffff',
      },
      text: {
        primary: settings.darkMode ? '#f1f5f9' : '#1e293b',
        secondary: settings.darkMode ? '#94a3b8' : '#64748b',
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: settings.fontSize,
      h1: {
        fontSize: '2.25rem',
        fontWeight: 700,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '1.875rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      h5: {
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.6,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.6,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
    },
    spacing: settings.compactMode ? 4 : 8, // Reduce spacing in compact mode
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: settings.compactMode ? 4 : 8,
            fontWeight: 500,
            padding: settings.compactMode ? '6px 12px' : '8px 16px',
          },
          contained: {
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            '&:hover': {
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: settings.compactMode ? 8 : 12,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            border: settings.darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: settings.compactMode ? 8 : 12,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: settings.compactMode ? 6 : 8,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: settings.compactMode ? 4 : 6,
            fontWeight: 500,
          },
        },
      },
    },
    shape: {
      borderRadius: settings.compactMode ? 6 : 8,
    },
  });

  const value: UIContextType = {
    settings,
    updateSetting,
    updateSettings,
  };

  return (
    <UIContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </UIContext.Provider>
  );
}; 