import { useState, useMemo, memo, useCallback } from "react";
import { GraduationCap, CheckSquare, Calendar as CalendarIcon, Trash2, Upload, Paperclip, X, Plus, Search, ArrowUpDown, X as XIcon } from "lucide-react";
import type { Subject, ExamRecord, ExamKind, ExamStatus, AcademicOption, MoodleFile } from "../types";
import { examKindLabels, toIsoDate, isDateInRange, moodleFileKey, localAssetHref } from "../lib/utils";
import { openMoodleFile } from "../lib/api";

function hexToRgba(hex: string, alpha: number): string {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const chartColors = ["#4f46e5", "#f59e0b", "#dc2626", "#16a34a", "#06b6d4", "#ec4899", "#8b5cf6", "#f97316"];

export function ExamsPage({
  subjects, exams, activeSubject, activeSubjectId, setActiveSubjectId, activeExams, selectedCalendar,
  addExam, updateExam, toggleExamFile, deleteExam, uploadExamFiles, removeExamAttachment, moodleFiles,
}: {
  subjects: Subject[];
  exams: ExamRecord[];
  activeSubject?: Subject;
  activeSubjectId: string;
  setActiveSubjectId: (id: string) => void;
  activeExams: ExamRecord[];
  selectedCalendar: AcademicOption;
  addExam: (input: { title: string; subjectId: string; kind: ExamKind; date: string; weight: number; score: number; maxScore: number; notes: string; relatedFileIds: string[] }) => void;
  updateExam: (id: string, patch: Partial<ExamRecord>) => void;
  toggleExamFile: (id: string, fileId: string) => void;
  deleteExam: (id: string) => void;
  uploadExamFiles: (id: string, files: FileList | null) => Promise<void>;
  removeExamAttachment: (id: string, attachmentId: string) => void;
  moodleFiles: MoodleFile[];
}) {
  const defaultSubjectId = activeSubjectId || activeSubject?.id || subjects[0]?.id || "";
  const [target, setTarget] = useState(80);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    subjectId: defaultSubjectId,
    kind: "quiz" as ExamKind,
    date: toIsoDate(new Date()),
    weight: 10,
    score: 0,
    maxScore: 100,
    notes: "",
    status: "not-started" as ExamStatus,
    relatedFileIds: [] as string[],
  });

  if (!subjects.length) {
    return (
      <div className="card">
        <div className="empty">No subjects yet. Import a timetable in Settings or pick from Moodle first.</div>
      </div>
    );
  }

  const semesterExams = activeExams
    .filter((exam) => isDateInRange(exam.date, selectedCalendar.startDate, selectedCalendar.endDate))
    .sort((a, b) => a.date.localeCompare(b.date));
  const completedWeight = semesterExams.reduce((sum, exam) => sum + (exam.weight ?? 0), 0);
  const weightedScore = semesterExams.reduce((sum, exam) => {
    const percent = exam.maxScore > 0 ? exam.score / exam.maxScore : 0;
    return sum + percent * (exam.weight ?? 0);
  }, 0);
  const currentAverage = completedWeight > 0 ? (weightedScore / completedWeight) * 100 : 0;
  const remainingWeight = Math.max(0, 100 - completedWeight);
  const neededFinal = remainingWeight > 0 ? ((target - weightedScore) / remainingWeight) * 100 : 0;

  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<ExamKind | "all">("all");
  const [sortField, setSortField] = useState<"date" | "weight" | "score">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const displayedExams = useMemo(() => {
    let list = semesterExams;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q) || (e.notes ?? "").toLowerCase().includes(q));
    }
    if (kindFilter !== "all") list = list.filter((e) => e.kind === kindFilter);
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "weight": cmp = (a.weight ?? 0) - (b.weight ?? 0); break;
        case "score": {
          const aPct = a.maxScore > 0 ? a.score / a.maxScore : 0;
          const bPct = b.maxScore > 0 ? b.score / b.maxScore : 0;
          cmp = aPct - bPct; break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [semesterExams, searchQuery, kindFilter, sortField, sortDir]);

  // Chart data
  const kindBreakdown = useMemo(() => {
    const map = new Map<ExamKind, number>();
    for (const e of semesterExams) map.set(e.kind, (map.get(e.kind) ?? 0) + (e.weight ?? 0));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [semesterExams]);

  const scoreTrend = useMemo(() => {
    return semesterExams
      .filter((e) => e.maxScore > 0)
      .map((e) => ({
        label: e.title.length > 12 ? e.title.slice(0, 12) + "…" : e.title,
        score: Math.round((e.score / e.maxScore) * 100),
        date: e.date,
        color: subjects.find((s) => s.id === e.subjectId)?.color ?? "#888",
      }));
  }, [semesterExams, subjects]);

  const maxBarWidth = useMemo(() => {
    const vals = semesterExams.map((e) => e.maxScore > 0 ? Math.round((e.score / e.maxScore) * 100) : 0);
    return Math.max(100, ...vals);
  }, [semesterExams]);

  function openModal() {
    setDraft({
      title: "", subjectId: activeSubjectId || defaultSubjectId, kind: "quiz",
      date: toIsoDate(new Date()), weight: 10, score: 0, maxScore: 100,
      notes: "", status: "not-started", relatedFileIds: [],
    });
    setModalOpen(true);
  }

  return (
    <div className="exams-page">
      {/* Analytics cards */}
      <div className="card exam-analytics">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{activeSubject?.code ?? "Subject"} analytics</h2>
            <span className="tag" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CalendarIcon size={12} /> {selectedCalendar.semester}
            </span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <select className="select" value={activeSubjectId || defaultSubjectId} onChange={(e) => setActiveSubjectId(e.target.value)} style={{ fontSize: "0.82rem" }}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
            <button className="btn btn-primary" onClick={openModal}>
              <Plus size={14} /> Add exam
            </button>
          </div>
        </div>
        <div className="analytics-grid">
          <Metric icon={<GraduationCap size={14} />} label="Weighted score" value={`${weightedScore.toFixed(1)}%`} />
          <Metric icon={<CheckSquare size={14} />} label="Average" value={`${currentAverage.toFixed(1)}%`} />
          <Metric icon={<CalendarIcon size={14} />} label="Completed" value={`${completedWeight}%`} suffix="of 100%" />
          <div className="metric target-metric">
            <div className="metric-label"><span>Needed for {target}%</span></div>
            <div className="metric-value">{remainingWeight ? `${Math.max(0, neededFinal).toFixed(1)}%` : "Done"}</div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <span className="muted" style={{ fontSize: "0.76rem" }}>Target</span>
              <input className="input" type="number" min={0} max={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} style={{ width: 56, height: 26, padding: "2px 6px", fontSize: "0.78rem" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      {semesterExams.length > 0 && (
        <div className="exam-charts">
          {/* Score trend */}
          {scoreTrend.length >= 2 && (
            <div className="chart-card">
              <h3>Score trend</h3>
              <svg className="chart-line-svg" viewBox={`0 0 400 120`} preserveAspectRatio="none">
                {(() => {
                  const points = scoreTrend.map((p, i) => {
                    const x = scoreTrend.length === 1 ? 200 : (i / (scoreTrend.length - 1)) * 380 + 10;
                    const y = 110 - (p.score / 100) * 100;
                    return { x, y, ...p };
                  });
                  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                  return (
                    <>
                      <polyline points={points.map((p) => `${p.x},110`).join(" ")} fill="rgba(79,70,229,0.08)" stroke="none"
                        transform={`translate(0,0)`}
                        style={{ clipPath: `polygon(0 0, 400 0, 400 110, ${points.map((p) => `${p.x},${p.y}`).join(", ")})` }} />
                      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="4" fill="var(--panel)" stroke="var(--accent)" strokeWidth="2" />
                          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fill="var(--muted)">{p.score}%</text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          )}

          {/* Weight distribution by kind */}
          {kindBreakdown.length > 1 && (
            <div className="chart-card">
              <h3>Weight by type</h3>
              <div className="chart-donut-wrap">
                <svg className="chart-donut-svg" viewBox="0 0 140 140">
                  {(() => {
                    const total = kindBreakdown.reduce((s, [, w]) => s + w, 0);
                    let angle = -90;
                    const slices = kindBreakdown.map(([kind, weight], i) => {
                      const pct = total > 0 ? weight / total : 0;
                      const sweep = pct * 360;
                      const start = angle;
                      angle += sweep;
                      return { kind, weight, pct, start, sweep, color: chartColors[i % chartColors.length] };
                    });
                    return slices.map((s) => {
                      const r = 50;
                      const cx = 70, cy = 70;
                      const startRad = (s.start * Math.PI) / 180;
                      const endRad = ((s.start + s.sweep) * Math.PI) / 180;
                      const x1 = cx + r * Math.cos(startRad);
                      const y1 = cy + r * Math.sin(startRad);
                      const x2 = cx + r * Math.cos(endRad);
                      const y2 = cy + r * Math.sin(endRad);
                      const large = s.sweep > 180 ? 1 : 0;
                      return (
                        <g key={s.kind}>
                          <path
                            d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`}
                            fill={s.color}
                            stroke="var(--panel)"
                            strokeWidth="2"
                          />
                        </g>
                      );
                    });
                  })()}
                  <circle cx="70" cy="70" r="30" fill="var(--panel)" />
                  <text x="70" y="66" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text)">
                    {kindBreakdown.length}
                  </text>
                  <text x="70" y="82" textAnchor="middle" fontSize="9" fill="var(--muted)">types</text>
                </svg>
                <div className="chart-donut-legend">
                  {kindBreakdown.map(([kind, weight], i) => (
                    <div key={kind} className="chart-donut-legend-item">
                      <span className="chart-donut-legend-dot" style={{ background: chartColors[i % chartColors.length] }} />
                      <span>{examKindLabels[kind]} ({weight}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Target progress */}
          <div className="chart-card">
            <h3>Target progress</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <svg className="chart-donut-svg" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="50" fill="none" stroke="var(--surface)" strokeWidth="10" />
                {(() => {
                  const pct = Math.min(100, completedWeight);
                  const angle = (pct / 100) * 360;
                  const startRad = (-90 * Math.PI) / 180;
                  const endRad = ((-90 + angle) * Math.PI) / 180;
                  const x1 = 70 + 50 * Math.cos(startRad);
                  const y1 = 70 + 50 * Math.sin(startRad);
                  const x2 = 70 + 50 * Math.cos(endRad);
                  const y2 = 70 + 50 * Math.sin(endRad);
                  const large = angle > 180 ? 1 : 0;
                  const color = currentAverage >= target ? "var(--success)" : "var(--accent)";
                  return (
                    <path
                      d={`M${x1},${y1} A50,50 0 ${large},1 ${x2},${y2}`}
                      fill="none"
                      stroke={color}
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                  );
                })()}
                <text x="70" y="66" textAnchor="middle" fontSize="14" fontWeight="700" fill={currentAverage >= target ? "var(--success)" : "var(--text)"}>
                  {Math.min(100, Math.round(currentAverage))}%
                </text>
                <text x="70" y="82" textAnchor="middle" fontSize="9" fill="var(--muted)">of target</text>
              </svg>
              <div>
                <div style={{ fontSize: "0.86rem", fontWeight: 500 }}>Current: {currentAverage.toFixed(1)}%</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 500, color: "var(--muted)" }}>Target: {target}%</div>
                {remainingWeight > 0 && (
                  <div style={{ fontSize: "0.78rem", color: neededFinal > 100 ? "var(--danger)" : "var(--muted)", marginTop: 4 }}>
                    Need {neededFinal.toFixed(1)}% on remaining {remainingWeight}%
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Score bars */}
      {semesterExams.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>Exam scores</h3>
          {semesterExams.map((e, i) => {
            const pct = e.maxScore > 0 ? Math.round((e.score / e.maxScore) * 100) : 0;
            const width = Math.max(2, (pct / maxBarWidth) * 100);
            const color = pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--accent)" : "var(--danger)";
            return (
              <div key={e.id} className="chart-bar">
                <span className="chart-bar-label" title={e.title}>{e.title}</span>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${width}%`, background: color }} />
                </div>
                <span className="chart-bar-value">{e.score}/{e.maxScore} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter toolbar */}
      <div className="card" style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="row" style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 8, color: "var(--muted)", pointerEvents: "none" }} />
            <input className="input" style={{ paddingLeft: 28, minWidth: 160 }} placeholder="Search exams…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button className="btn btn-ghost" style={{ position: "absolute", right: 2, padding: 4 }} onClick={() => setSearchQuery("")}><X size={12} /></button>}
          </div>
          <select className="select" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as ExamKind | "all")}>
            <option value="all">All types</option>
            {(Object.keys(examKindLabels) as ExamKind[]).map((k) => <option key={k} value={k}>{examKindLabels[k]}</option>)}
          </select>
          <div className="row" style={{ gap: 4 }}>
            <select className="select" value={sortField} onChange={(e) => setSortField(e.target.value as "date" | "weight" | "score")}>
              <option value="date">Date</option>
              <option value="weight">Weight</option>
              <option value="score">Score %</option>
            </select>
            <button className="btn" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")} title={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`}>
              <ArrowUpDown size={13} />
            </button>
          </div>
        </div>
        <div className="muted" style={{ fontSize: "0.78rem" }}>{displayedExams.length} exam{displayedExams.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Exam list */}
      <div className="exam-list clean">
        {displayedExams.map((exam) => (
          <ExamCard
            key={exam.id}
            exam={exam}
            moodleFiles={moodleFiles}
            updateExam={updateExam}
            toggleExamFile={toggleExamFile}
            deleteExam={deleteExam}
            uploadExamFiles={uploadExamFiles}
            removeExamAttachment={removeExamAttachment}
          />
        ))}
        {!displayedExams.length && (searchQuery || kindFilter !== "all"
          ? <div className="empty">No exams match these filters.</div>
          : !semesterExams.length
            ? <div className="empty">
                <p>No exams yet</p>
                <p className="muted" style={{ fontSize: "0.84rem", marginTop: 8 }}>Add your first exam to start tracking your progress.</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openModal}>Add exam</button>
              </div>
            : <div className="empty">No exams or quizzes yet.</div>
        )}
      </div>

      {/* Add exam modal */}
      {modalOpen && (
        <div className="exam-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="exam-modal">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Add exam</h2>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}><XIcon size={16} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addExam(draft); setModalOpen(false); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="exam-field">
                <label>Title</label>
                <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Quiz, midterm, exam…" autoFocus />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="exam-field">
                  <label>Subject</label>
                  <select className="select" value={draft.subjectId} onChange={(e) => setDraft({ ...draft, subjectId: e.target.value })}>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                  </select>
                </div>
                <div className="exam-field">
                  <label>Type</label>
                  <select className="select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ExamKind })}>
                    {(Object.keys(examKindLabels) as ExamKind[]).map((k) => <option key={k} value={k}>{examKindLabels[k]}</option>)}
                  </select>
                </div>
              </div>
              <div className="exam-field">
                <label>Date</label>
                <input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div className="exam-field">
                  <label>Weight (%)</label>
                  <input className="input" type="number" min={0} max={100} value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} />
                </div>
                <div className="exam-field">
                  <label>Score</label>
                  <input className="input" type="number" min={0} value={draft.score} onChange={(e) => setDraft({ ...draft, score: Number(e.target.value) })} />
                </div>
                <div className="exam-field">
                  <label>Max Score</label>
                  <input className="input" type="number" min={1} value={draft.maxScore} onChange={(e) => setDraft({ ...draft, maxScore: Number(e.target.value) })} />
                </div>
              </div>
              <div className="exam-field">
                <label>Status</label>
                <select className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ExamStatus })}>
                  <option value="not-started">Not started</option>
                  <option value="not-completed">Not completed</option>
                  <option value="completed">Completed</option>
                  <option value="released">Released</option>
                </select>
              </div>
              <div className="exam-field">
                <label>Notes</label>
                <textarea className="textarea" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Topics, corrections, reflection" />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!draft.title.trim() || !draft.subjectId}>Add exam</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{icon}<span>{label}</span></div>
      <div className="metric-value">{value}</div>
      {suffix && <div className="muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>{suffix}</div>}
    </div>
  );
}

const ExamCard = memo(function ExamCard({
  exam, moodleFiles, updateExam, toggleExamFile, deleteExam, uploadExamFiles, removeExamAttachment,
}: {
  exam: ExamRecord;
  moodleFiles: MoodleFile[];
  updateExam: (id: string, patch: Partial<ExamRecord>) => void;
  toggleExamFile: (id: string, fileId: string) => void;
  deleteExam: (id: string) => void;
  uploadExamFiles: (id: string, files: FileList | null) => Promise<void>;
  removeExamAttachment: (id: string, attachmentId: string) => void;
}) {
  const related = new Set(exam.relatedFileIds ?? []);
  const percent = exam.maxScore > 0 ? Math.round((exam.score / exam.maxScore) * 100) : 0;

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateExam(exam.id, { title: e.target.value });
  }, [updateExam, exam.id]);
  const handleKindChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateExam(exam.id, { kind: e.target.value as ExamKind });
  }, [updateExam, exam.id]);
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateExam(exam.id, { date: e.target.value });
  }, [updateExam, exam.id]);
  const handleWeightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateExam(exam.id, { weight: Number(e.target.value) });
  }, [updateExam, exam.id]);
  const handleScoreChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateExam(exam.id, { score: Number(e.target.value) });
  }, [updateExam, exam.id]);
  const handleMaxScoreChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateExam(exam.id, { maxScore: Number(e.target.value) });
  }, [updateExam, exam.id]);
  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateExam(exam.id, { notes: e.target.value });
  }, [updateExam, exam.id]);
  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateExam(exam.id, { status: e.target.value as ExamRecord["status"] });
  }, [updateExam, exam.id]);
  const handleDelete = useCallback(() => { deleteExam(exam.id); }, [deleteExam, exam.id]);
  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    removeExamAttachment(exam.id, attachmentId);
  }, [removeExamAttachment, exam.id]);

  return (
    <div className="exam-row">
      <div className="exam-main">
        <div className="exam-edit-row">
          <input className="title-input" value={exam.title} onChange={handleTitleChange} aria-label="Exam title" />
          <span className="tag" style={{ background: percent >= 80 ? "var(--success)" : percent >= 50 ? undefined : "var(--danger)", color: percent >= 80 || percent < 50 ? "#fff" : undefined }}>{percent}%</span>
        </div>
        <div className="exam-edit-grid">
          <div className="exam-field">
            <label>Type</label>
            <select className="select" value={exam.kind} onChange={handleKindChange}>
              {(Object.keys(examKindLabels) as ExamKind[]).map((k) => <option key={k} value={k}>{examKindLabels[k]}</option>)}
            </select>
          </div>
          <div className="exam-field">
            <label>Date</label>
            <input className="input" type="date" value={exam.date} onChange={handleDateChange} />
          </div>
          <div className="exam-field">
            <label>Weight (%)</label>
            <input className="input" type="number" min={0} max={100} value={exam.weight ?? 0} onChange={handleWeightChange} />
          </div>
          <div className="exam-field">
            <label>Score</label>
            <input className="input" type="number" min={0} value={exam.score} onChange={handleScoreChange} />
          </div>
          <div className="exam-field">
            <label>Max Score</label>
            <input className="input" type="number" min={1} value={exam.maxScore} onChange={handleMaxScoreChange} />
          </div>
          <div className="exam-field">
            <label>Status</label>
            <select className="select" value={exam.status ?? "not-started"} onChange={handleStatusChange}>
              <option value="not-started">Not started</option>
              <option value="not-completed">Not completed</option>
              <option value="completed">Completed</option>
              <option value="released">Released</option>
            </select>
          </div>
        </div>
        <textarea className="textarea" value={exam.notes} onChange={handleNotesChange} placeholder="Corrections and notes" />
        <MoodleFilePicker files={moodleFiles} selectedIds={related} onToggle={(fileId) => toggleExamFile(exam.id, fileId)} compact />
        <RelatedFileLinks files={moodleFiles} selectedIds={related} />
      </div>
      <div className="exam-files">
        <label className="upload-inline">
          <Upload size={13} /> Upload
          <input type="file" accept="image/*,.pdf,application/pdf" multiple onChange={(e) => { void uploadExamFiles(exam.id, e.target.files); e.currentTarget.value = ""; }} />
        </label>
        {exam.attachments.map((att) => (
          <div key={att.id} className="attachment-row">
            <a href={localAssetHref(att.localUrl)} target="_blank" rel="noreferrer">
              <Paperclip size={12} /> {att.name}
            </a>
            <button className="btn btn-ghost btn-danger" onClick={() => handleRemoveAttachment(att.id)} aria-label="Remove attachment" title="Remove attachment">
              <X size={12} />
            </button>
          </div>
        ))}
        <button className="btn btn-ghost btn-danger" onClick={handleDelete} aria-label="Delete exam" title="Delete exam">
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
});

