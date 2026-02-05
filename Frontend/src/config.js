// Create a config file: src/config.js
const resolveApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (import.meta.env.PROD) {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:5000/api';
};

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  enableDebug: !import.meta.env.PROD
};
