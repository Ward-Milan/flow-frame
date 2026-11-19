/**
 * ErrorBoundary - Capture errors per module without crashing the app
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    moduleName?: string;
    onReset?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
        
        // Could send to error tracking service here
        // errorTrackingService.captureException(error, { extra: errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        this.props.onReset?.();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="h-full w-full flex items-center justify-center bg-[var(--bg-app)] p-8">
                    <div className="max-w-md text-center">
                        {/* Error Icon */}
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                            {this.props.moduleName 
                                ? `Erreur dans ${this.props.moduleName}`
                                : 'Une erreur est survenue'
                            }
                        </h2>

                        {/* Description */}
                        <p className="text-[var(--text-secondary)] text-sm mb-6">
                            Ce module a rencontré un problème. Vous pouvez essayer de le recharger ou revenir à l'accueil.
                        </p>

                        {/* Error details (collapsed) */}
                        {this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                                    Détails techniques
                                </summary>
                                <pre className="mt-2 p-3 bg-[var(--bg-panel)] rounded-lg text-xs text-red-400 overflow-auto max-h-32 border border-[var(--border-color)]">
                                    {this.state.error.message}
                                    {this.state.errorInfo?.componentStack && (
                                        <span className="text-[var(--text-muted)]">
                                            {this.state.errorInfo.componentStack.slice(0, 500)}
                                        </span>
                                    )}
                                </pre>
                            </details>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
                            >
                                <RefreshCw size={16} />
                                Réessayer
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-panel)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg font-bold text-sm hover:bg-[var(--bg-element)] transition-colors"
                            >
                                <Home size={16} />
                                Accueil
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// HOC wrapper for functional components
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    moduleName?: string
): React.FC<P> {
    return function WrappedComponent(props: P) {
        return (
            <ErrorBoundary moduleName={moduleName}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
