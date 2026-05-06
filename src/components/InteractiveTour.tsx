import { useState, useEffect, useRef } from "react";
import { ArrowRight, ArrowLeft, X, Sparkles, Check, MessageSquare, Calendar, BookOpen, ClipboardList, Trophy, Cloud, LayoutDashboard } from "lucide-react";
import type { Page } from "../types";

export type TourStep = {
  page: Page;
  title: string;
  description: string;
  highlights: { selector: string; text: string; position?: "top" | "bottom" | "left" | "right" }[];
  action?: { label: string; hint: string };
  icon?: React.ReactNode;
};

type InteractiveTourProps = {
  currentStep: number;
  totalSteps: number;
  step: TourStep;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
};

export function InteractiveTourOverlay({ currentStep, totalSteps, step, onNext, onBack, onFinish }: InteractiveTourProps) {
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [highlightRects, setHighlightRects] = useState<DOMRect[]>([]);
  const [actionCompleted, setActionCompleted] = useState(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHighlightIndex(0);
    setActionCompleted(false);
    setHighlightRects([]);
  }, [currentStep]);

  useEffect(() => {
    const highlight = step.highlights[highlightIndex];
    if (!highlight) {
      setHighlightRects([]);
      return;
    }

    function findElement() {
      const el = document.querySelector(highlight.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setHighlightRects([rect]);
          return true;
        }
      }
      return false;
    }

    if (findElement()) return;

    let attempts = 0;
    const maxAttempts = 10;
    function retry() {
      attempts++;
      if (attempts > maxAttempts) {
        setHighlightRects([]);
        return;
      }
      if (!findElement()) {
        retryRef.current = setTimeout(retry, 100 * attempts);
      }
    }
    retryRef.current = setTimeout(retry, 100);

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [highlightIndex, step, currentStep]);

  const currentHighlight = step.highlights[highlightIndex];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <>
      {/* Dark overlay */}
      <div className="tour-overlay" />

      {/* Highlight boxes */}
      {highlightRects.map((rect, i) => (
        <div
          key={i}
          className="tour-highlight"
          style={{
            position: "fixed",
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: 12,
            border: "2px solid var(--accent)",
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 24px rgba(var(--accent-rgb, 99, 102, 241), 0.3)",
            zIndex: 10000,
            pointerEvents: "none",
            animation: "tour-highlight-pulse 2s ease-in-out infinite",
          }}
        />
      ))}

      {/* Tour guide panel */}
      <div className="tour-guide-panel">
        {/* Header with progress */}
        <div className="tour-guide-header">
          <div className="tour-guide-progress">
            <div className="tour-guide-progress-bar">
              <div className="tour-guide-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="tour-guide-step-count">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <button className="tour-guide-close" onClick={onFinish} title="End tour">
            <X size={16} />
          </button>
        </div>

        <div className="tour-guide-body">
          {/* Step title with icon */}
          <div className="tour-guide-title">
            {step.icon || <Sparkles size={18} />}
            <h3>{step.title}</h3>
          </div>
          <p className="tour-guide-desc">{step.description}</p>

          {/* Highlight navigation */}
          {step.highlights.length > 0 && (
            <div className="tour-guide-highlights">
              <div className="tour-guide-highlight-dots">
                {step.highlights.map((h, i) => (
                  <button
                    key={i}
                    className={`tour-guide-highlight-dot ${i === highlightIndex ? "active" : i < highlightIndex ? "done" : ""}`}
                    onClick={() => setHighlightIndex(i)}
                    title={h.text}
                  >
                    {i < highlightIndex ? <Check size={10} /> : i + 1}
                  </button>
                ))}
              </div>
              {currentHighlight && (
                <div className="tour-guide-highlight-text">
                  {currentHighlight.text}
                </div>
              )}
              {highlightRects.length === 0 && step.highlights.length > 0 && (
                <div className="tour-guide-highlight-text" style={{ borderLeftColor: "var(--muted)", opacity: 0.6 }}>
                  Element not visible on current view
                </div>
              )}
            </div>
          )}

          {/* Action prompt */}
          {step.action && !actionCompleted && (
            <div className="tour-guide-action">
              <div className="tour-guide-action-icon"><Sparkles size={14} /></div>
              <div>
                <strong>{step.action.label}</strong>
                <span className="muted">{step.action.hint}</span>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => setActionCompleted(true)}>
                Done
              </button>
            </div>
          )}
          {step.action && actionCompleted && (
            <div className="tour-guide-action tour-guide-action-done">
              <Check size={14} className="tour-guide-action-check" />
              <span>Nice work!</span>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="tour-guide-footer">
          {currentStep > 0 && (
            <button className="btn" onClick={onBack}>
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {highlightIndex < step.highlights.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setHighlightIndex(i => i + 1)}>
              Next <ArrowRight size={14} />
            </button>
          ) : currentStep < totalSteps - 1 ? (
            <button className="btn btn-primary" onClick={onNext}>
              Next page <ArrowRight size={14} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onFinish}>
              Finish tour <Check size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
