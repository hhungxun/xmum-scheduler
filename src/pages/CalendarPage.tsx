import Calendar, { type ExternalEventTypes, type Options as ToastCalendarOptions } from "@toast-ui/calendar";
import "@toast-ui/calendar/dist/toastui-calendar.min.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { CalendarEvent, Subject, Assignment, ExamRecord, AcademicOption, Status, Priority } from "../types";
import { toIsoDate, timeFromDate, dateLikeToDate, dateToDayIndex, semesterClassDates, HOUR_START, HOUR_END } from "../lib/utils";
import { ChevronLeft, ChevronRight, Plus, Trash2, Paperclip, CheckCircle2, Circle, X, CalendarDays, MapPin, Clock, AlignLeft } from "lucide-react";
import { statusLabels, examKindLabels, fmtRange } from "../lib/utils";

type FilterChip = "all" | "pending" | "completed" | "overdue";

type CreateModalData = {
  open: boolean;
  mode: "event" | "task";
  title: string;
  subjectId: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isAllDay: boolean;
  editingEventId?: string;
};

function emptyModalData(subjects: Subject[]): CreateModalData {
  const today = toIsoDate(new Date());
  return {
    open: false,
    mode: "event",
    title: "",
    subjectId: subjects[0]?.id ?? "custom",
    location: "",
    startDate: today,
    startTime: "09:00",
    endDate: today,
    endTime: "10:00",
    isAllDay: false,
  };
}

