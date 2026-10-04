import { FlaskConical } from "lucide-react";
import { isMock } from "@/lib/api/a8";

/** Shown on screens whose backend routes are not built yet: the data is a sample kept in this browser. */
export default function MockBanner({ what }: { what: string }) {
  if (!isMock) return null;
  return (
    <p role="note" className="flex items-start gap-2 rounded-xl border border-warning bg-warning-tint p-3 text-sm">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        <strong>Sample data.</strong> The server does not have {what} yet, so this screen works on example records kept in this browser. Nothing here reaches students. The routes it needs are listed in <span className="font-mono">docs/BACKEND_NEEDS.md</span>.
      </span>
    </p>
  );
}
