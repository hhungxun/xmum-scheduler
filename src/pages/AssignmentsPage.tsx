import { useState, useMemo, memo, useCallback } from "react";
import {
  Trash2, Paperclip, FileText, Search, X, Calendar, SlidersHorizontal,
  ArrowUpDown, Layers, LayoutGrid, List, Columns, Plus,
} from "lucide-react";
import type { Subject, Assignment, Status, MoodleFile, AcademicOption, Priority } from "../types";
import { statusLabels, toIsoDate, moodleFileKey, localAssetHref } from "../lib/utils";

/* ─── Filter types ─── */
type FilterCondition = "is" | "is_not" | "contains" | "before" | "after" | "on_or_before" | "on_or_after" | "greater_than" | "less_than";
type FilterProperty = "title" | "course" | "status" | "due" | "weight" | "hasAttachment" | "priority";
type SortProperty = "due" | "weight" | "title" | "created" | "priority";
type GroupProperty = "status" | "course" | "priority" | "dueRange";
type ViewLayout = "list" | "board" | "table";
type View = { id: string; name: string; filters: FilterRule[]; sorts: SortRule[]; group: GroupProperty | null; layout: ViewLayout; };

interface FilterRule { id: string; property: FilterProperty; condition: FilterCondition; value: string; }
interface SortRule { id: string; property: SortProperty; direction: "asc" | "desc"; }

const SAVED_VIEWS_KEY = "xmum.v3.assignmentViews";

function loadViews(): View[] {
  try { const raw = localStorage.getItem(SAVED_VIEWS_KEY); return raw ? JSON.parse(raw) : defaultViews(); }
  catch { return defaultViews(); }
}
function defaultViews(): View[] {
  return [
    { id: "all", name: "All", filters: [], sorts: [{ id: "s0", property: "due", direction: "asc" }], group: null, layout: "list" },
    { id: "due-soon", name: "Due soon", filters: [{ id: "f0", property: "due", condition: "on_or_before", value: toIsoDate(new Date(Date.now() + 7 * 86400000)) }], sorts: [{ id: "s0", property: "due", direction: "asc" }], group: "status", layout: "board" },
    { id: "completed", name: "Completed", filters: [{ id: "f0", property: "status", condition: "is", value: "graded" }], sorts: [{ id: "s0", property: "due", direction: "desc" }], group: "course", layout: "board" },
    { id: "this-week", name: "This week", filters: [{ id: "f0", property: "due", condition: "on_or_before", value: toIsoDate(new Date(Date.now() + 7 * 86400000)) }], sorts: [{ id: "s0", property: "due", direction: "asc" }], group: null, layout: "list" },
  ];
}
function saveViews(views: View[]) { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views)); }

const CONDITION_LABELS: Record<FilterCondition, string> = {
  is: "is", is_not: "is not", contains: "contains", before: "before", after: "after",
  on_or_before: "on or before", on_or_after: "on or after",
  greater_than: "greater than", less_than: "less than",
};
const PROPERTY_LABELS: Record<FilterProperty, string> = {
  title: "Title", course: "Course", status: "Status", due: "Due date", weight: "Weight", hasAttachment: "Has attachment", priority: "Priority",
};
const CONDITION_OPTIONS: Record<FilterProperty, FilterCondition[]> = {
  title: ["contains", "is"],
  course: ["is", "is_not"],
  status: ["is", "is_not"],
  due: ["is", "before", "after", "on_or_before", "on_or_after"],
  weight: ["is", "greater_than", "less_than"],
  hasAttachment: ["is"],
  priority: ["is", "is_not"],
};

const priorityLabels: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };
const priorityOrder: Priority[] = ["high", "medium", "low"];

