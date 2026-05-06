import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, DateSelectArg, EventDropArg, EventMountArg } from "@fullcalendar/core";
import type { CalendarEvent, Subject, Assignment, ExamRecord, AcademicOption, Status, Priority } from "../types";
import { toIsoDate, timeFromDate, dateToDayIndex, semesterClassDates, HOUR_START, HOUR_END } from "../lib/utils";

import { ChevronLeft, ChevronRight, Plus, Trash2, Paperclip, CheckCircle2, Circle, X, CalendarDays, MapPin, Clock, AlignLeft, SlidersHorizontal } from "lucide-react";
import { statusLabels, fmtRange } from "../lib/utils";

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

type CalendarContextMenu = {
  open: boolean;
  x: number;
  y: number;
  eventId: string;
  eventType: string;
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
  updateExam?: (id: string, patch: Partial<ExamRecord>) => void;
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
    addAssignment, updateAssignment, deleteAssignment, updateExam,
    weekStart, weekEnd, weekNumber, today, weekOffset, setWeekOffset,
  } = props;

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [filter, setFilter] = useState<FilterChip>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority | "none">("all");
  const [sortBy, setSortBy] = useState<"priority" | "due" | "subject" | "status" | "created">("priority");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailAssignment = assignments.find((a) => a.id === detailId) ?? null;
  const [modal, setModal] = useState<CreateModalData>(() => emptyModalData(subjects));
  const [quickAddText, setQuickAddText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [ctxMenu, setCtxMenu] = useState<CalendarContextMenu>({ open: false, x: 0, y: 0, eventId: "", eventType: "" });
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu((p) => ({ ...p, open: false }));
      }
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (ctxMenu.open || filterOpen) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [ctxMenu.open, filterOpen]);

  const selectedIso = toIsoDate(selectedDate);
  const isToday = selectedIso === toIsoDate(today);

  const dayAssignments = useMemo(() => {
    let list = assignments.filter((a) => !!a.due && (a.due === selectedIso || (a.createdAt && a.createdAt.slice(0, 10) === selectedIso)));
    const todayStr = toIsoDate(today);
    if (filter === "pending") list = list.filter((a) => a.status !== "done");
    if (filter === "completed") list = list.filter((a) => a.status === "done");
    if (filter === "overdue") list = list.filter((a) => !!a.due && a.due < todayStr && a.status !== "done");
    if (subjectFilter !== "all") list = list.filter((a) => a.subjectId === subjectFilter);
    if (priorityFilter !== "all") {
      if (priorityFilter === "none") list = list.filter((a) => !a.priority);
      else list = list.filter((a) => a.priority === priorityFilter);
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case "priority": {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.priority ?? "medium"] - order[b.priority ?? "medium"]) || a.title.localeCompare(b.title);
        }
        case "due": return (a.due || "").localeCompare(b.due || "") || a.title.localeCompare(b.title);
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
  }, [assignments, selectedIso, filter, subjectFilter, priorityFilter, sortBy, subjects, today]);


  const dayClasses = useMemo(() =>
    events.filter((e) => {
      if (e.type !== "class" && e.type !== "custom") return false;
      if (e.date) return e.date === selectedIso;
      return dateToDayIndex(selectedIso) === e.dayIndex;
    }).sort((a, b) => a.start.localeCompare(b.start)),
  [events, selectedIso]);

  const totalTasks = dayAssignments.length;
  const completedTasks = dayAssignments.filter((a) => a.status === "done").length;
  const overdueTasks = dayAssignments.filter((a) => !!a.due && a.due < toIsoDate(today) && a.status !== "done").length;

  const [completedCollapsed, setCompletedCollapsed] = useState(false);

  const openCreateModal = useCallback((patch: Partial<CreateModalData>) => {
    setModal((prev) => ({ ...prev, open: true, ...patch }));
  }, []);

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleSaveModal = useCallback(() => {
    if (!modal.title.trim()) return;
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
    if (modal.mode === "event") {
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
      const taskPayload = {
        title: modal.title.trim(),
        due: date,
        subjectId: modal.subjectId,
        start: modal.isAllDay ? undefined : start,
        end: modal.isAllDay ? undefined : end,
      };
      if (modal.editingEventId && modal.editingEventId.startsWith("assignment-")) {
        const assignId = modal.editingEventId.replace("assignment-", "");
        updateAssignment(assignId, taskPayload);
      } else {
        addAssignment({
          ...taskPayload,
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
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
            <FullCalendarView
              events={events}
              selectedCalendar={selectedCalendar}
              weekStart={weekStart}
              updateCalendarEvent={updateCalendarEvent}
              deleteCalendarEvent={deleteCalendarEvent}
              updateAssignment={updateAssignment}
              deleteAssignment={deleteAssignment}
              updateExam={updateExam}
              assignments={assignments}
              onSelectDate={(date) => setSelectedDate(date)}
              onContextMenu={(eventId, eventType, x, y) => {
                setCtxMenu({ open: true, x, y, eventId, eventType });
              }}
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
                    startDate: toIsoDate(event.start),
                    startTime: timeFromDate(event.start),
                    endDate: toIsoDate(event.end),
                    endTime: timeFromDate(event.end),
                    isAllDay: event.category === "allday",
                    editingEventId: appId,
                  });
                } else if (appType === "assignment" && appId) {
                  const assign = assignments.find((a) => a.id === appId);
                  if (assign) {
                    const hasTime = !!assign.start && !!assign.end;
                    openCreateModal({
                      mode: "task",
                      title: assign.title,
                      subjectId: assign.subjectId,
                      location: "",
                      startDate: assign.due,
                      startTime: hasTime ? assign.start! : "00:00",
                      endDate: assign.due,
                      endTime: hasTime ? assign.end! : "23:59",
                      isAllDay: !hasTime,
                      editingEventId: `assignment-${assign.id}`,
                    });
                  }
                }
              }}
            />
            {ctxMenu.open && (
              <div ref={ctxRef} className="k-context-menu" style={{ top: ctxMenu.y, left: ctxMenu.x, position: "fixed", zIndex: 1000 }}>
                <button
                  className="k-context-item danger"
                  onClick={() => {
                    if (ctxMenu.eventType === "custom") deleteCalendarEvent(ctxMenu.eventId);
                    else if (ctxMenu.eventType === "assignment") deleteAssignment(ctxMenu.eventId);
                    setCtxMenu((p) => ({ ...p, open: false }));
                  }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, position: "relative" }}>
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
              <button
                className={`btn ${subjectFilter !== "all" || priorityFilter !== "all" ? "btn-primary" : ""}`}
                style={{ height: 28, padding: "0 10px", fontSize: "0.76rem" }}
                onClick={() => setFilterOpen((v) => !v)}
              >
                <SlidersHorizontal size={13} />
              </button>
            </div>
            {filterOpen && (
              <div ref={filterRef} className="filter-popover sidebar-filter" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, left: 0, zIndex: 100 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Filters</div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label className="field-label" style={{ fontSize: "0.72rem" }}>Subject</label>
                  <select className="select" style={{ fontSize: "0.78rem" }} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                    <option value="all">All subjects</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label className="field-label" style={{ fontSize: "0.72rem" }}>Priority</label>
                  <select className="select" style={{ fontSize: "0.78rem" }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as "all" | Priority | "none")}>
                    <option value="all">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="none">No priority</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" style={{ fontSize: "0.72rem" }}>Sort by</label>
                  <select className="select" style={{ fontSize: "0.78rem" }} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                    <option value="priority">Priority</option>
                    <option value="due">Due date</option>
                    <option value="subject">Subject</option>
                    <option value="status">Status</option>
                    <option value="created">Created</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Task list */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Deadlines / Tasks */}
            {dayAssignments.filter((a) => a.status !== "done").length > 0 && (
              <div>
                <div className="section-title" style={{ marginBottom: 6 }}>
                  <span>Tasks</span>
                  <span>{dayAssignments.filter((a) => a.status !== "done").length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayAssignments.filter((a) => a.status !== "done").map((a) => (
                    <TaskItem
                      key={a.id}
                      assignment={a}
                      subjects={subjects}
                      updateAssignment={updateAssignment}
                      deleteAssignment={deleteAssignment}
                      onOpenDetail={() => setDetailId(a.id)}
                      isOverdue={!!a.due && a.due < toIsoDate(today) && a.status !== "done"}
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

            {/* Completed */}
            {dayAssignments.filter((a) => a.status === "done").length > 0 && (
              <div>
                <button
                  className="section-title"
                  style={{ marginBottom: 6, background: "transparent", border: 0, width: "100%", cursor: "pointer", padding: 0 }}
                  onClick={() => setCompletedCollapsed((v) => !v)}
                >
                  <span>Completed</span>
                  <span>{dayAssignments.filter((a) => a.status === "done").length} {completedCollapsed ? "▸" : "▾"}</span>
                </button>
                {!completedCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {dayAssignments.filter((a) => a.status === "done").map((a) => (
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

            {dayAssignments.length === 0 && dayClasses.length === 0 && (
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
          onClick={(e) => { e.stopPropagation(); updateAssignment(assignment.id, { status: assignment.status === "done" ? "todo" : "done" }); }}
          title={assignment.status === "done" ? "Mark incomplete" : "Mark complete"}
        >
          {assignment.status === "done" ? <CheckCircle2 size={16} style={{ color: "var(--success)" }} /> : <Circle size={16} style={{ color: "var(--muted)" }} />}
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
            style={{ textDecoration: assignment.status === "done" ? "line-through" : "none", opacity: assignment.status === "done" ? 0.6 : 1 }}
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
      <div className="modal-content modal-task-create" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
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

function FullCalendarView({
  events, selectedCalendar, weekStart, updateCalendarEvent, deleteCalendarEvent,
  updateAssignment, deleteAssignment, updateExam, assignments,
  onSelectDate, onSelectDateTime, onClickEvent, onContextMenu,
}: {
  events: CalendarEvent[];
  selectedCalendar: AcademicOption;
  weekStart: Date;
  updateCalendarEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
  updateExam?: (id: string, patch: Partial<ExamRecord>) => void;
  assignments: Assignment[];
  onSelectDate?: (date: Date) => void;
  onSelectDateTime?: (start: Date, end: Date, isAllDay: boolean) => void;
  onClickEvent?: (event: any) => void;
  onContextMenu?: (eventId: string, eventType: string, x: number, y: number) => void;
}) {
  const calendarRef = useRef<FullCalendar>(null);
  const updateRef = useRef(updateCalendarEvent);
  const updateAssignRef = useRef(updateAssignment);
  const updateExamRef = useRef(updateExam);
  const clickEventRef = useRef(onClickEvent);
  const selectTimeRef = useRef(onSelectDateTime);
  const dateRef = useRef(onSelectDate);
  const ctxMenuRef = useRef(onContextMenu);

  updateRef.current = updateCalendarEvent;
  updateAssignRef.current = updateAssignment;
  updateExamRef.current = updateExam;
  clickEventRef.current = onClickEvent;
  selectTimeRef.current = onSelectDateTime;
  dateRef.current = onSelectDate;
  ctxMenuRef.current = onContextMenu;

  const fcEvents = useMemo(() => {
    return events.flatMap((event) => {
      const isRecurringClass = event.type === "class" && !event.date;
      const draggable = event.type === "custom" || event.type === "assignment" || event.type === "exam";
      return semesterClassDates(event, selectedCalendar).map((date) => {
        const id = isRecurringClass ? `${event.id}-${date}` : event.id;
        const isAllDay = event.type === "assignment" && event.start === "00:00";
        return {
          id,
          title: event.type === "class" ? `${event.code} · ${event.name}` : event.name,
          start: isAllDay ? `${date}T00:00:00` : `${date}T${event.start}:00`,
          end: isAllDay ? `${date}T23:59:00` : `${date}T${event.end}:00`,
          allDay: isAllDay,
          editable: draggable,
          startEditable: draggable,
          durationEditable: draggable && !isAllDay,
          backgroundColor: event.color,
          borderColor: event.color,
          textColor: "#ffffff",
          extendedProps: {
            appId: event.type === "assignment" ? event.id.replace("assignment-", "") : event.type === "exam" ? event.id.replace("exam-", "") : event.id,
            appType: event.type,
            appDate: date,
            code: event.code,
            venue: event.venue,
            subjectId: event.subjectId,
          },
        };
      });
    });
  }, [events, selectedCalendar]);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.gotoDate(weekStart);
  }, [weekStart]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    const e = info.event;
    clickEventRef.current?.({
      title: e.title,
      start: e.start ?? new Date(),
      end: e.end ?? new Date(),
      location: e.extendedProps.venue ?? "",
      calendarId: e.extendedProps.subjectId ?? "custom",
      category: e.allDay ? "allday" : "time",
      raw: { appId: e.extendedProps.appId, appType: e.extendedProps.appType },
    });
  }, []);

  const handleSelect = useCallback((info: DateSelectArg) => {
    selectTimeRef.current?.(info.start, info.end, info.allDay);
    info.view.calendar.unselect();
  }, []);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const appType = info.event.extendedProps.appType;
    const appId = info.event.extendedProps.appId;
    const start = info.event.start;
    const end = info.event.end;
    if (!start || !appId) { info.revert(); return; }
    const isAllDay = !!info.event.allDay;
    const dropDate = toIsoDate(start);

    if (appType === "custom") {
      updateRef.current(appId, {
        name: info.event.title,
        date: dropDate,
        dayIndex: dateToDayIndex(dropDate),
        start: isAllDay ? "00:00" : timeFromDate(start),
        end: isAllDay ? "23:59" : (end ? timeFromDate(end) : timeFromDate(start)),
        venue: info.event.extendedProps.venue ?? "",
        subjectId: info.event.extendedProps.subjectId,
      });
    } else if (appType === "assignment") {
      // Assignments dropped on the all-day strip become deadlines without specific times.
      // Assignments dropped on time slots adopt that time range.
      updateAssignRef.current(appId, {
        due: dropDate,
        start: isAllDay ? undefined : timeFromDate(start),
        end: isAllDay ? undefined : (end ? timeFromDate(end) : timeFromDate(start)),
      });
    } else if (appType === "exam") {
      // Exam model only stores a date — moving it across days updates the date.
      updateExamRef.current?.(appId, { date: dropDate });
    } else {
      info.revert();
    }
  }, []);

  const handleEventResize = useCallback((info: any) => {
    const appType = info.event.extendedProps.appType;
    const appId = info.event.extendedProps.appId;
    const start = info.event.start;
    const end = info.event.end;
    if (!start || !end || !appId) { info.revert(); return; }
    if (appType === "custom") {
      updateRef.current(appId, {
        name: info.event.title,
        date: toIsoDate(start),
        dayIndex: dateToDayIndex(toIsoDate(start)),
        start: timeFromDate(start),
        end: timeFromDate(end),
        venue: info.event.extendedProps.venue ?? "",
        subjectId: info.event.extendedProps.subjectId,
      });
    } else if (appType === "assignment") {
      updateAssignRef.current(appId, {
        due: toIsoDate(start),
        start: timeFromDate(start),
        end: timeFromDate(end),
      });
    } else {
      // exam resize would require time fields on the exam model
      info.revert();
    }
  }, []);

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    const el = info.el;
    const appType = info.event.extendedProps.appType as string;
    const appId = info.event.extendedProps.appId as string;
    if (!appId) return;
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      ctxMenuRef.current?.(appId, appType, e.clientX, e.clientY);
    };
    el.addEventListener("contextmenu", onCtx);
    // cleanup when the event element is removed is handled by FC automatically
  }, []);

  const handleDateClick = useCallback((info: { date: Date }) => {
    dateRef.current?.(info.date);
  }, []);

  return (
    <div className="fc-calendar-host" style={{ height: "100%" }}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={false}
        firstDay={1}
        slotMinTime={`${String(HOUR_START).padStart(2, "0")}:00:00`}
        slotMaxTime={`${String(HOUR_END).padStart(2, "0")}:00:00`}
        editable={true}
        eventResizableFromStart={true}
        selectable={true}
        selectMirror={true}
        allDaySlot={true}
        slotDuration="00:30:00"
        height="100%"
        events={fcEvents}
        eventClick={handleEventClick}
        select={handleSelect}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventDidMount={handleEventDidMount}
        dateClick={handleDateClick}
        nowIndicator={true}
        scrollTime={`${String(new Date().getHours()).padStart(2, "0")}:00:00`}
      />
    </div>
  );
}
