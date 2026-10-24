import type { ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, LoaderCircle } from "lucide-react";

export default function WorkspaceFeedback({
  tone = "info",
  title,
  children,
  busy = false,
  progress,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title: string;
  children?: ReactNode;
  busy?: boolean;
  progress?: number;
}) {
  const Icon = busy
    ? LoaderCircle
    : tone === "success"
      ? CheckCircle
      : tone === "error" || tone === "warning"
        ? AlertCircle
        : Info;
  return (
    <div
      className={`workspace-feedback feedback-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      <Icon
        size={20}
        aria-hidden="true"
        className={busy ? "spin" : undefined}
      />
      <div>
        <strong>{title}</strong>
        {children}
        {progress !== undefined && (
          <progress
            aria-label={title}
            max={100}
            value={Math.max(0, Math.min(100, progress))}
          />
        )}
      </div>
    </div>
  );
}

export function MenuSteps({ added }: { added: boolean }) {
  return (
    <ol className="menu-steps" aria-label="How to use your menu">
      {["Add menu", "Review dishes", "Find dinnerware"].map((label, index) => (
        <li
          key={label}
          className={index === (added ? 1 : 0) ? "current" : undefined}
          aria-current={index === (added ? 1 : 0) ? "step" : undefined}
        >
          <span aria-hidden="true">{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
