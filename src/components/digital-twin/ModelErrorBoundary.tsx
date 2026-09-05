"use client";

// ============================================================================
// digital-twin/ModelErrorBoundary.tsx
//
// `useGLTF` (drei) suspends while loading and *throws* (a rejected promise)
// if the asset request fails — e.g. /models/mine.glb doesn't exist yet.
// A thrown error during render is only catchable by a class-based React
// Error Boundary, not by a functional component or Suspense fallback, so
// this small boundary is what actually implements "app must not fail if the
// model is missing" from the spec.
// ============================================================================

import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ModelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn(
      "[MineModel] /models/mine.glb failed to load — using procedural fallback terrain.",
      error
    );
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
