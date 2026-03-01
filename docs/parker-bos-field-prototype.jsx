import { useState, useRef } from "react";

// ─── MOCK DATA ───────────────────────────────────────────────
const JOBS = [
  {
    id: "j1",
    jobNumber: "25-003",
    jobName: "Cherry Street Farms",
    gcName: "HHIG Construction",
    projectPhase: "Active",
    siteAddress: "1911 E Cherry Street",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98122",
    estimatorName: "Nate Parker",
    estimatorPhone: "(206) 555-0101",
    projectManagerName: "Sarah Parker",
    projectManagerPhone: "(206) 555-0102",
    siteSupervisorName: "Josh Rossi",
    siteSupervisorPhone: "(206) 555-0103",
    changeOrders: [
      { id: "co1", coNumber: "CO-01", subject: "Additional gas line run - Unit 4B", status: "Approved", createdAt: "2025-02-18" },
      { id: "co2", coNumber: "CO-02", subject: "Reroute waste line around structural beam", status: "Submitted", createdAt: "2025-02-24" },
      { id: "co3", coNumber: "CO-03", subject: "Add hose bibs to courtyard (3x)", status: "Under Review", createdAt: "2025-02-28" },
    ],
    files: [
      { name: "Plumbing Plans Rev 3.pdf", category: "Plans", date: "2025-01-15" },
      { name: "Health Approved Plans.pdf", category: "Health Plans", date: "2025-01-22" },
      { name: "Cherry St Proposal.pdf", category: "Contract/Bid", date: "2024-12-10" },
      { name: "Scope of Work.pdf", category: "Scope", date: "2024-12-10" },
      { name: "Building Permit.pdf", category: "Permits", date: "2025-02-01" },
    ],
  },
  {
    id: "j2",
    jobNumber: "25-001",
    jobName: "81 Vine St",
    gcName: "Chain Construction",
    projectPhase: "Active",
    siteAddress: "81 Vine Street",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98121",
    estimatorName: "Nate Parker",
    estimatorPhone: "(206) 555-0101",
    projectManagerName: "Sarah Parker",
    projectManagerPhone: "(206) 555-0102",
    siteSupervisorName: "Josh Rossi",
    siteSupervisorPhone: "(206) 555-0103",
    changeOrders: [
      { id: "co4", coNumber: "CO-01", subject: "Relocate water heater to mechanical room", status: "Approved", createdAt: "2025-01-30" },
      { id: "co5", coNumber: "CO-02", subject: "Add floor drain in laundry", status: "Approved", createdAt: "2025-02-05" },
    ],
    files: [
      { name: "Vine St Proposal.pdf", category: "Contract/Bid", date: "2024-11-20" },
      { name: "Plumbing Plans Rev 2.pdf", category: "Plans", date: "2025-01-10" },
    ],
  },
  {
    id: "j3",
    jobNumber: "25-005",
    jobName: "Meridian Tower",
    gcName: "Sawhorse Revolution",
    projectPhase: "Awarded",
    siteAddress: "4200 Meridian Ave N",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98103",
    estimatorName: "Nate Parker",
    estimatorPhone: "(206) 555-0101",
    projectManagerName: null,
    projectManagerPhone: null,
    siteSupervisorName: null,
    siteSupervisorPhone: null,
    changeOrders: [],
    files: [
      { name: "Meridian Bid Package.pdf", category: "Contract/Bid", date: "2025-02-20" },
      { name: "Plumbing Plans.pdf", category: "Plans", date: "2025-02-18" },
    ],
  },
  {
    id: "j4",
    jobNumber: "25-002",
    jobName: "Ballard Brewing Expansion",
    gcName: "Rafn Company",
    projectPhase: "Active",
    siteAddress: "1423 NW 51st Street",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98107",
    estimatorName: "Nate Parker",
    estimatorPhone: "(206) 555-0101",
    projectManagerName: "Brittany Barnum",
    projectManagerPhone: "(206) 555-0104",
    siteSupervisorName: "David Berckman",
    siteSupervisorPhone: "(206) 555-0105",
    changeOrders: [
      { id: "co6", coNumber: "CO-01", subject: "Grease interceptor upsized per health dept", status: "Approved", createdAt: "2025-02-10" },
      { id: "co7", coNumber: "CO-02", subject: "Add emergency eyewash station", status: "Draft", createdAt: "2025-03-01" },
    ],
    files: [
      { name: "Ballard Brewing Plans.pdf", category: "Plans", date: "2025-01-05" },
    ],
  },
];

const FORMS = [
  { id: "f1", name: "Change Order", icon: "📋", desc: "Request additional or modified work", active: true },
  { id: "f2", name: "PO Request", icon: "📦", desc: "Request a material purchase order", active: false },
  { id: "f3", name: "Inspection Request", icon: "🔍", desc: "Request a plumbing or health inspection", active: false },
  { id: "f4", name: "Daily Report", icon: "📝", desc: "End-of-day field report and notes", active: false },
  { id: "f5", name: "Accident / Incident", icon: "🚨", desc: "Report a jobsite safety incident", active: false },
  { id: "f6", name: "Time Off Request", icon: "🗓️", desc: "Submit PTO or time off", active: false },
  { id: "f7", name: "Material Receipt", icon: "🧾", desc: "Log received materials on site", active: false },
];

