import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Plus, Trash2, Copy, RotateCcw, FileCode, FileText, AlertTriangle,
} from "lucide-react";
import type { Subject, ExamRecord, ExamKind } from "../types";
import {
  parseSubjectFile,
  generateSubjectFileMarkdown,
  type SubjectBasicInfo,
  type CourseChapter,
} from "../lib/subjectFile";
import { toIsoDate } from "../lib/utils";

function progressBarStyle(pct: number): React.CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, pct))}%`,
    height: "100%",
    borderRadius: 999,
    background: pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--accent)" : "var(--danger)",
    transition: "width 0.3s ease",
  };
}

function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface)", overflow: "hidden" }}>
        <div style={progressBarStyle(pct)} />
      </div>
      {label !== undefined && <span style={{ fontSize: "0.72rem", color: "var(--muted)", minWidth: 36, textAlign: "right" }}>{label}</span>}
    </div>
  );
}

type TableContextMenu = {
  open: boolean;
  x: number;
  y: number;
  chapterIdx: number;
};

export function SubjectFileEditor({
  subject,
  markdown,
  exams,
  onChangeMarkdown,
  onAddExam,
  onUpdateExam,
  onDeleteExam,
}: {
  subject: Subject;
  markdown: string;
  exams: ExamRecord[];
  onChangeMarkdown: (markdown: string) => void;
  onAddExam: (input: { title: string; subjectId: string; kind: ExamKind; date: string; weight: number; score: number; maxScore: number; notes: string; relatedFileIds: string[] }) => void;
  onUpdateExam: (id: string, patch: Partial<ExamRecord>) => void;
  onDeleteExam: (id: string) => void;
}) {
  const [editorMode, setEditorMode] = useState<"rich" | "source">("rich");
  const [sourceValue, setSourceValue] = useState("");
  const [ctxMenu, setCtxMenu] = useState<TableContextMenu>({ open: false, x: 0, y: 0, chapterIdx: -1 });
  const tableRef = useRef<HTMLTableElement>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu((p) => ({ ...p, open: false }));
      }
    }
    if (ctxMenu.open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [ctxMenu.open]);

  // Parse the current markdown into structured data
  const parsed = useMemo(() => parseSubjectFile(markdown), [markdown]);
  const [basicInfo, setBasicInfo] = useState<SubjectBasicInfo>(parsed.basicInfo);
  const [chapters, setChapters] = useState<CourseChapter[]>(parsed.chapters);

  // Keep local state in sync when external markdown changes (and we're in rich mode)
  useEffect(() => {
    if (editorMode === "rich") {
      setBasicInfo(parsed.basicInfo);
      setChapters(parsed.chapters);
    }
  }, [parsed.basicInfo, parsed.chapters, editorMode]);

  const subjectExams = useMemo(() => exams.filter((e) => e.subjectId === subject.id), [exams, subject.id]);

  // Regenerate markdown whenever rich-mode structured data changes
  const richMarkdown = useMemo(() => {
    return generateSubjectFileMarkdown(subject, exams, { basicInfo, chapters });
  }, [subject, exams, basicInfo, chapters]);

  const handleSwitchToSource = useCallback(() => {
    setSourceValue(richMarkdown);
    setEditorMode("source");
  }, [richMarkdown]);

  function updateBasicInfo(patch: Partial<SubjectBasicInfo>) {
    const next = { ...basicInfo, ...patch };
    setBasicInfo(next);
    onChangeMarkdown(generateSubjectFileMarkdown(subject, exams, { basicInfo: next, chapters }));
  }

  function updateChapters(next: CourseChapter[]) {
    setChapters(next);
    onChangeMarkdown(generateSubjectFileMarkdown(subject, exams, { basicInfo, chapters: next }));
  }

  function addChapter(afterIdx?: number) {
    const insertIdx = afterIdx === undefined ? chapters.length : afterIdx + 1;
    const next = [...chapters];
    next.splice(insertIdx, 0, { title: `Chapter ${insertIdx + 1}`, points: [{ name: "Point 1", completed: false }] });
    updateChapters(next);
  }

  function deleteChapter(idx: number) {
    const next = chapters.filter((_, i) => i !== idx);
    updateChapters(next);
  }

  function duplicateChapter(idx: number) {
    const src = chapters[idx];
    if (!src) return;
    const copy: CourseChapter = {
      title: `${src.title} (Copy)`,
      points: src.points.map((p) => ({ ...p })),
    };
    const next = [...chapters];
    next.splice(idx + 1, 0, copy);
    updateChapters(next);
  }

  function addKnowledgePoint(chapterIdx: number) {
    const next = chapters.map((c, i) =>
      i === chapterIdx
        ? { ...c, points: [...c.points, { name: `Point ${c.points.length + 1}`, completed: false }] }
        : c,
    );
    updateChapters(next);
  }

  function addKnowledgePointColumn() {
    if (!chapters.length) {
      updateChapters([{ title: "Chapter 1", points: [{ name: "Point 1", completed: false }] }]);
      return;
    }
    const nextPointNumber = Math.max(0, ...chapters.map((c) => c.points.length)) + 1;
    updateChapters(chapters.map((c) => ({
      ...c,
      points: [...c.points, { name: `Point ${nextPointNumber}`, completed: false }],
    })));
  }

  function deleteKnowledgePoint(chapterIdx: number, pointIdx: number) {
    const next = chapters.map((c, i) =>
      i === chapterIdx
        ? { ...c, points: c.points.filter((_, j) => j !== pointIdx) }
        : c,
    );
    updateChapters(next);
  }

  function renameKnowledgePoint(chapterIdx: number, pointIdx: number, name: string) {
    const next = chapters.map((c, i) =>
      i === chapterIdx
        ? { ...c, points: c.points.map((p, j) => (j === pointIdx ? { ...p, name } : p)) }
        : c,
    );
    updateChapters(next);
  }

  function toggleKnowledgePoint(chapterIdx: number, pointIdx: number) {
    const next = chapters.map((c, i) =>
      i === chapterIdx
        ? { ...c, points: c.points.map((p, j) => (j === pointIdx ? { ...p, completed: !p.completed } : p)) }
        : c,
    );
    updateChapters(next);
  }

  function renameChapter(idx: number, title: string) {
    const next = chapters.map((c, i) => (i === idx ? { ...c, title } : c));
    updateChapters(next);
  }

  function resetProgress() {
    const next = chapters.map((c) => ({ ...c, points: c.points.map((p) => ({ ...p, completed: false })) }));
    updateChapters(next);
  }

  function chapterProgress(chapter: CourseChapter): number {
    if (!chapter.points.length) return 0;
    return Math.round((chapter.points.filter((p) => p.completed).length / chapter.points.length) * 100);
  }

  function overallProgress(): number {
    const total = chapters.reduce((s, c) => s + c.points.length, 0);
    if (!total) return 0;
    const done = chapters.reduce((s, c) => s + c.points.filter((p) => p.completed).length, 0);
    return Math.round((done / total) * 100);
  }

  function weightedScore(exam: ExamRecord): number {
    if (exam.maxScore <= 0) return 0;
    return (exam.score / exam.maxScore) * (exam.weight ?? 0);
  }

  function addAssessment() {
    onAddExam({
      title: "New Assessment",
      subjectId: subject.id,
      kind: "other",
      date: toIsoDate(new Date()),
      weight: 0,
      score: 0,
      maxScore: 100,
      notes: "",
      relatedFileIds: [],
    });
  }

  function updateAssessmentTitle(exam: ExamRecord, title: string) {
    onUpdateExam(exam.id, { title });
  }

  function updateAssessmentWeight(exam: ExamRecord, weight: number) {
    onUpdateExam(exam.id, { weight });
  }

  function updateAssessmentScore(exam: ExamRecord, score: number) {
    onUpdateExam(exam.id, { score });
  }

  function updateAssessmentMaxScore(exam: ExamRecord, maxScore: number) {
    onUpdateExam(exam.id, { maxScore });
  }

  function updateAssessmentStatus(exam: ExamRecord, status: ExamRecord["status"]) {
    onUpdateExam(exam.id, { status });
  }

  const totalWeight = subjectExams.reduce((s, e) => s + (e.weight ?? 0), 0);
  const totalWeighted = subjectExams.reduce((s, e) => s + weightedScore(e), 0);
  const completedWeight = subjectExams.filter((e) => (e.score ?? 0) > 0 || e.status === "completed" || e.status === "released").reduce((s, e) => s + (e.weight ?? 0), 0);
  const remaining = Math.max(0, 100 - totalWeight);
  const pointColumnCount = Math.max(1, ...chapters.map((c) => c.points.length));

  const handleSwitchToRich = useCallback(() => {
    const parsedSource = parseSubjectFile(sourceValue);
    setBasicInfo(parsedSource.basicInfo);
    setChapters(parsedSource.chapters);
    onChangeMarkdown(sourceValue || richMarkdown);

    const existing = exams.filter((e) => e.subjectId === subject.id);
    const used = new Set<string>();
    for (const a of parsedSource.assessments) {
      const match = existing.find((e) => e.title === a.title && !used.has(e.id));
      if (match) {
        used.add(match.id);
        onUpdateExam(match.id, {
          weight: a.weight ?? match.weight,
          score: a.score ?? match.score,
          maxScore: a.maxScore ?? match.maxScore,
          status: a.status ?? match.status,
          kind: a.kind ?? match.kind,
        });
      } else if (a.title) {
        onAddExam({
          title: a.title,
          subjectId: subject.id,
          kind: a.kind ?? "other",
          date: toIsoDate(new Date()),
          weight: a.weight ?? 0,
          score: a.score ?? 0,
          maxScore: a.maxScore ?? 100,
          notes: "",
          relatedFileIds: [],
        });
      }
    }
    for (const e of existing) {
      if (!used.has(e.id) && !parsedSource.assessments.some((a) => a.title === e.title)) {
        onDeleteExam(e.id);
      }
    }

    setEditorMode("rich");
  }, [sourceValue, richMarkdown, exams, subject.id, onChangeMarkdown, onUpdateExam, onAddExam, onDeleteExam]);

  const handleTableContextMenu = useCallback((e: React.MouseEvent, chapterIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, chapterIdx });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--line)", gap: 10, flexWrap: "wrap", background: "var(--panel)" }}>
        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{subject.code} Overview</div>
        <div className="row" style={{ gap: 6 }}>
          <button className={`btn ${editorMode === "rich" ? "btn-primary" : ""}`} onClick={() => { if (editorMode === "source") handleSwitchToRich(); else setEditorMode("rich"); }} title="Rich edit">
            <FileText size={14} /> Rich
          </button>
          <button className={`btn ${editorMode === "source" ? "btn-primary" : ""}`} onClick={handleSwitchToSource} title="Source mode">
            <FileCode size={14} /> Source
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {editorMode === "rich" ? (
          <div style={{ height: "100%", overflowY: "auto", padding: "18px 20px 60px", background: "var(--panel)" }}>
            {/* Basic Information */}
            <Section title="Basic Information">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <Field label="Lecturer" value={basicInfo.lecturer || subject.lecturer} onChange={(v) => updateBasicInfo({ lecturer: v })} />
                <Field label="Venue" value={basicInfo.venue} onChange={(v) => updateBasicInfo({ venue: v })} />
                <Field label="Credit Hours" value={basicInfo.creditHours} onChange={(v) => updateBasicInfo({ creditHours: v })} />
              </div>
            </Section>

            {/* Course Content */}
            <Section title="Course Content" actions={
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-primary" style={{ height: 28, padding: "0 10px", fontSize: "0.78rem" }} onClick={() => addChapter()}>
                  <Plus size={12} /> Chapter
                </button>
                <button className="btn btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: "0.78rem" }} onClick={addKnowledgePointColumn}>
                  <Plus size={12} /> Point column
                </button>
                <button className="btn btn-ghost" style={{ height: 28, padding: "0 8px", fontSize: "0.78rem" }} onClick={resetProgress}><RotateCcw size={12} /> Reset Progress</button>
              </div>
            }>
              <div style={{ overflowX: "auto" }}>
                <table className="sf-table" ref={tableRef}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>Chapter</th>
                      {Array.from({ length: pointColumnCount }, (_, i) => (
                        <th key={i} style={{ minWidth: 160 }}>Knowledge Point {i + 1}</th>
                      ))}
                      <th style={{ minWidth: 140 }}>Chapter Progress</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {chapters.map((chapter, ci) => (
                      <tr key={ci} onContextMenu={(e) => handleTableContextMenu(e, ci)}>
                        <td>
                          <input className="input" style={{ fontSize: "0.84rem", padding: "6px 8px" }} value={chapter.title} onChange={(e) => renameChapter(ci, e.target.value)} />
                        </td>
                        {chapter.points.map((point, pi) => (
                          <td key={pi}>
                            <div className="row" style={{ gap: 6 }}>
                              <input type="checkbox" checked={point.completed} onChange={() => toggleKnowledgePoint(ci, pi)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
                              <input className="input" style={{ fontSize: "0.84rem", padding: "6px 8px", flex: 1, minWidth: 0 }} value={point.name} onChange={(e) => renameKnowledgePoint(ci, pi, e.target.value)} />
                              <button className="btn btn-ghost" style={{ padding: 2, height: 24, width: 24 }} onClick={() => deleteKnowledgePoint(ci, pi)} title="Delete point"><Trash2 size={11} /></button>
                            </div>
                          </td>
                        ))}
                        {Array.from({ length: Math.max(0, pointColumnCount - chapter.points.length) }, (_, i) => (
                          <td key={`empty-${i}`}>
                            <button className="sf-empty-point-btn" onClick={() => addKnowledgePoint(ci)}>
                              <Plus size={12} /> Add point
                            </button>
                          </td>
                        ))}
                        <td><ProgressBar pct={chapterProgress(chapter)} label={`${chapterProgress(chapter)}%`} /></td>
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            <button className="btn btn-ghost" style={{ padding: 2, height: 24, width: 24 }} onClick={() => duplicateChapter(ci)} title="Duplicate row"><Copy size={11} /></button>
                            <button className="btn btn-ghost" style={{ padding: 2, height: 24, width: 24 }} onClick={() => deleteChapter(ci)} title="Delete chapter"><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sf-table-footer-actions">
                <button className="btn btn-ghost" onClick={() => addChapter()}>
                  <Plus size={13} /> Add chapter
                </button>
                <button className="btn btn-ghost" onClick={addKnowledgePointColumn}>
                  <Plus size={13} /> Add point column
                </button>
              </div>
              {ctxMenu.open && (
                <div ref={ctxRef} className="k-context-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
                  <button className="k-context-item" onClick={() => { addChapter(ctxMenu.chapterIdx); setCtxMenu((p) => ({ ...p, open: false })); }}>
                    <Plus size={12} /> Add chapter below
                  </button>
                  <button className="k-context-item" onClick={() => { addKnowledgePoint(ctxMenu.chapterIdx); setCtxMenu((p) => ({ ...p, open: false })); }}>
                    <Plus size={12} /> Add knowledge point
                  </button>
                  <button className="k-context-item" onClick={() => { duplicateChapter(ctxMenu.chapterIdx); setCtxMenu((p) => ({ ...p, open: false })); }}>
                    <Copy size={12} /> Duplicate row
                  </button>
                  <button className="k-context-item danger" onClick={() => { deleteChapter(ctxMenu.chapterIdx); setCtxMenu((p) => ({ ...p, open: false })); }}>
                    <Trash2 size={12} /> Delete chapter
                  </button>
                </div>
              )}
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <strong style={{ fontSize: "0.86rem" }}>Overall Course Progress:</strong>
                <ProgressBar pct={overallProgress()} label={`${overallProgress()}%`} />
              </div>
            </Section>

            {/* Assessment Plan */}
            <Section title="Assessment Plan" actions={
              <button className="btn btn-primary" style={{ height: 28, padding: "0 10px", fontSize: "0.78rem" }} onClick={addAssessment}><Plus size={12} /> Add Component</button>
            }>
              <div style={{ overflowX: "auto" }}>
                <table className="sf-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 160 }}>Assessment Component</th>
                      <th style={{ minWidth: 90 }}>Weight (%)</th>
                      <th style={{ minWidth: 100 }}>Score Obtained</th>
                      <th style={{ minWidth: 90 }}>Full Marks</th>
                      <th style={{ minWidth: 100 }}>Weighted Score</th>
                      <th style={{ minWidth: 120 }}>Status</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {subjectExams.map((exam) => (
                      <tr key={exam.id}>
                        <td><input className="input" style={{ fontSize: "0.84rem", padding: "6px 8px" }} value={exam.title} onChange={(e) => updateAssessmentTitle(exam, e.target.value)} /></td>
                        <td><input className="input" type="number" min={0} max={100} style={{ fontSize: "0.84rem", padding: "6px 8px" }} value={exam.weight ?? 0} onChange={(e) => updateAssessmentWeight(exam, Number(e.target.value))} /></td>
                        <td><input className="input" type="number" min={0} style={{ fontSize: "0.84rem", padding: "6px 8px" }} value={exam.score ?? 0} onChange={(e) => updateAssessmentScore(exam, Number(e.target.value))} /></td>
                        <td><input className="input" type="number" min={1} style={{ fontSize: "0.84rem", padding: "6px 8px" }} value={exam.maxScore ?? 100} onChange={(e) => updateAssessmentMaxScore(exam, Number(e.target.value))} /></td>
                        <td style={{ fontSize: "0.84rem", fontWeight: 500, textAlign: "right", padding: "8px 12px" }}>{weightedScore(exam).toFixed(1)}</td>
                        <td>
                          <select className="select" style={{ fontSize: "0.84rem", padding: "6px 8px", height: 34 }} value={exam.status ?? "not-started"} onChange={(e) => updateAssessmentStatus(exam, e.target.value as ExamRecord["status"])}>
                            <option value="not-started">Not started</option>
                            <option value="not-completed">Not completed</option>
                            <option value="completed">Completed</option>
                            <option value="released">Released</option>
                          </select>
                        </td>
                        <td>
                          <button className="btn btn-ghost" style={{ padding: 2, height: 24, width: 24 }} onClick={() => onDeleteExam(exam.id)} title="Delete"><Trash2 size={11} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem" }}>
                <strong>Total Weight:</strong> {totalWeight}%
                {totalWeight !== 100 && (
                  <span className="row" style={{ color: "var(--danger)", fontSize: "0.78rem", gap: 4 }}>
                    <AlertTriangle size={12} /> Should be 100%
                  </span>
                )}
              </div>
            </Section>

            {/* Examination / Quiz Statistics */}
            <Section title="Examination / Quiz Statistics">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <Stat label="Completed assessment %" value={`${completedWeight}%`} />
                <Stat label="Current weighted score" value={`${totalWeighted.toFixed(1)}%`} />
                <Stat label="Remaining %" value={`${remaining}%`} />
                <Stat label="Assessments defined" value={`${subjectExams.length}`} />
              </div>
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0 0 8px" }}>Upcoming incomplete assessments</h4>
                {subjectExams.filter((e) => e.status !== "completed" && e.status !== "released").length === 0 ? (
                  <div style={{ fontSize: "0.84rem", color: "var(--muted)" }}>All assessments are completed or released.</div>
                ) : (
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: "0.84rem", display: "grid", gap: 4 }}>
                    {subjectExams
                      .filter((e) => e.status !== "completed" && e.status !== "released")
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((e) => (
                        <li key={e.id}>{e.title} ({e.date}) — {e.weight ?? 0}%</li>
                      ))}
                  </ul>
                )}
              </div>
            </Section>
          </div>
        ) : (
          <textarea
            className="textarea"
            style={{
              height: "100%",
              borderRadius: 0,
              border: 0,
              fontFamily: "var(--font-ui)",
              lineHeight: 1.7,
              padding: 18,
              width: "100%",
              resize: "none",
              overflowY: "auto",
              background: "var(--panel)",
              color: "var(--text)",
            }}
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            placeholder="Write the full subject file markdown here..."
          />
        )}
      </div>
    </div>
  );
}

function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: "1rem", fontWeight: 600, padding: "0 4px", height: 28, gap: 6 }}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "▸" : "▾"} {title}
        </button>
        {!collapsed && actions && <div className="row">{actions}</div>}
      </div>
      {!collapsed && children}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field" style={{ gap: 4 }}>
      <label style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <input className="input" style={{ fontSize: "0.86rem", padding: "8px 10px" }} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
