import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        readable = `Sync error (${parsed.operationType || 'read'}): ${parsed.error}`;
      }
    } catch {
      // Keep plain message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#110E0B] text-[#F6EFE4] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#191410] border border-[#2D241C] p-6 space-y-4 text-center shadow-2xl">
            <div className="w-11 h-11 rounded-xl bg-[#231C16] border border-[#352A21] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5 text-[#C99A4E]" />
            </div>
            <h1 className="font-display text-xl font-semibold text-[#F6EFE4]">
              Unable to Sync Data
            </h1>
            <p className="text-xs text-[#B4A693] leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2 rounded-xl bg-[#C99A4E] text-[#14100C] text-xs font-semibold hover:bg-[#D7AA60] transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
