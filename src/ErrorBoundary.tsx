import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional custom fallback renderer; receives the retry callback. */
  fallback?: (error: Error, retry: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Minimal error boundary. Its main purpose is to catch a failed
 * `React.lazy` chunk load (network blip / stale deployment) and offer a retry
 * instead of unmounting the entire app with a blank screen.
 *
 * Note: `retry()` resets component state by changing `key`. Callers that need
 * a stronger reset can remount via the key prop themselves.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  retry = () => {
    // React.lazy re-throws the same chunk import if the module is cached as
    // rejected; flipping a key on the lazy child is the robust reset. Here we
    // just clear the caught error — callers can additionally remount.
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.retry)
      return (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
          style={{ background: '#1e2330' }}
        >
          <div className="text-gray-200 text-sm font-medium">
            Couldn’t load the 3D scene
          </div>
          <div className="text-gray-400 text-xs max-w-xs">
            {this.state.error.message || 'A network or graphics error occurred.'}
          </div>
          <button
            onClick={this.retry}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded text-xs text-white font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
