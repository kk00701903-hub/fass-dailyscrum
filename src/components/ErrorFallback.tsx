import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/errors/log-error";

interface Props {
  children: ReactNode;
  /** 중첩 경계용 — 페이지 단위 복구 */
  compact?: boolean;
}

interface State {
  error: Error | null;
}

/**
 * React 렌더 트리 예외를 캐치해 화이트스크린을 방지합니다.
 * 루트(main.tsx) 및 필요 시 레이아웃/페이지에 중첩해 사용할 수 있습니다.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, {
      source: "AppErrorBoundary",
      extra: { componentStack: info.componentStack },
    });
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const compact = this.props.compact;

      return (
        <div
          className={
            compact
              ? "flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 p-6"
              : "flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground"
          }
          role="alert"
        >
          <AlertTriangle
            className={compact ? "h-8 w-8 text-destructive" : "h-10 w-10 text-destructive"}
            aria-hidden
          />
          <div className="max-w-md text-center">
            <h1 className={compact ? "text-base font-semibold" : "text-lg font-semibold"}>
              일시적인 오류가 발생했습니다
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              잠시 후 다시 시도해 주세요. 문제가 계속되면 페이지를 새로고침하거나 관리자에게
              문의해 주세요.
            </p>
          </div>
          {!import.meta.env.PROD && (
            <pre className="max-h-32 max-w-xl overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="default" className="gap-1.5" onClick={this.handleRetry}>
              <RotateCcw className="h-4 w-4" />
              다시 시도
            </Button>
            <Button type="button" variant="outline" onClick={this.handleReload}>
              새로고침
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** AppErrorBoundary 별칭 */
export { AppErrorBoundary as ErrorBoundary };
