interface Props {
  status: string;
  size?: "sm" | "md";
}

// Matches prototype theme colors exactly
const STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Active:         { bg: "bg-[rgba(34,197,94,0.12)]",  text: "text-[#22C55E]",  dot: "bg-[#22C55E]" },
  Install:        { bg: "bg-[rgba(34,197,94,0.12)]",  text: "text-[#22C55E]",  dot: "bg-[#22C55E]" },
  Awarded:        { bg: "bg-[rgba(59,130,246,0.12)]", text: "text-[#3B82F6]",  dot: "bg-[#3B82F6]" },
  Approved:       { bg: "bg-[rgba(34,197,94,0.12)]",  text: "text-[#22C55E]",  dot: "" },
  Submitted:      { bg: "bg-[rgba(234,179,8,0.12)]",  text: "text-[#EAB308]",  dot: "" },
  "Under Review": { bg: "bg-[rgba(249,115,22,0.12)]", text: "text-[#F97316]",  dot: "" },
  Draft:          { bg: "bg-[rgba(88,93,110,0.18)]",  text: "text-[#8B90A0]",  dot: "" },
  Rejected:       { bg: "bg-[rgba(239,68,68,0.12)]",  text: "text-[#EF4444]",  dot: "" },
  Warranty:       { bg: "bg-[rgba(139,90,200,0.12)]", text: "text-[#A78BFA]",  dot: "" },
  Closed:         { bg: "bg-[rgba(88,93,110,0.18)]",  text: "text-[#8B90A0]",  dot: "" },
};

export default function StatusBadge({ status, size = "md" }: Props) {
  const s = STYLES[status] ?? STYLES.Draft;
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${padding} ${s.bg} ${s.text}`}
    >
      {s.dot && <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />}
      {status}
    </span>
  );
}
