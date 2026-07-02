"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PS13 Error Boundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#080502",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            color: "#c9a55a",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
          <div style={{ fontSize: 18, marginBottom: 8, letterSpacing: "0.1em" }}>
            PS-13 SYSTEM FAULT
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(201,165,90,0.5)",
              maxWidth: 480,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {this.state.error?.message || "An unexpected error occurred."}
          </div>
          <button
            onClick={() =>
              this.setState({ hasError: false, error: null })
            }
            style={{
              padding: "8px 24px",
              border: "1px solid rgba(201,165,90,0.4)",
              background: "transparent",
              color: "#c9a55a",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              letterSpacing: "0.15em",
            }}
          >
            ✦ RESTART SANCTUM ✦
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
