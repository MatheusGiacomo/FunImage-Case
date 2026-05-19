'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <div>
            <p className="font-display text-2xl font-light text-obsidian-100">
              Algo deu errado
            </p>
            <p className="text-sm text-obsidian-500 mt-1 max-w-sm">
              {this.state.error?.message ?? 'Ocorreu um erro inesperado nesta página.'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="btn-ghost flex items-center gap-2 text-sm border border-obsidian-700"
          >
            <RefreshCw size={14} />
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}