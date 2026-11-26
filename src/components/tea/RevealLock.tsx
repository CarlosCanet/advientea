import { cn } from "cn";
import { Lock } from "lucide-react";

interface RevealLockProps {
  className?: string;
  detail?: string;
  label: React.ReactNode;
}

/** Something the calendar has not revealed yet, and when it will. */
export default function RevealLock({ className, detail, label }: RevealLockProps) {
  return (
    <div className={cn("flex items-start gap-2.5 text-muted-foreground", className)}>
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {detail && <span className="text-sm">{detail}</span>}
      </div>
    </div>
  );
}
