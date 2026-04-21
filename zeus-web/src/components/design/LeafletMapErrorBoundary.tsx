import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onError: (error: Error) => void;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Error boundary for LeafletWorldMap — catches Leaflet init failures (missing
 * library, tile server unavailable, etc.) and renders a fallback instead of
 * crashing the entire QRZ panel. When an error occurs, calls the onError
 * callback so App.tsx can set mapAvailable=false and hide map-dependent UI.
 */
export class LeafletMapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