export function CalendarPage(props: {
  selectedCalendar: AcademicOption;
  events: CalendarEvent[];
  subjects: Subject[];
  assignments: Assignment[];
  exams: ExamRecord[];
  addCalendarEvent: (input: { title: string; date: string; start: string; end: string; venue: string; subjectId: string }) => void;
  updateCalendarEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  addAssignment: (input: { title: string; subjectId: string; due: string; weight: number; description: string; relatedFileIds: string[]; status?: Status; priority?: Priority }) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  today: Date;
  weekOffset: number;
  setWeekOffset: (n: number) => void;
}) {
  const {
    selectedCalendar, events, subjects, assignments, exams,
    addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    addAssignment, updateAssignment, deleteAssignment,
    weekStart, weekEnd, weekNumber, today, weekOffset, setWeekOffset,
  } = props;

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [filter, setFilter] = useState<FilterChip>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"priority" | "due" | "subject" | "status" | "created">("priority");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailAssignment = assignments.find((a) => a.id === detailId) ?? null;
  const [modal, setModal] = useState<CreateModalData>(() => emptyModalData(subjects));
  const [quickAddText, setQuickAddText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState("");

  const selectedIso = toIsoDate(selectedDate);
  const isToday = selectedIso === toIsoDate(today);

  const dayAssignments = useMemo(() => {
    let list = assignments.filter((a) => a.due === selectedIso);
    const todayStr = toIsoDate(today);
    if (filter === "pending") list = list.filter((a) => a.status !== "graded");
    if (filter === "completed") list = list.filter((a) => a.status === "graded");
    if (filter === "overdue") list = list.filter((a) => a.due < todayStr && a.status !== "graded");
    if (subjectFilter !== "all") list = list.filter((a) => a.subjectId === subjectFilter);

    list.sort((a, b) => {
      switch (sortBy) {
        case "priority": {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.priority ?? "medium"] - order[b.priority ?? "medium"]) || a.title.localeCompare(b.title);
        }
        case "due": return a.due.localeCompare(b.due) || a.title.localeCompare(b.title);
        case "subject": {
          const sa = subjects.find((s) => s.id === a.subjectId)?.code ?? "";
          const sb = subjects.find((s) => s.id === b.subjectId)?.code ?? "";
          return sa.localeCompare(sb) || a.title.localeCompare(b.title);
        }
        case "status": return a.status.localeCompare(b.status) || a.title.localeCompare(b.title);
        case "created": return (b.createdAt ?? b.id).localeCompare(a.createdAt ?? a.id);
        default: return 0;
      }
    });
    return list;
  }, [assignments, selectedIso, filter, subjectFilter, sortBy, subjects, today]);

  const dayExams = useMemo(() => exams.filter((e) => e.date === selectedIso), [exams, selectedIso]);
  const dayClasses = useMemo(() =>
    events.filter((e) => {
      if (e.type !== "class" && e.type !== "custom") return false;
      if (e.date) return e.date === selectedIso;
      return dateToDayIndex(selectedIso) === e.dayIndex;
    }).sort((a, b) => a.start.localeCompare(b.start)),
  [events, selectedIso]);

  const totalTasks = dayAssignments.length;
  const completedTasks = dayAssignments.filter((a) => a.status === "graded").length;
  const overdueTasks = dayAssignments.filter((a) => a.due < toIsoDate(today) && a.status !== "graded").length;

  const [completedCollapsed, setCompletedCollapsed] = useState(false);

  const openCreateModal = useCallback((patch: Partial<CreateModalData>) => {
    setModal((prev) => ({ ...prev, open: true, ...patch }));
  }, []);

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleSaveModal = useCallback(() => {
    if (!modal.title.trim()) return;
    if (modal.mode === "event") {
      const date = modal.startDate;
      let start = modal.isAllDay ? "00:00" : modal.startTime;
      let end = modal.isAllDay ? "23:59" : modal.endTime;
      if (!modal.isAllDay) {
        const startDate = new Date(`${modal.startDate}T${start}`);
        const endDate = new Date(`${modal.endDate}T${end}`);
        if (endDate <= startDate) {
          const corrected = new Date(startDate.getTime() + 30 * 60000);
          end = timeFromDate(corrected);
        }
      }
      if (modal.editingEventId) {
        updateCalendarEvent(modal.editingEventId, {
          name: modal.title.trim(),
          date,
          start,
          end,
          venue: modal.location,
          subjectId: modal.subjectId,
        });
      } else {
        addCalendarEvent({
          title: modal.title.trim(),
          date,
          start,
          end,
          venue: modal.location,
          subjectId: modal.subjectId,
        });
      }
    } else {
      // Task mode: create/update assignment
      if (modal.editingEventId && modal.editingEventId.startsWith("assignment-")) {
        const assignId = modal.editingEventId.replace("assignment-", "");
        updateAssignment(assignId, {
          title: modal.title.trim(),
          due: modal.startDate,
          subjectId: modal.subjectId,
        });
      } else {
        addAssignment({
          title: modal.title.trim(),
          subjectId: modal.subjectId,
          due: modal.startDate,
          weight: 0,
          description: "",
          relatedFileIds: [],
          status: "todo",
          priority: "medium",
        });
      }
    }
    closeModal();
  }, [modal, addCalendarEvent, updateCalendarEvent, addAssignment, updateAssignment, closeModal]);

  const handleQuickAdd = useCallback(() => {
    const text = quickAddText.trim();
    if (!text) return;
    addAssignment({
      title: text,
      subjectId: subjects[0]?.id ?? "",
      due: selectedIso,
      weight: 0,
      description: "",
      relatedFileIds: [],
      status: "todo",
      priority: "medium",
    });
    setQuickAddText("");
  }, [quickAddText, addAssignment, subjects, selectedIso]);

  return (
    <div className="calendar-page-shell">
      {/* Main calendar area */}
      <div className="calendar-main">
        <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Week {weekNumber} · {fmtRange(weekStart, weekEnd)}</div>
            <div className="row">
              <button className="icon-btn" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous"><ChevronLeft size={14} /></button>
              <button className="btn" onClick={() => { setWeekOffset(0); setSelectedDate(today); }}>Today</button>
              <button className="icon-btn" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ToastCalendarView
              events={events}
              subjects={subjects}
              selectedCalendar={selectedCalendar}
              weekStart={weekStart}
              updateCalendarEvent={updateCalendarEvent}
              deleteCalendarEvent={deleteCalendarEvent}
              onSelectDate={(date) => setSelectedDate(date)}
              onSelectDateTime={(start, end, isAllDay) => {
                openCreateModal({
                  mode: "event",
                  title: "",
                  startDate: toIsoDate(start),
                  startTime: timeFromDate(start),
                  endDate: toIsoDate(end),
                  endTime: timeFromDate(end),
                  isAllDay: isAllDay,
                  editingEventId: undefined,
                });
              }}
              onClickEvent={(event) => {
                const raw = event.raw as { appId?: string; appType?: string } | undefined;
                const appType = raw?.appType;
                const appId = raw?.appId;
                if (appType === "custom" && appId) {
                  openCreateModal({
                    mode: "event",
                    title: event.title ?? "",
                    subjectId: event.calendarId ?? "custom",
                    location: event.location ?? "",
                    startDate: toIsoDate(dateLikeToDate(event.start)),
                    startTime: timeFromDate(dateLikeToDate(event.start)),
                    endDate: toIsoDate(dateLikeToDate(event.end)),
                    endTime: timeFromDate(dateLikeToDate(event.end)),
                    isAllDay: event.category === "allday",
                    editingEventId: appId,
                  });
                } else if (appType === "assignment" && appId) {
                  const assign = assignments.find((a) => a.id === appId);
                  if (assign) {
                    openCreateModal({
                      mode: "task",
                      title: assign.title,
                      subjectId: assign.subjectId,
                      location: "",
                      startDate: assign.due,
                      startTime: "00:00",
                      endDate: assign.due,
                      endTime: "23:59",
                      isAllDay: true,
                      editingEventId: `assignment-${assign.id}`,
                    });
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="calendar-sidebar">
        <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, height: "100%", overflow: "hidden" }}>
          {/* Date header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
                {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </h2>
              {isToday && <span className="tag" style={{ marginTop: 4 }}>Today</span>}
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button className="icon-btn" onClick={() => {
                const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d);
              }}><ChevronLeft size={14} /></button>
              <input
                type="date"
                className="input"
                value={selectedIso}
                onChange={(e) => { if (e.target.value) setSelectedDate(new Date(`${e.target.value}T00:00:00`)); }}
                style={{ width: 0, padding: 0, border: 0, opacity: 0, position: "absolute", pointerEvents: "none" }}
              />
              <button className="icon-btn" onClick={() => {
                const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d);
              }}><ChevronRight size={14} /></button>
            </div>
          </div>

          {/* Summary */}
          <div className="row" style={{ gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
            <div className="metric compact" style={{ flex: 1, minWidth: 0, padding: 8 }}>
              <div className="metric-label" style={{ fontSize: "0.65rem" }}>Tasks</div>
              <div className="metric-value" style={{ fontSize: "1.1rem" }}>{totalTasks}</div>
            </div>
            <div className="metric compact" style={{ flex: 1, minWidth: 0, padding: 8 }}>
              <div className="metric-label" style={{ fontSize: "0.65rem" }}>Done</div>
              <div className="metric-value" style={{ fontSize: "1.1rem" }}>{completedTasks}</div>
            </div>
            {overdueTasks > 0 && (
              <div className="metric compact" style={{ flex: 1, minWidth: 0, padding: 8, borderColor: "var(--danger)" }}>
                <div className="metric-label" style={{ fontSize: "0.65rem", color: "var(--danger)" }}>Overdue</div>
                <div className="metric-value" style={{ fontSize: "1.1rem", color: "var(--danger)" }}>{overdueTasks}</div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {(["all", "pending", "completed", "overdue"] as FilterChip[]).map((f) => (
                <button
                  key={f}
                  className={`btn ${filter === f ? "btn-primary" : ""}`}
                  style={{ height: 28, padding: "0 10px", fontSize: "0.76rem", textTransform: "capitalize" }}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <select
                className="select"
                style={{ height: 28, padding: "0 8px", fontSize: "0.76rem", flex: 1, minWidth: 0 }}
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              >
                <option value="all">All subjects</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
              </select>
              <select
                className="select"
                style={{ height: 28, padding: "0 8px", fontSize: "0.76rem", minWidth: 90 }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="priority">Priority</option>
                <option value="due">Due</option>
                <option value="subject">Subject</option>
                <option value="status">Status</option>
                <option value="created">Created</option>
              </select>
            </div>
          </div>

          {/* Task list */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Deadlines / Tasks */}
            {dayAssignments.filter((a) => a.status !== "graded").length > 0 && (
              <div>
                <div className="section-title" style={{ marginBottom: 6 }}>
                  <span>Tasks</span>
                  <span>{dayAssignments.filter((a) => a.status !== "graded").length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayAssignments.filter((a) => a.status !== "graded").map((a) => (
                    <TaskItem
                      key={a.id}
                      assignment={a}
                      subjects={subjects}
                      updateAssignment={updateAssignment}
                      deleteAssignment={deleteAssignment}
                        onOpenDetail={() => setDetailId(a.id)}
                      isOverdue={a.due < toIsoDate(today) && a.status !== "graded"}
                      editingTaskId={editingTaskId}
                      editTaskText={editTaskText}
                      setEditTaskText={setEditTaskText}
                      setEditingTaskId={setEditingTaskId}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Classes / Events */}
            {dayClasses.length > 0 && (
              <div>
                <div className="section-title" style={{ marginBottom: 6 }}>
                  <span>Classes & Events</span>
                  <span>{dayClasses.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayClasses.map((e) => (
                    <div key={e.id} className="today-item" style={{ padding: "6px 0" }}>
                      <span className="agenda-dot" style={{ background: e.color }} />
                      <div>
                        <strong style={{ fontSize: "0.84rem" }}>{e.code} · {e.name}</strong>
                        <small>{e.start}–{e.end}{e.venue ? ` · ${e.venue}` : ""}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exams */}
            {dayExams.length > 0 && (
              <div>
                <div className="section-title" style={{ marginBottom: 6 }}>
                  <span>Exams</span>
                  <span>{dayExams.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayExams.map((exam) => {
                    const subject = subjects.find((s) => s.id === exam.subjectId);
                    return (
                      <div key={exam.id} className="today-item" style={{ padding: "6px 0" }}>
                        <span className="agenda-dot" style={{ background: subject?.color ?? "var(--accent)" }} />
                        <div>
                          <strong style={{ fontSize: "0.84rem" }}>{exam.title}</strong>
                          <small>{subject?.code ?? "Exam"} · {examKindLabels[exam.kind]} · {exam.weight}%</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed */}
            {dayAssignments.filter((a) => a.status === "graded").length > 0 && (
              <div>
                <button
                  className="section-title"
                  style={{ marginBottom: 6, background: "transparent", border: 0, width: "100%", cursor: "pointer", padding: 0 }}
                  onClick={() => setCompletedCollapsed((v) => !v)}
                >
                  <span>Completed</span>
                  <span>{dayAssignments.filter((a) => a.status === "graded").length} {completedCollapsed ? "▸" : "▾"}</span>
                </button>
                {!completedCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {dayAssignments.filter((a) => a.status === "graded").map((a) => (
                      <TaskItem
                        key={a.id}
                        assignment={a}
                        subjects={subjects}
                        updateAssignment={updateAssignment}
                        deleteAssignment={deleteAssignment}
                      onOpenDetail={() => setDetailId(a.id)}
                        isOverdue={false}
                        editingTaskId={editingTaskId}
                        editTaskText={editTaskText}
                        setEditTaskText={setEditTaskText}
                        setEditingTaskId={setEditingTaskId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {dayAssignments.length === 0 && dayExams.length === 0 && dayClasses.length === 0 && (
              <div className="empty compact" style={{ marginTop: 8 }}>
                <span style={{ fontSize: "0.84rem" }}>No tasks for this day.</span>
              </div>
            )}
          </div>

          {/* Quick add */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="row" style={{ gap: 6 }}>
              <input
                className="input"
                style={{ flex: 1, fontSize: "0.84rem" }}
                placeholder={`Add task for ${selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}…`}
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleQuickAdd(); }
                  if (e.key === "Escape") { setQuickAddText(""); }
                }}
              />
              <button className="btn btn-primary" style={{ height: 36, padding: "0 12px" }} onClick={handleQuickAdd}>
                <Plus size={14} />
              </button>
            </div>
            <button
              className="btn"
              style={{ width: "100%" }}
              onClick={() => {
                openCreateModal({
                  mode: "task",
                  title: "",
                  startDate: selectedIso,
                  startTime: "00:00",
                  endDate: selectedIso,
                  endTime: "23:59",
                  isAllDay: true,
                  editingEventId: undefined,
                });
              }}
            >
              <Plus size={14} /> Create detailed task
            </button>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {detailAssignment && (
        <TaskDetailPanel
          assignment={detailAssignment}
          subjects={subjects}
          onClose={() => setDetailId(null)}
          updateAssignment={updateAssignment}
          deleteAssignment={deleteAssignment}
        />
      )}

      {/* Create/Edit Modal */}
      {modal.open && (
        <CreateEventModal
          modal={modal}
          setModal={setModal}
          subjects={subjects}
          onSave={handleSaveModal}
          onClose={closeModal}
          onDelete={() => {
            if (modal.editingEventId) {
              if (modal.mode === "event") deleteCalendarEvent(modal.editingEventId);
              else if (modal.editingEventId.startsWith("assignment-")) {
                deleteAssignment(modal.editingEventId.replace("assignment-", ""));
              }
            }
            closeModal();
          }}
        />
      )}
    </div>
  );
}

function TaskItem({ assignment, subjects, updateAssignment, deleteAssignment, onOpenDetail, isOverdue, editingTaskId, editTaskText, setEditTaskText, setEditingTaskId }: {
  assignment: Assignment;
  subjects: Subject[];
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  onOpenDetail: () => void;
  isOverdue: boolean;
  editingTaskId: string | null;
  editTaskText: string;
  setEditTaskText: (v: string) => void;
  setEditingTaskId: (v: string | null) => void;
}) {
  const subject = subjects.find((s) => s.id === assignment.subjectId);
  const priority = assignment.priority ?? "medium";
  const priorityColor = priority === "high" ? "#dc2626" : priority === "low" ? "#6b7280" : "#f59e0b";
  const isEditing = editingTaskId === assignment.id;

  return (
    <div
      className="task-mini"
      onClick={() => {
        if (!isEditing) onOpenDetail();
      }}
      style={{ borderLeft: isOverdue ? "3px solid var(--danger)" : undefined }}
    >
      <div className="task-mini-head">
        <button
          className="icon-btn"
          style={{ width: 22, height: 22, border: 0, background: "transparent" }}
          onClick={(e) => { e.stopPropagation(); updateAssignment(assignment.id, { status: assignment.status === "graded" ? "todo" : "graded" }); }}
          title={assignment.status === "graded" ? "Mark incomplete" : "Mark complete"}
        >
          {assignment.status === "graded" ? <CheckCircle2 size={16} style={{ color: "var(--success)" }} /> : <Circle size={16} style={{ color: "var(--muted)" }} />}
        </button>
        {isEditing ? (
          <input
            autoFocus
            className="input"
            style={{ flex: 1, fontSize: "0.84rem", padding: "4px 8px", height: 28 }}
            value={editTaskText}
            onChange={(e) => setEditTaskText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { updateAssignment(assignment.id, { title: editTaskText }); setEditingTaskId(null); }
              if (e.key === "Escape") { setEditingTaskId(null); }
            }}
            onBlur={() => { updateAssignment(assignment.id, { title: editTaskText }); setEditingTaskId(null); }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="task-mini-title"
            style={{ textDecoration: assignment.status === "graded" ? "line-through" : "none", opacity: assignment.status === "graded" ? 0.6 : 1 }}
            onDoubleClick={(e) => { e.stopPropagation(); setEditingTaskId(assignment.id); setEditTaskText(assignment.title); }}
          >
            {assignment.title}
          </div>
        )}
        <span className="task-mini-tag" style={{ color: priorityColor, background: `${priorityColor}15`, borderColor: `${priorityColor}40` }}>{priority}</span>
      </div>
      <div className="task-mini-meta">
        <span className="task-mini-tag" style={{ color: subject?.color ?? "var(--muted)", background: `${subject?.color ?? "#888"}15`, borderColor: `${subject?.color ?? "#888"}40` }}>{subject?.code ?? "—"}</span>
        <span className="task-mini-tag">{statusLabels[assignment.status]}</span>
        {isOverdue && <span className="task-mini-tag" style={{ color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 12%, transparent)", borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)" }}>Overdue</span>}
        {(assignment.relatedFileIds?.length ?? 0) > 0 && <Paperclip size={11} className="muted" />}
      </div>
    </div>
  );
}

function TaskDetailPanel({ assignment, subjects, onClose, updateAssignment, deleteAssignment }: {
  assignment: Assignment;
  subjects: Subject[];
  onClose: () => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>Task details</h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <input className="input" value={assignment.title} onChange={(e) => updateAssignment(assignment.id, { title: e.target.value })} placeholder="Task title" />
          <div className="grid cols-2" style={{ gap: 10 }}>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 500 }}>Subject</label>
              <select className="select" value={assignment.subjectId} onChange={(e) => updateAssignment(assignment.id, { subjectId: e.target.value })}>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 500 }}>Status</label>
              <select className="select" value={assignment.status} onChange={(e) => updateAssignment(assignment.id, { status: e.target.value as Status })}>
                {(Object.keys(statusLabels) as Status[]).map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 500 }}>Due date</label>
              <input className="input" type="date" value={assignment.due} onChange={(e) => updateAssignment(assignment.id, { due: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 500 }}>Weight (%)</label>
              <input className="input" type="number" min={0} max={100} value={assignment.weight} onChange={(e) => updateAssignment(assignment.id, { weight: Number(e.target.value) })} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 500 }}>Priority</label>
              <select className="select" value={assignment.priority ?? "medium"} onChange={(e) => updateAssignment(assignment.id, { priority: e.target.value as Priority })}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <textarea className="textarea" style={{ minHeight: 60, fontSize: "0.84rem" }} value={assignment.description} onChange={(e) => updateAssignment(assignment.id, { description: e.target.value })} placeholder="Notes…" />
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            {!confirmDelete ? (
              <button className="btn btn-ghost btn-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</button>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => { deleteAssignment(assignment.id); onClose(); }}><Trash2 size={14} /> Confirm delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateEventModal({
  modal, setModal, subjects, onSave, onClose, onDelete,
}: {
  modal: CreateModalData;
  setModal: React.Dispatch<React.SetStateAction<CreateModalData>>;
  subjects: Subject[];
  onSave: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const isEditing = !!modal.editingEventId;
  const title = modal.mode === "event" ? (isEditing ? "Edit event" : "Create event") : (isEditing ? "Edit task" : "Create task");



  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 700 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: "90%" }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {/* Type toggle */}
          <div className="row" style={{ gap: 4, background: "var(--surface)", padding: 4, borderRadius: "var(--radius-sm)", alignSelf: "flex-start" }}>
            <button
              className={`btn ${modal.mode === "event" ? "btn-primary" : "btn-ghost"}`}
              style={{ height: 30, padding: "0 14px", fontSize: "0.8rem" }}
              onClick={() => setModal((p) => ({ ...p, mode: "event" }))}
            >
              Event
            </button>
            <button
              className={`btn ${modal.mode === "task" ? "btn-primary" : "btn-ghost"}`}
              style={{ height: 30, padding: "0 14px", fontSize: "0.8rem" }}
              onClick={() => setModal((p) => ({ ...p, mode: "task" }))}
            >
              Task
            </button>
          </div>

          {/* Title */}
          <div className="field">
            <label className="field-label">Title</label>
            <input
              autoFocus
              className="input"
              placeholder={modal.mode === "event" ? "Event title" : "Task title"}
              value={modal.title}
              onChange={(e) => setModal((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          {/* Subject */}
          <div className="field">
            <label className="field-label">Subject</label>
            <select
              className="select"
              value={modal.subjectId}
              onChange={(e) => setModal((p) => ({ ...p, subjectId: e.target.value }))}
            >
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              <option value="custom">Custom / No subject</option>
            </select>
          </div>

          {/* Location (events only) */}
          {modal.mode === "event" && (
            <div className="field">
              <label className="field-label">Location</label>
              <input
                className="input"
                placeholder="Room, venue, or link"
                value={modal.location}
                onChange={(e) => setModal((p) => ({ ...p, location: e.target.value }))}
              />
            </div>
          )}

          {/* All-day */}
          <label className="checkbox" style={{ fontSize: "0.84rem" }}>
            <input
              type="checkbox"
              checked={modal.isAllDay}
              onChange={(e) => setModal((p) => ({ ...p, isAllDay: e.target.checked }))}
            />
            All day
          </label>

          {/* Dates */}
          <div className="grid cols-2" style={{ gap: 10 }}>
            <div className="field">
              <label className="field-label">Start</label>
              <input
                type="date"
                className="input"
                value={modal.startDate}
                onChange={(e) => setModal((p) => ({ ...p, startDate: e.target.value }))}
              />
              {!modal.isAllDay && (
                <input
                  type="time"
                  className="input"
                  style={{ marginTop: 6 }}
                  value={modal.startTime}
                  onChange={(e) => setModal((p) => ({ ...p, startTime: e.target.value }))}
                />
              )}
            </div>
            <div className="field">
              <label className="field-label">End</label>
              <input
                type="date"
                className="input"
                value={modal.endDate}
                onChange={(e) => setModal((p) => ({ ...p, endDate: e.target.value }))}
              />
              {!modal.isAllDay && (
                <input
                  type="time"
                  className="input"
                  style={{ marginTop: 6 }}
                  value={modal.endTime}
                  onChange={(e) => setModal((p) => ({ ...p, endTime: e.target.value }))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="row" style={{ justifyContent: "space-between", marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          {isEditing ? (
            <button className="btn btn-ghost btn-danger" onClick={onDelete}><Trash2 size={14} /> Delete</button>
          ) : (
            <div />
          )}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={onSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToastCalendarView({
  events, subjects, selectedCalendar, weekStart, updateCalendarEvent, deleteCalendarEvent,
  onSelectDate, onSelectDateTime, onClickEvent,
}: {
  events: CalendarEvent[];
  subjects: Subject[];
  selectedCalendar: AcademicOption;
  weekStart: Date;
  updateCalendarEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  onSelectDate?: (date: Date) => void;
  onSelectDateTime?: (start: Date, end: Date, isAllDay: boolean) => void;
  onClickEvent?: (event: any) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<Calendar | null>(null);
  const updateRef = useRef(updateCalendarEvent);
  const deleteRef = useRef(deleteCalendarEvent);
  const dateRef = useRef(onSelectDate);
  const selectTimeRef = useRef(onSelectDateTime);
  const clickEventRef = useRef(onClickEvent);

  updateRef.current = updateCalendarEvent;
  deleteRef.current = deleteCalendarEvent;
  dateRef.current = onSelectDate;
  selectTimeRef.current = onSelectDateTime;
  clickEventRef.current = onClickEvent;

  const calendars = useMemo(() => [
    ...subjects.map((subject) => ({
      id: subject.id,
      name: subject.code,
      color: "#ffffff",
      backgroundColor: subject.color,
      dragBackgroundColor: subject.color,
      borderColor: subject.color,
    })),
    {
      id: "custom",
      name: "Custom",
      color: "#ffffff",
      backgroundColor: "#525252",
      dragBackgroundColor: "#525252",
      borderColor: "#525252",
    },
  ], [subjects]);

  useEffect(() => {
    if (!hostRef.current) return;
    const options: ToastCalendarOptions = {
      defaultView: "week",
      usageStatistics: false,
      useFormPopup: false,
      useDetailPopup: false,
      gridSelection: { enableClick: true, enableDblClick: true },
      calendars,
      week: {
        startDayOfWeek: 1,
        dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        hourStart: HOUR_START,
        hourEnd: HOUR_END,
        taskView: false,
        eventView: ["time", "allday"],
        showTimezoneCollapseButton: false,
        timezonesCollapsed: true,
      },
      month: {
        startDayOfWeek: 1,
        visibleEventCount: 3,
      },
      template: {
        time(event) {
          return `<span>${event.title ?? ""}</span>`;
        },
        allday(event) {
          return `<span style="font-weight:600">${event.title ?? ""}</span>`;
        },
      },
    };

    const calendar = new Calendar(hostRef.current, options);
    calendarRef.current = calendar;

    const selectDateTimeHandler: ExternalEventTypes["selectDateTime"] = (ev) => {
      const e = ev as { start: Date; end: Date; isAllday: boolean };
      const start = dateLikeToDate(e.start);
      const end = dateLikeToDate(e.end);
      selectTimeRef.current?.(start, end, e.isAllday);
      calendar.clearGridSelections();
    };

    const updateHandler: ExternalEventTypes["beforeUpdateEvent"] = ({ event, changes }) => {
      const appId = String((event.raw as { appId?: string } | undefined)?.appId ?? event.id ?? "");
      if (!appId || (event.raw as { appType?: string } | undefined)?.appType !== "custom") return;
      const start = changes.start ? dateLikeToDate(changes.start) : dateLikeToDate(event.start);
      const end = changes.end ? dateLikeToDate(changes.end) : dateLikeToDate(event.end);
      updateRef.current(appId, {
        name: changes.title ?? event.title ?? "Untitled event",
        date: toIsoDate(start),
        dayIndex: dateToDayIndex(toIsoDate(start)),
        start: timeFromDate(start),
        end: timeFromDate(end),
        venue: changes.location ?? event.location ?? "",
        subjectId: changes.calendarId && changes.calendarId !== "custom" ? changes.calendarId : event.calendarId === "custom" ? undefined : event.calendarId,
      });
      calendar.updateEvent(String(event.id), String(event.calendarId), changes);
    };

    const deleteHandler: ExternalEventTypes["beforeDeleteEvent"] = (event) => {
      const appId = String((event.raw as { appId?: string } | undefined)?.appId ?? event.id ?? "");
      if (!appId || (event.raw as { appType?: string } | undefined)?.appType !== "custom") return;
      deleteRef.current(appId);
      calendar.deleteEvent(String(event.id), String(event.calendarId));
    };

    const clickEventHandler: ExternalEventTypes["clickEvent"] = (ev) => {
      const e = ev as { event: any };
      clickEventRef.current?.(e.event);
    };

    calendar.on("selectDateTime", selectDateTimeHandler);
    calendar.on("beforeUpdateEvent", updateHandler);
    calendar.on("beforeDeleteEvent", deleteHandler);
    calendar.on("clickEvent", clickEventHandler);

    // Click day name to select date
    calendar.on("clickDayName", (event: unknown) => {
      const ev = event as { date: string };
      dateRef.current?.(new Date(`${ev.date}T00:00:00`));
    });

    calendar.setDate(weekStart);
    calendar.scrollToNow("auto");

    return () => {
      calendar.off("selectDateTime", selectDateTimeHandler);
      calendar.off("beforeUpdateEvent", updateHandler);
      calendar.off("beforeDeleteEvent", deleteHandler);
      calendar.off("clickEvent", clickEventHandler);
      calendar.destroy();
      calendarRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const calendar = calendarRef.current;
    if (!calendar) return;
    calendar.setCalendars(calendars);
    calendar.clear();
    const toastEvents = events.flatMap((event) => {
      const isRecurringClass = event.type === "class" && !event.date;
      return semesterClassDates(event, selectedCalendar).map((date) => {
        const id = isRecurringClass ? `${event.id}-${date}` : event.id;
        const isAllDay = event.type === "assignment";
        return {
          id,
          calendarId: event.subjectId ?? "custom",
          title: event.type === "class" ? `${event.code} · ${event.name}` : event.name,
          body: event.weeks,
          category: isAllDay ? "allday" : "time",
          start: isAllDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${event.start}:00`),
          end: isAllDay ? new Date(`${date}T23:59:00`) : new Date(`${date}T${event.end}:00`),
          location: event.venue,
          isReadOnly: event.type !== "custom",
          color: "#ffffff",
          backgroundColor: event.color,
          dragBackgroundColor: event.color,
          borderColor: event.color,
          raw: { appId: event.id, appType: event.type, appDate: date, code: event.code },
        };
      });
    });
    calendar.createEvents(toastEvents as Parameters<Calendar["createEvents"]>[0]);
  }, [calendars, events, selectedCalendar]);

  useEffect(() => {
    const calendar = calendarRef.current;
    if (!calendar) return;
    calendar.setDate(weekStart);
    calendar.render();
  }, [weekStart]);

  return <div ref={hostRef} className="toast-calendar-host" style={{ height: "100%" }} />;
}
