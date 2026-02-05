// hooks/useApi.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { apiService, ApiResponse } from '../utils/api';

interface UseApiOptions<T> {
  manual?: boolean;
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  cacheKey?: string;
  cacheTtl?: number;
}

export function useApi<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  options: UseApiOptions<T> = {}
) {
  const {
    manual = false,
    initialData,
    onSuccess,
    onError,
    cacheKey,

  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(!manual);
  const [error, setError] = useState<Error | null>(null);
  const [isCalled, setIsCalled] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    setIsCalled(true);

    try {
      const response = await fetcher();
      
      if (!response.success) {
        throw new Error(response.message || 'Request failed');
      }

      setData(response.data);
      if (response.data !== undefined) {
        onSuccess?.(response.data);
      }
      return response;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, onSuccess, onError]);

  useEffect(() => {
    if (!manual) {
      execute();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [manual, execute]);

  const refetch = useCallback(() => {
    if (cacheKey) {
      apiService.clearCache(cacheKey);
    }
    return execute();
  }, [execute, cacheKey]);

  return {
    data,
    isLoading,
    error,
    execute,
    refetch,
    isCalled
  };
}
