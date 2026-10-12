import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Card } from "./index";

export interface ViewErrorBoundaryProps {
  name: string;
  children: ReactNode;
  onReset?: () => void;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ViewErrorBoundary:${this.props.name}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <Card
          className="view-error-boundary"
          data-testid={`view-error-${this.props.name}`}
        >
          <p role="alert" className="form-error">
            Chưa tải được phần {this.props.name}. Dữ liệu của bạn vẫn an toàn.
          </p>
          <Button onClick={this.handleReset} className="button-outline">
            Tải lại {this.props.name}
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}
