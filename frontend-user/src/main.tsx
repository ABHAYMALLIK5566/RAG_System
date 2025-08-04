import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { UIProvider } from './contexts/UIContext'

// Wait for APP_CONFIG to be available
const waitForConfig = () => {
  return new Promise<void>((resolve) => {
    if (window.APP_CONFIG) {
      console.log('APP_CONFIG available immediately:', window.APP_CONFIG)
      resolve()
    } else {
      console.log('Waiting for APP_CONFIG to load...')
      const checkConfig = () => {
        if (window.APP_CONFIG) {
          console.log('APP_CONFIG loaded:', window.APP_CONFIG)
          resolve()
        } else {
          setTimeout(checkConfig, 100)
        }
      }
      checkConfig()
    }
  })
}

// Initialize the app after config is loaded
const initializeApp = async () => {
  try {
    await waitForConfig()
    
    const rootElement = document.getElementById('root')
    if (!rootElement) {
      throw new Error('Root element not found')
    }

    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <UIProvider>
          <App />
        </UIProvider>
      </React.StrictMode>,
    )
    
    console.log('React app initialized successfully')
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }
}

// Start the app
console.log('Starting app initialization...')
initializeApp() 