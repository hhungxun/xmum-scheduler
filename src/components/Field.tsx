import { ReactNode } from "react";

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className="field" style={full ? { gridColumn: "1 / -1" } : undefined}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