function hexToRgba(hex: string, alpha: number): string {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function dueRangeLabel(due: string): string {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(`${due}T00:00:00`);
  const diff = Math.floor((+d - +today) / 86400000);
  if (diff < 0) return "Overdue";
  if (diff <= 1) return "Today";
  if (diff <= 7) return "This week";
  if (diff <= 14) return "Next week";
  return "Later";
}

function dueRangeOrder(label: string): number {
  const map: Record<string, number> = { "Overdue": 0, "Today": 1, "This week": 2, "Next week": 3, "Later": 4 };
  return map[label] ?? 5;
}

function applyFilters(assignments: Assignment[], rules: FilterRule[], subjects: Subject[], moodleFiles: MoodleFile[]): Assignment[] {
  return assignments.filter((a) => {
    const subj = subjects.find((s) => s.id === a.subjectId);
    return rules.every((rule) => {
      switch (rule.property) {
        case "title": {
          const haystack = a.title.toLowerCase();
          const needle = rule.value.toLowerCase();
          if (rule.condition === "contains") return haystack.includes(needle);
          if (rule.condition === "is") return haystack === needle;
          return true;
        }
        case "course":
          if (rule.condition === "is") return a.subjectId === rule.value;
          if (rule.condition === "is_not") return a.subjectId !== rule.value;
          return true;
        case "status":
          if (rule.condition === "is") return a.status === rule.value;
          if (rule.condition === "is_not") return a.status !== rule.value;
          return true;
        case "priority":
          if (rule.condition === "is") return (a.priority ?? "medium") === rule.value;
          if (rule.condition === "is_not") return (a.priority ?? "medium") !== rule.value;
          return true;
        case "due":
          if (!rule.value) return true;
          if (rule.condition === "before") return a.due < rule.value;
          if (rule.condition === "after") return a.due > rule.value;
          if (rule.condition === "on_or_before") return a.due <= rule.value;
          if (rule.condition === "on_or_after") return a.due >= rule.value;
          return a.due === rule.value;
        case "weight": {
          const w = Number(rule.value);
          if (rule.condition === "is") return a.weight === w;
          if (rule.condition === "greater_than") return a.weight > w;
          if (rule.condition === "less_than") return a.weight < w;
          return true;
        }
        case "hasAttachment": {
          const has = (a.relatedFileIds?.length ?? 0) > 0;
          return rule.value === "true" ? has : !has;
        }
        default: return true;
      }
    });
  });
}

function applySorts(list: Assignment[], sorts: SortRule[]): Assignment[] {
  const items = [...list];
  for (const sort of [...sorts].reverse()) {
    items.sort((a, b) => {
      let cmp = 0;
      switch (sort.property) {
        case "due": cmp = a.due.localeCompare(b.due); break;
        case "weight": cmp = a.weight - b.weight; break;
        case "title": cmp = a.title.localeCompare(b.title); break;
        case "created": cmp = (a.createdAt ?? a.id).localeCompare(b.createdAt ?? b.id); break;
        case "priority": cmp = priorityOrder.indexOf(a.priority ?? "medium") - priorityOrder.indexOf(b.priority ?? "medium"); break;
      }
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }
  return items;
}

export function AssignmentsPage({
  subjects, assignments, activeSubject, activeSubjectId, activeAssignments,
  addAssignment, updateAssignment, toggleAssignmentFile, deleteAssignment, moodleFiles,
  selectedCalendar,
}: {
  subjects: Subject[]; assignments: Assignment[];
  activeSubject?: Subject; activeSubjectId: string;
  activeAssignments: Assignment[];
  addAssignment: (input: { title: string; subjectId: string; due: string; weight: number; description: string; relatedFileIds: string[]; status?: Status; priority?: Priority }) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  toggleAssignmentFile: (id: string, fileId: string) => void;
  deleteAssignment: (id: string) => void;
  moodleFiles: MoodleFile[];
  selectedCalendar: AcademicOption;
}) {
  const defaultSubjectId = activeSubjectId || activeSubject?.id || subjects[0]?.id || "";
  const [draggingId, setDraggingId] = useState("");
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [views, setViews] = useState<View[]>(loadViews);
  const [activeViewId, setActiveViewId] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const activeView = views.find((v) => v.id === activeViewId) ?? views[0];

  function updateView(id: string, patch: Partial<View>) {
    setViews((prev) => {
      const next = prev.map((v) => v.id === id ? { ...v, ...patch } : v);
      saveViews(next);
      return next;
    });
  }

  function updateFilters(rules: FilterRule[]) { updateView(activeView.id, { filters: rules }); }
  function updateSorts(rules: SortRule[]) { updateView(activeView.id, { sorts: rules }); }
  function updateGroup(g: GroupProperty | null) { updateView(activeView.id, { group: g }); }
  function updateLayout(l: ViewLayout) { updateView(activeView.id, { layout: l }); }

  if (!subjects.length) {
    return <div className="card"><div className="empty">No subjects yet. Import a timetable in Settings or pick from Moodle first.</div></div>;
  }

  const filtered = useMemo(() => {
    let list = applyFilters(activeAssignments, activeView.filters ?? [], subjects, moodleFiles);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    return applySorts(list, activeView.sorts ?? []);
  }, [activeAssignments, activeView.filters, activeView.sorts, query, subjects, moodleFiles]);

  const groups = useMemo(() => {
    if (!activeView.group) return null;
    const map = new Map<string, Assignment[]>();
    for (const a of filtered) {
      let key: string;
      switch (activeView.group) {
        case "course": key = subjects.find((s) => s.id === a.subjectId)?.code ?? "No course"; break;
        case "status": key = statusLabels[a.status]; break;
        case "priority": key = priorityLabels[a.priority ?? "medium"]; break;
        case "dueRange": key = dueRangeLabel(a.due); break;
        default: key = "Other";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    const entries = Array.from(map.entries());
    if (activeView.group === "priority") {
      entries.sort((a, b) => priorityOrder.indexOf((Object.keys(priorityLabels) as Priority[]).find((k) => priorityLabels[k] === a[0]) ?? "medium") - priorityOrder.indexOf((Object.keys(priorityLabels) as Priority[]).find((k) => priorityLabels[k] === b[0]) ?? "medium"));
    } else if (activeView.group === "dueRange") {
      entries.sort((a, b) => dueRangeOrder(a[0]) - dueRangeOrder(b[0]));
    }
    return entries;
  }, [filtered, activeView.group, subjects]);

  const hasActiveFilters = (activeView.filters?.length ?? 0) > 0 || query.trim() !== "";

  const layoutIcon: Record<ViewLayout, React.ReactNode> = {
    list: <List size={14} />,
    board: <LayoutGrid size={14} />,
    table: <Columns size={14} />,
  };

  return (
    <div className="assignments-page">
      {/* Toolbar */}
      <div className="card" style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="tag" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={12} /> {selectedCalendar.semester}
          </span>

          {/* Search */}
          <div className="row" style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 8, color: "var(--muted)", pointerEvents: "none" }} />
            <input className="input" style={{ paddingLeft: 28, minWidth: 160 }} placeholder="Search tasks…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <button className="btn btn-ghost" style={{ position: "absolute", right: 2, padding: 4 }} onClick={() => setQuery("")}><X size={12} /></button>}
          </div>

          {/* Filter button */}
          <div style={{ position: "relative" }}>
            <button className={`btn ${(activeView.filters?.length ?? 0) > 0 ? "btn-primary" : ""}`} onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false); setGroupOpen(false); }}>
              <SlidersHorizontal size={13} /> Filter{(activeView.filters?.length ?? 0) > 0 ? ` (${activeView.filters!.length})` : ""}
            </button>
            {filterOpen && <FilterPopover filters={activeView.filters ?? []} subjects={subjects} onChange={updateFilters} onClose={() => setFilterOpen(false)} />}
          </div>

          {/* Sort button */}
          <div style={{ position: "relative" }}>
            <button className="btn" onClick={() => { setSortOpen(!sortOpen); setFilterOpen(false); setGroupOpen(false); }}>
              <ArrowUpDown size={13} /> Sort
            </button>
            {sortOpen && <SortPopover sorts={activeView.sorts ?? []} onChange={updateSorts} onClose={() => setSortOpen(false)} />}
          </div>

          {/* Group button */}
          <div style={{ position: "relative" }}>
            <button className="btn" onClick={() => { setGroupOpen(!groupOpen); setFilterOpen(false); setSortOpen(false); }}>
              <Layers size={13} /> {activeView.group ? "Grouped" : "Group"}
            </button>
            {groupOpen && <GroupPopover group={activeView.group ?? null} onChange={updateGroup} onClose={() => setGroupOpen(false)} />}
          </div>

          {/* Layout toggle */}
          <div className="row" style={{ gap: 4 }}>
            {(["list", "board", "table"] as ViewLayout[]).map((l) => (
              <button key={l} className={`btn ${activeView.layout === l ? "btn-primary" : ""}`} onClick={() => updateLayout(l)} title={l}>
                {layoutIcon[l]}
              </button>
            ))}
          </div>
        </div>

        {/* View tabs */}
        <div className="row" style={{ gap: 4 }}>
          {views.map((v) => (
            <button key={v.id} className={`btn ${v.id === activeViewId ? "btn-primary" : ""}`} onClick={() => setActiveViewId(v.id)}>
              {v.name}
            </button>
          ))}
        </div>

        <div className="muted" style={{ fontSize: "0.78rem" }}>{filtered.length} task{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
          {(activeView.filters ?? []).map((rule) => {
            const labelText = PROPERTY_LABELS[rule.property] + " " + CONDITION_LABELS[rule.condition] + " " + formatFilterValue(rule, subjects);
            return (
              <span key={rule.id} className="file-chip" style={{ gap: 4 }}>
                <span style={{ fontSize: "0.78rem" }}>{labelText}</span>
                <button type="button" className="file-chip-x" onClick={() => updateFilters(activeView.filters!.filter((r) => r.id !== rule.id))}><X size={10} /></button>
              </span>
            );
          })}
          {query && (
            <span className="file-chip" style={{ gap: 4 }}>
              <span style={{ fontSize: "0.78rem" }}>Search: {query}</span>
              <button type="button" className="file-chip-x" onClick={() => setQuery("")}><X size={10} /></button>
            </span>
          )}
          <button className="btn btn-ghost" style={{ fontSize: "0.76rem", height: 28 }} onClick={() => { setQuery(""); updateFilters([]); }}>
            Clear all
          </button>
        </div>
      )}

      {/* List layout */}
      {activeView.layout === "list" && (
        <div className="grid" style={{ gap: 8, overflowY: "auto", minHeight: 0, flex: 1 }}>
          {filtered.length === 0 ? (
            <div className="empty">No assignments match these filters.</div>
          ) : (
            filtered.map((a) => {
              const subj = subjects.find((s) => s.id === a.subjectId);
              const subjColor = subj?.color ?? "#888888";
              return (
                <div key={a.id} className="agenda-row" style={{ gridTemplateColumns: "auto 1fr auto auto auto auto auto", cursor: "pointer" }} onClick={() => setDetailId(a.id)}>
                  <span className="agenda-dot" style={{ background: subjColor }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{a.title}</span>
                  <span className="tag" style={{ background: hexToRgba(subjColor, 0.15), color: subjColor, border: `1px solid ${hexToRgba(subjColor, 0.3)}`, fontSize: "0.76rem" }}>{subj?.code ?? "—"}</span>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>{a.due}</span>
                  <span className="tag" style={{ fontSize: "0.76rem" }}>{statusLabels[a.status]}</span>
                  <span className="muted" style={{ fontSize: "0.78rem" }}>{a.weight}%</span>
                  <button className="btn btn-ghost btn-danger" style={{ height: 28, padding: "0 6px" }} onClick={(e) => { e.stopPropagation(); deleteAssignment(a.id); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Board layout */}
      {activeView.layout === "board" && (
        <div className="kanban">
          {groups ? (
            groups.map(([groupName, groupItems]) => (
              <KanbanColumn key={groupName} title={groupName} count={groupItems.length}
                items={groupItems} subjects={subjects} moodleFiles={moodleFiles}
                draggingId={draggingId} setDraggingId={setDraggingId}
                dragOverCol={dragOverCol} setDragOverCol={setDragOverCol}
                updateAssignment={updateAssignment} toggleAssignmentFile={toggleAssignmentFile}
                deleteAssignment={deleteAssignment}
                addAssignment={addAssignment} activeSubjectId={activeSubjectId} defaultSubjectId={defaultSubjectId}
                onOpenDetail={setDetailId}
              />
            ))
          ) : (
            (Object.keys(statusLabels) as Status[]).map((status) => {
              const items = filtered.filter((a) => a.status === status);
              return (
                <KanbanColumn key={status} title={statusLabels[status]} count={items.length}
                  items={items} subjects={subjects} moodleFiles={moodleFiles}
                  draggingId={draggingId} setDraggingId={setDraggingId}
                  dragOverCol={dragOverCol} setDragOverCol={setDragOverCol}
                  updateAssignment={updateAssignment} toggleAssignmentFile={toggleAssignmentFile}
                  deleteAssignment={deleteAssignment}
                  addAssignment={addAssignment} activeSubjectId={activeSubjectId} defaultSubjectId={defaultSubjectId}
                  statusOverride={status}
                  onOpenDetail={setDetailId}
                />
              );
            })
          )}
          {filtered.length === 0 && <div className="empty">No assignments match these filters.</div>}
        </div>
      )}

      {/* Table layout */}
      {activeView.layout === "table" && (
        <div className="card" style={{ padding: 0, overflow: "hidden", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 100px 80px 80px 80px 40px", gap: 0, padding: "8px 12px", borderBottom: "1px solid var(--line)", fontWeight: 600, fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>Title</span><span>Course</span><span>Due</span><span>Weight</span><span>Status</span><span>Files</span>
          </div>
          {filtered.map((a) => {
            const subj = subjects.find((s) => s.id === a.subjectId);
            const subjColor = subj?.color ?? "#888888";
            return (
              <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1fr auto 100px 80px 80px 80px 40px", gap: 0, padding: "10px 12px", borderBottom: "1px solid var(--line)", alignItems: "center", fontSize: "0.86rem", cursor: "pointer" }} onClick={() => setDetailId(a.id)}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                <span className="tag" style={{ background: hexToRgba(subjColor, 0.15), color: subjColor, border: `1px solid ${hexToRgba(subjColor, 0.3)}`, fontSize: "0.78rem" }}>{subj?.code ?? "—"}</span>
                <span className="muted">{a.due}</span>
                <span className="muted">{a.weight}%</span>
                <span className="tag">{statusLabels[a.status]}</span>
                <span className="muted">{(a.relatedFileIds?.length ?? 0) > 0 ? <Paperclip size={12} /> : "—"}</span>
                <button className="btn btn-ghost btn-danger" style={{ height: 28, padding: "0 6px" }} onClick={(e) => { e.stopPropagation(); deleteAssignment(a.id); }}>
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty">No assignments match these filters.</div>}
        </div>
      )}

      {/* Detail panel */}
      {detailId && (
        <AssignmentDetailPanel
          assignment={filtered.find((a) => a.id === detailId) ?? null}
          subjects={subjects}
          moodleFiles={moodleFiles}
          onClose={() => setDetailId(null)}
          updateAssignment={updateAssignment}
          toggleAssignmentFile={toggleAssignmentFile}
          deleteAssignment={deleteAssignment}
        />
      )}
    </div>
  );
}

function KanbanColumn({ title, count, items, subjects, moodleFiles, draggingId, setDraggingId, dragOverCol, setDragOverCol, updateAssignment, toggleAssignmentFile, deleteAssignment, addAssignment, activeSubjectId, defaultSubjectId, statusOverride, onOpenDetail }: {
  title: string; count: number; items: Assignment[]; subjects: Subject[]; moodleFiles: MoodleFile[];
  draggingId: string; setDraggingId: (id: string) => void;
  dragOverCol: string | null; setDragOverCol: (id: string | null | ((prev: string | null) => string | null)) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  toggleAssignmentFile: (id: string, fileId: string) => void;
  deleteAssignment: (id: string) => void;
  addAssignment: (input: { title: string; subjectId: string; due: string; weight: number; description: string; relatedFileIds: string[]; status?: Status; priority?: Priority }) => void;
  activeSubjectId: string; defaultSubjectId: string; statusOverride?: Status;
  onOpenDetail: (id: string) => void;
}) {
  const isOver = dragOverCol === title;
  return (
    <div className={`kanban-col ${isOver ? "drag-over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOverCol(title); }}
      onDragLeave={() => setDragOverCol((prev) => prev === title ? null : prev)}
      onDrop={() => { if (draggingId) updateAssignment(draggingId, { status: statusOverride ?? "todo" }); setDraggingId(""); setDragOverCol(null); }}
    >
      <h3><span>{title}</span><span>{count}</span></h3>
      {items.map((a) => (
        <KanbanCard key={a.id} assignment={a} subjects={subjects} moodleFiles={moodleFiles}
          updateAssignment={updateAssignment} toggleAssignmentFile={toggleAssignmentFile}
          deleteAssignment={deleteAssignment} onDragStart={() => setDraggingId(a.id)} onDragEnd={() => setDraggingId("")}
          onClick={() => onOpenDetail(a.id)} />
      ))}
      {!items.length && <div className="drop-empty">No tasks</div>}
      <button className="kanban-add-task" onClick={() => addAssignment({ title: "Untitled", subjectId: activeSubjectId || defaultSubjectId, due: toIsoDate(new Date()), weight: 0, description: "", relatedFileIds: [], status: statusOverride ?? "todo", priority: "medium" })}>
        <Plus size={12} /> Add task
      </button>
    </div>
  );
}

function KanbanCard({ assignment, subjects, moodleFiles, updateAssignment, toggleAssignmentFile, deleteAssignment, onDragStart, onDragEnd, onClick }: {
  assignment: Assignment; subjects: Subject[]; moodleFiles: MoodleFile[];
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  toggleAssignmentFile: (id: string, fileId: string) => void;
  deleteAssignment: (id: string) => void;
  onDragStart: () => void; onDragEnd: () => void; onClick: () => void;
}) {
  const subject = subjects.find((s) => s.id === assignment.subjectId);
  const hasFiles = (assignment.relatedFileIds?.length ?? 0) > 0;
  const priority = assignment.priority ?? "medium";
  const priorityColor = priority === "high" ? "#dc2626" : priority === "low" ? "#6b7280" : "#f59e0b";

  return (
    <div className="task" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onClick}>
      <div className="task-head">
        <span className="agenda-dot" style={{ background: subject?.color ?? "var(--accent)" }} />
        <span style={{ fontWeight: 600, fontSize: "0.86rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assignment.title}</span>
      </div>
      <div className="task-meta">
        <span className="task-tag" style={{ background: hexToRgba(subject?.color ?? "#888", 0.12), color: subject?.color ?? "#888", borderColor: hexToRgba(subject?.color ?? "#888", 0.25) }}>{subject?.code ?? "—"}</span>
        <span className="task-tag">{assignment.due}</span>
        <span className="task-tag" style={{ color: priorityColor, borderColor: hexToRgba(priorityColor, 0.3), background: hexToRgba(priorityColor, 0.1) }}>{priorityLabels[priority]}</span>
        {hasFiles && <Paperclip size={11} className="muted" />}
      </div>
    </div>
  );
}

function AssignmentDetailPanel({ assignment, subjects, moodleFiles, onClose, updateAssignment, toggleAssignmentFile, deleteAssignment }: {
  assignment: Assignment | null;
  subjects: Subject[];
  moodleFiles: MoodleFile[];
  onClose: () => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  toggleAssignmentFile: (id: string, fileId: string) => void;
  deleteAssignment: (id: string) => void;
}) {
  if (!assignment) return null;
  const related = new Set(assignment.relatedFileIds ?? []);
  const subject = subjects.find((s) => s.id === assignment.subjectId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
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
                {(Object.keys(priorityLabels) as Priority[]).map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
              </select>
            </div>
          </div>
          <textarea className="textarea" style={{ minHeight: 60, fontSize: "0.84rem" }} value={assignment.description} onChange={(e) => updateAssignment(assignment.id, { description: e.target.value })} placeholder="Notes…" />
          <MoodleFilePicker files={moodleFiles} selectedIds={related} onToggle={(fileId) => toggleAssignmentFile(assignment.id, fileId)} compact />
          <RelatedFileLinks files={moodleFiles} selectedIds={related} />
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-ghost btn-danger" onClick={() => { deleteAssignment(assignment.id); onClose(); }}><Trash2 size={14} /> Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFilterValue(rule: FilterRule, subjects: Subject[]): string {
  if (rule.property === "course") {
    const s = subjects.find((x) => x.id === rule.value);
    return s?.code ?? rule.value;
  }
  if (rule.property === "status") return statusLabels[rule.value as Status] ?? rule.value;
  if (rule.property === "priority") return priorityLabels[rule.value as Priority] ?? rule.value;
  return rule.value;
}

/* ─── Filter popover ─── */
function FilterPopover({ filters, subjects, onChange, onClose }: { filters: FilterRule[]; subjects: Subject[]; onChange: (rules: FilterRule[]) => void; onClose: () => void }) {
  function addFilter() {
    const id = "f" + Math.random().toString(36).slice(2, 6);
    onChange([...filters, { id, property: "status", condition: "is", value: "todo" }]);
  }
  function updateRule(id: string, patch: Partial<FilterRule>) {
    onChange(filters.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  function removeRule(id: string) { onChange(filters.filter((r) => r.id !== id)); }

  return (
    <div className="filter-popover">
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Filters</div>
      {filters.map((rule) => (
        <div key={rule.id} className="row" style={{ gap: 6, marginBottom: 6 }}>
          <select className="select" style={{ minWidth: 100 }} value={rule.property} onChange={(e) => updateRule(rule.id, { property: e.target.value as FilterProperty, value: "" })}>
            {Object.entries(PROPERTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="select" style={{ minWidth: 110 }} value={rule.condition} onChange={(e) => updateRule(rule.id, { condition: e.target.value as FilterCondition })}>
            {(CONDITION_OPTIONS[rule.property] ?? ["is"]).map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
          </select>
          {rule.property === "course" ? (
            <select className="select" style={{ minWidth: 100 }} value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })}>
              <option value="">Select…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          ) : rule.property === "status" ? (
            <select className="select" style={{ minWidth: 100 }} value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })}>
              {(Object.keys(statusLabels) as Status[]).map((k) => <option key={k} value={k}>{statusLabels[k]}</option>)}
            </select>
          ) : rule.property === "priority" ? (
            <select className="select" style={{ minWidth: 100 }} value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })}>
              {(Object.keys(priorityLabels) as Priority[]).map((k) => <option key={k} value={k}>{priorityLabels[k]}</option>)}
            </select>
          ) : rule.property === "hasAttachment" ? (
            <select className="select" style={{ minWidth: 100 }} value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : rule.property === "due" ? (
            <input className="input" type="date" style={{ minWidth: 140 }} value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })} />
          ) : (
            <input className="input" style={{ minWidth: 120 }} value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })} placeholder="Value…" />
          )}
          <button className="btn btn-ghost btn-danger" onClick={() => removeRule(rule.id)} style={{ height: 30, padding: "0 6px" }}><X size={12} /></button>
        </div>
      ))}
      <button className="btn" onClick={addFilter}><Plus size={12} /> Add filter</button>
    </div>
  );
}

/* ─── Sort popover ─── */
function SortPopover({ sorts, onChange, onClose }: { sorts: SortRule[]; onChange: (rules: SortRule[]) => void; onClose: () => void }) {
  function addSort() {
    const id = "s" + Math.random().toString(36).slice(2, 6);
    onChange([...sorts, { id, property: "due", direction: "asc" }]);
  }
  function updateRule(id: string, patch: Partial<SortRule>) {
    onChange(sorts.map((r) => r.id === id ? { ...r, ...patch } : r));
  }
  function removeRule(id: string) { onChange(sorts.filter((r) => r.id !== id)); }

  return (
    <div className="filter-popover" style={{ minWidth: 240 }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Sort</div>
      {sorts.map((rule) => (
        <div key={rule.id} className="row" style={{ gap: 6, marginBottom: 6 }}>
          <select className="select" style={{ minWidth: 100 }} value={rule.property} onChange={(e) => updateRule(rule.id, { property: e.target.value as SortProperty })}>
            <option value="due">Due date</option>
            <option value="weight">Weight</option>
            <option value="title">Title</option>
            <option value="created">Created</option>
            <option value="priority">Priority</option>
          </select>
          <select className="select" style={{ minWidth: 100 }} value={rule.direction} onChange={(e) => updateRule(rule.id, { direction: e.target.value as "asc" | "desc" })}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <button className="btn btn-ghost btn-danger" onClick={() => removeRule(rule.id)} style={{ height: 30, padding: "0 6px" }}><X size={12} /></button>
        </div>
      ))}
      <button className="btn" onClick={addSort}><Plus size={12} /> Add sort</button>
    </div>
  );
}

/* ─── Group popover ─── */
function GroupPopover({ group, onChange, onClose }: { group: GroupProperty | null; onChange: (g: GroupProperty | null) => void; onClose: () => void }) {
  return (
    <div className="filter-popover" style={{ minWidth: 180 }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Group by</div>
      <button className="btn" onClick={() => { onChange(null); onClose(); }} style={{ width: "100%", justifyContent: "flex-start", marginBottom: 4 }}>None</button>
      <button className="btn" onClick={() => { onChange("status"); onClose(); }} style={{ width: "100%", justifyContent: "flex-start", marginBottom: 4 }}>Status</button>
      <button className="btn" onClick={() => { onChange("course"); onClose(); }} style={{ width: "100%", justifyContent: "flex-start", marginBottom: 4 }}>Course</button>
      <button className="btn" onClick={() => { onChange("priority"); onClose(); }} style={{ width: "100%", justifyContent: "flex-start", marginBottom: 4 }}>Priority</button>
      <button className="btn" onClick={() => { onChange("dueRange"); onClose(); }} style={{ width: "100%", justifyContent: "flex-start" }}>Due date range</button>
    </div>
  );
}

function MoodleFilePicker({ files, selectedIds, onToggle, compact }: { files: MoodleFile[]; selectedIds: Set<string>; onToggle: (fileId: string) => void; compact?: boolean }) {
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
        <a key={moodleFileKey(file)} href={localAssetHref(file.localUrl ?? file.fileurl)} target="_blank" rel="noreferrer">
          <FileText size={12} /> {file.filename}
        </a>
      ))}
    </div>
  );
}
