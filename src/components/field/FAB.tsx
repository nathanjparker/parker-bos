"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldContext } from "@/lib/fieldContext";
import JobPickerModal from "@/components/field/JobPickerModal";
import type { Job } from "@/types/jobs";

const FORMS = [
  { id: "change-order",    name: "Change Order",        icon: "📋", desc: "Request additional or modified work" },
  { id: "po-request",      name: "PO Request",          icon: "📦", desc: "Request a material purchase order" },
  { id: "inspection",      name: "Inspection Request",  icon: "🔍", desc: "Request an inspection" },
  { id: "daily-report",    name: "Daily Report",        icon: "📝", desc: "End-of-day field report" },
  { id: "accident",        name: "Accident / Incident", icon: "🚨", desc: "Report a jobsite safety incident" },
  { id: "time-off",        name: "Time Off Request",    icon: "🗓️", desc: "Submit PTO or time off" },
  { id: "material-receipt",name: "Material Receipt",    icon: "🧾", desc: "Log received materials on site" },
];

export default function FAB() {
  const router = useRouter();
  const { currentJob } = useFieldContext();
  const [open, setOpen] = useState(false);
  const [pendingFormId, setPendingFormId] = useState<string | null>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);

  function handleFormSelect(formId: string) {
    if (currentJob) {
      navigate(formId, currentJob.id);
    } else {
      setPendingFormId(formId);
      setOpen(false);
      setShowJobPicker(true);
    }
  }

  function handleJobPicked(job: Job) {
    setShowJobPicker(false);
    if (pendingFormId) {
      navigate(pendingFormId, job.id);
      setPendingFormId(null);
    }
  }

  function navigate(formId: string, jobId: string) {
    setOpen(false);
    if (formId === "change-order") {
      router.push(`/field/forms/change-order/${jobId}`);
    } else {
      router.push(`/field/forms/generic/${formId}/${jobId}`);
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        />
      )}

      {/* Form menu */}
      {open && (
        <div
          className="fixed z-50 rounded-2xl border border-[#2A2E3B] bg-[#1A1D27] p-2 shadow-2xl"
          style={{ bottom: 96, right: 20, width: 280, maxHeight: "60vh", overflowY: "auto" }}
        >
          {/* Job context header */}
          {currentJob ? (
            <div className="mb-1 rounded-xl bg-[rgba(59,130,246,0.12)] px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#3B82F6]">
                For Job
              </div>
              <div className="mt-0.5 text-sm font-bold text-[#F1F3F7]">
                {currentJob.jobNumber && `${currentJob.jobNumber} · `}
                {currentJob.jobName}
              </div>
            </div>
          ) : (
            <div className="mb-1 rounded-xl bg-[#222633] px-3.5 py-2.5">
              <div className="text-xs text-[#8B90A0]">
                You&apos;ll pick a job on the next step
              </div>
            </div>
          )}

          {/* Form options */}
          {FORMS.map((form) => (
            <button
              key={form.id}
              type="button"
              onClick={() => handleFormSelect(form.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-[#222633]"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.12)] text-lg">
                {form.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#F1F3F7]">
                  {form.name}
                </div>
                <div className="text-[11px] text-[#8B90A0]">{form.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed z-50 flex items-center justify-center rounded-2xl shadow-lg transition-all duration-200"
        style={{
          bottom: 80,
          right: 20,
          width: 52,
          height: 52,
          background: open ? "#EF4444" : "#3B82F6",
          boxShadow: open
            ? "0 8px 24px rgba(239,68,68,0.4)"
            : "0 8px 24px rgba(59,130,246,0.4)",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}
        aria-label={open ? "Close form menu" : "Open form menu"}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Job picker modal */}
      {showJobPicker && (
        <JobPickerModal
          onSelect={handleJobPicked}
          onClose={() => {
            setShowJobPicker(false);
            setPendingFormId(null);
          }}
        />
      )}
    </>
  );
}
