// components/common/ApiErrorBoundary.tsx
import  { Component, ErrorInfo, ReactNode } from 'react';
import { apiService } from '../../utils/api';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ApiErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ApiErrorBoundary caught error:', error, errorInfo);
    
    // Send to error tracking service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Clear API cache on major errors
    if (error.message.includes('Network') || error.message.includes('401')) {
      apiService.clearCache();
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="api-error-boundary">
          <h3>Something went wrong</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }

    return this.props.children;
  }
}