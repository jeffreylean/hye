import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XCircleIcon,
  LoaderIcon,
  TerminalIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const isRunning = status?.type === "running";
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const isError =
    status?.type === "incomplete" && status.reason === "error";
  const cancelledReason =
    (isCancelled || isError) && status.error
      ? typeof status.error === "string"
        ? status.error
        : JSON.stringify(status.error)
      : null;

  const isBashTool = toolName === "bash";

  const StatusIcon = () => {
    if (isRunning) {
      return <LoaderIcon className="aui-tool-fallback-icon size-4 animate-spin text-blue-500" />;
    }
    if (isCancelled || isError) {
      return <XCircleIcon className="aui-tool-fallback-icon size-4 text-destructive" />;
    }
    if (isBashTool) {
      return <TerminalIcon className="aui-tool-fallback-icon size-4 text-green-500" />;
    }
    return <CheckIcon className="aui-tool-fallback-icon size-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isRunning) return "Running: ";
    if (isCancelled) return "Cancelled: ";
    if (isError) return "Failed: ";
    return "Used: ";
  };

  return (
    <div
      className={cn(
        "aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3",
        isRunning && "border-blue-500/30 bg-blue-500/5",
        isCancelled && "border-muted-foreground/30 bg-muted/30",
        isError && "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
        <StatusIcon />
        <p
          className={cn(
            "aui-tool-fallback-title grow text-sm",
            isCancelled && "text-muted-foreground line-through",
          )}
        >
          {getStatusText()}
          <b>{toolName}</b>
        </p>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDownIcon className="size-4" /> : <ChevronUpIcon className="size-4" />}
        </Button>
      </div>
      {!isCollapsed && (
        <div className="aui-tool-fallback-content flex flex-col gap-2 border-t pt-2">
          {cancelledReason && (
            <div className="aui-tool-fallback-cancelled-root px-4">
              <p className="aui-tool-fallback-cancelled-header font-semibold text-muted-foreground">
                Cancelled reason:
              </p>
              <p className="aui-tool-fallback-cancelled-reason text-muted-foreground">
                {cancelledReason}
              </p>
            </div>
          )}
          <div
            className={cn(
              "aui-tool-fallback-args-root px-4",
              isCancelled && "opacity-60",
            )}
          >
            <pre className="aui-tool-fallback-args-value whitespace-pre-wrap">
              {argsText}
            </pre>
          </div>
          {!isCancelled && !isError && result !== undefined && (
            <BashResult result={result} isBashTool={isBashTool} />
          )}
        </div>
      )}
    </div>
  );
};

interface BashResultProps {
  result: unknown;
  isBashTool: boolean;
}

function BashResult({ result, isBashTool }: BashResultProps) {
  if (isBashTool && typeof result === "object" && result !== null) {
    const bashResult = result as { stdout?: string; stderr?: string; exitCode?: number };
    return (
      <div className="aui-tool-fallback-result-root border-t border-dashed px-4 pt-2 space-y-2">
        {bashResult.stdout && (
          <div>
            <p className="aui-tool-fallback-result-header text-xs font-semibold text-muted-foreground mb-1">
              stdout:
            </p>
            <pre className="aui-tool-fallback-result-content whitespace-pre-wrap text-xs bg-zinc-900 text-green-400 p-2 rounded-md overflow-x-auto font-mono">
              {bashResult.stdout}
            </pre>
          </div>
        )}
        {bashResult.stderr && (
          <div>
            <p className="aui-tool-fallback-result-header text-xs font-semibold text-destructive mb-1">
              stderr:
            </p>
            <pre className="aui-tool-fallback-result-content whitespace-pre-wrap text-xs bg-zinc-900 text-red-400 p-2 rounded-md overflow-x-auto font-mono">
              {bashResult.stderr}
            </pre>
          </div>
        )}
        {bashResult.exitCode !== undefined && bashResult.exitCode !== 0 && (
          <p className="text-xs text-muted-foreground">
            Exit code: <span className="text-destructive font-mono">{bashResult.exitCode}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="aui-tool-fallback-result-root border-t border-dashed px-4 pt-2">
      <p className="aui-tool-fallback-result-header text-xs font-semibold text-muted-foreground mb-1">
        Result:
      </p>
      <pre className="aui-tool-fallback-result-content whitespace-pre-wrap text-xs bg-muted p-2 rounded-md overflow-x-auto">
        {typeof result === "string"
          ? result
          : JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