// ─── THEME ───────────────────────────────────────────────────
const t = {
  bg: "#0F1117",
  surface: "#1A1D27",
  surfaceAlt: "#222633",
  border: "#2A2E3B",
  accent: "#3B82F6",
  accentSoft: "rgba(59,130,246,0.12)",
  green: "#22C55E",
  greenSoft: "rgba(34,197,94,0.12)",
  yellow: "#EAB308",
  yellowSoft: "rgba(234,179,8,0.12)",
  red: "#EF4444",
  redSoft: "rgba(239,68,68,0.12)",
  orange: "#F97316",
  orangeSoft: "rgba(249,115,22,0.12)",
  text: "#F1F3F7",
  textMuted: "#8B90A0",
  textDim: "#585D6E",
};

// ─── UTILITY COMPONENTS ──────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    Active: { bg: t.greenSoft, color: t.green, dot: t.green },
    Awarded: { bg: t.accentSoft, color: t.accent, dot: t.accent },
    Approved: { bg: t.greenSoft, color: t.green },
    Submitted: { bg: t.yellowSoft, color: t.yellow },
    "Under Review": { bg: t.orangeSoft, color: t.orange },
    Draft: { bg: `${t.textDim}22`, color: t.textMuted },
    Rejected: { bg: t.redSoft, color: t.red },
  };
  const s = map[status] || map.Draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color, letterSpacing: 0.3,
    }}>
      {s.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />}
      {status}
    </span>
  );
}

function PhoneButton({ name, phone, role }) {
  if (!name) return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
      borderBottom: `1px solid ${t.border}`, opacity: 0.4,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: t.surfaceAlt,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: t.textDim,
      }}>—</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: t.textDim, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{role}</div>
        <div style={{ fontSize: 14, color: t.textMuted }}>Not assigned</div>
      </div>
    </div>
  );
  const initials = name.split(" ").map(n => n[0]).join("");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
      borderBottom: `1px solid ${t.border}`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: t.accentSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: t.accent,
      }}>{initials}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: t.textDim, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{role}</div>
        <div style={{ fontSize: 15, color: t.text, fontWeight: 500 }}>{name}</div>
      </div>
      <a href={`tel:${phone}`} onClick={(e) => e.preventDefault()} style={{
        width: 44, height: 44, borderRadius: 12, background: t.greenSoft,
        display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
        </svg>
      </a>
    </div>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: t.surface, borderRadius: 16, padding: 20,
      border: `1px solid ${t.border}`,
      ...(onClick ? { cursor: "pointer" } : {}),
      ...style,
    }}>{children}</div>
  );
}

function CardHeader({ icon, title, count, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.text, letterSpacing: 0.3 }}>{title}</span>
        {count !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: t.accent,
            background: t.accentSoft, padding: "2px 8px", borderRadius: 10,
          }}>{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── FAB (FLOATING ACTION BUTTON) ────────────────────────────

function FAB({ isOpen, onToggle, onSelectForm, currentJob }) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 200, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* Form Menu */}
      {isOpen && (
        <div style={{
          position: "fixed", bottom: 90, right: 20, zIndex: 210,
          background: t.surface, borderRadius: 20, padding: "8px",
          border: `1px solid ${t.border}`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          width: 280, maxHeight: "60vh", overflowY: "auto",
        }}>
          {currentJob && (
            <div style={{
              padding: "10px 14px", marginBottom: 4,
              background: t.accentSoft, borderRadius: 14,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>FOR JOB</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{currentJob.jobNumber} · {currentJob.jobName}</div>
            </div>
          )}
          {!currentJob && (
            <div style={{
              padding: "10px 14px", marginBottom: 4,
              background: t.surfaceAlt, borderRadius: 14,
            }}>
              <div style={{ fontSize: 12, color: t.textMuted }}>You'll pick a job on the next step</div>
            </div>
          )}
          {FORMS.map(form => (
            <div
              key={form.id}
              onClick={() => onSelectForm(form)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 14, cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = t.surfaceAlt}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: t.accentSoft,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>{form.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{form.name}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{form.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB Button */}
      <div
        onClick={onToggle}
        style={{
          position: "fixed", bottom: 78, right: 20, zIndex: 220,
          width: 56, height: 56, borderRadius: 16,
          background: isOpen ? t.red : t.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: `0 8px 24px ${isOpen ? "rgba(239,68,68,0.4)" : "rgba(59,130,246,0.4)"}`,
          transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
          transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    </>
  );
}

// ─── JOB PICKER MODAL (when no job context) ──────────────────

function JobPickerModal({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const filtered = JOBS.filter(j =>
    j.jobName.toLowerCase().includes(search.toLowerCase()) ||
    j.jobNumber.includes(search) ||
    j.gcName.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: t.bg, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430,
        maxHeight: "80vh", padding: "20px 16px", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Select Job</div>
          <button onClick={onClose} style={{
            background: t.surfaceAlt, border: "none", borderRadius: 10,
            width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: t.textMuted, fontSize: 16,
          }}>✕</button>
        </div>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textDim} strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            autoFocus
            style={{
              width: "100%", padding: "12px 12px 12px 40px", borderRadius: 12,
              border: `1px solid ${t.border}`, background: t.surface,
              color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.map(job => (
            <div key={job.id} onClick={() => onSelect(job)} style={{
              padding: "14px 16px", borderRadius: 14, marginBottom: 6,
              background: t.surface, border: `1px solid ${t.border}`, cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, fontFamily: "monospace" }}>{job.jobNumber}</span>
                <StatusBadge status={job.projectPhase} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{job.jobName}</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>{job.gcName}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SCREENS ─────────────────────────────────────────────────

function JobListScreen({ onSelectJob }) {
  const [search, setSearch] = useState("");
  const filte