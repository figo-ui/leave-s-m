// Create a config file: src/config.js
export const config = {
  apiBaseUrl: process.env.NODE_ENV === 'production'
    ? 'https://10.140.8.10/api'  // Your server IP
    : 'http://localhost:5000/api',
    
  appVersion: '1.0.0',
  enableDebug: process.env.NODE_ENV !== 'production'
};

// Update your apiService.ts to use this config
const API_BASE_URL = config.apiBaseUrl;