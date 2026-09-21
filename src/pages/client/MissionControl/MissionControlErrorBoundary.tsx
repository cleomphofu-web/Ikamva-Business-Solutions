import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class MissionControlErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Mission Control section failed", { error, info }); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <div role="alert" className="glass flex flex-col gap-3 rounded-2xl p-6"><p className="text-sm font-medium">This workspace section could not load.</p><p className="text-sm text-muted-foreground">Your session is still safe. Retry the section, or return to Overview if the problem continues.</p><div className="flex gap-2"><button className="w-fit rounded-lg border border-border px-3 py-2 text-sm" onClick={() => this.setState({ hasError: false })}>Retry section</button><a className="w-fit rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" href="/dashboard">Return to Overview</a></div></div>;
  }
}
