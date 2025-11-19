import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 flex items-center justify-center p-4">
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="p-4 bg-red-100 rounded-full w-fit mx-auto mb-6">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-4">
              حدث خطأ غير متوقع
            </h1>
            
            <p className="text-slate-600 mb-6 leading-relaxed">
              عذراً، حدث خطأ في النظام. يرجى المحاولة مرة أخرى أو العودة للصفحة الرئيسية.
            </p>

            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-red-700 font-mono break-all">
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleRetry}
                variant="outline"
                className="border-primary/20 text-primary hover:bg-primary/5"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                المحاولة مرة أخرى
              </Button>
              
              <Button
                onClick={this.handleGoHome}
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary"
              >
                <Home className="w-4 h-4 mr-2" />
                العودة للرئيسية
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
