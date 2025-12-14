// hooks/useNetworkStatus.ts
import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkType, setNetworkType] = useState<'slow-2g' | '2g' | '3g' | '4g' | 'unknown'>('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Check connection type (if supported)
    const checkConnection = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          setNetworkType(connection.effectiveType);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', checkConnection);
        checkConnection();
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        if (connection) {
          connection.removeEventListener('change', checkConnection);
        }
      }
    };
  }, []);

  return {
    isOnline,
    networkType,
    isSlowConnection: networkType === 'slow-2g' || networkType === '2g'
  };
}