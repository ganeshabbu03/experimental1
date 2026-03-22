import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error in component tree:", error, errorInfo);
        // Example: Sentry.captureException(error, { extra: errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <div style={{ padding: '20px', border: '1px solid red', borderRadius: '5px' }}>
                    <h1>Something went wrong.</h1>
                    <p>We're sorry for the inconvenience. Please try refreshing the page.</p>
                    {/* In development, you might show more details: */}
                    {/* {process.env.NODE_ENV === 'development' && <pre>{error.message}</pre>} */}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