function MoodleFilePicker({ files, selectedIds, onToggle, compact = false }: { files: MoodleFile[]; selectedIds: Set<string>; onToggle: (fileId: string) => void; compact?: boolean }) {
  if (!files.length) return <div className={`file-picker ${compact ? "compact" : ""}`}><span className="muted">No synced Moodle files</span></div>;
  return (
    <div className={`file-picker ${compact ? "compact" : ""}`}>
      <div className="file-picker-title"><Paperclip size={13} /><span>Related Moodle files</span></div>
      <div className="file-picker-list">
        {files.map((file) => {
          const key = moodleFileKey(file);
          return (
            <label key={key} className="file-check">
              <input type="checkbox" checked={selectedIds.has(key)} onChange={() => onToggle(key)} />
              <span><strong>{file.filename}</strong><small>{file.courseName}{file.section ? ` · ${file.section}` : ""}</small></span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function RelatedFileLinks({ files, selectedIds }: { files: MoodleFile[]; selectedIds: Set<string> }) {
  const related = files.filter((file) => selectedIds.has(moodleFileKey(file)));
  if (!related.length) return null;
  return (
    <div className="related-files">
      {related.map((file) => (
        <a key={moodleFileKey(file)} href={localAssetHref(file.localUrl ?? file.fileurl)} target="_blank" rel="noreferrer" onClick={(e) => openMoodleFile(file, e)}>
          <Paperclip size={12} /> {file.filename}
        </a>
      ))}
    </div>
  );
}
