import { useEffect, useMemo, useState } from "react";
import type {
  Page, Theme, CalendarEvent, Subject, Assignment, ExamRecord,
  ChatMessage, AcademicOption, MoodleState, AISettings, AIProvider, Note, NoteFolder, Status, ExamKind, MoodleFile,
  SemesterData, Conversation, UserProfile,
} from "./types";
import { usePersistentState } from "./hooks/usePersistentState";
import { useToast, ToastProvider } from "./hooks/useToast";
import { api } from "./lib/api";
import { defaultSemesterData, migrateLegacySemesters } from "./lib/semester";
import {
  uid, toIsoDate, dateToDayIndex, startOfWeek, addDays, isSameDay, todayDayIndex,
  nextColor, makeNote, makeSubjectFromMoodle, palette, parseTimetable,
  statusLabels, examKindLabels, localAssetHref, moodleFileKey, readAsDataUrl,
} from "./lib/utils";
import { buildSystemContext } from "./lib/aiContext";
import { extractActions, stripActionBlocks } from "./lib/aiActions";
import type { AIAction } from "./lib/aiActions";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { CalendarPage } from "./pages/CalendarPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { ExamsPage } from "./pages/ExamsPage";
import { MoodlePage } from "./pages/MoodlePage";
import { SettingsPage } from "./pages/SettingsPage";
import { Onboarding } from "./pages/Onboarding";
import bundledTimetableHtml from "../202604 Semester Timetable.html?raw";

const fallbackAcademicOptions: AcademicOption[] = [
  { id: "ug-apr-2026", track: "undergraduate", label: "Undergraduate Students", semester: "April Semester", startDate: "2026-04-03", endDate: "2026-07-31", sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg" },
  { id: "ug-feb-2026", track: "undergraduate", label: "Undergraduate Students", semester: "February Semester", startDate: "2026-02-20", endDate: "2026-04-03", sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg" },
  { id: "ug-sep-2026", track: "undergraduate", label: "Undergraduate Students", semester: "September Semester", startDate: "2026-09-25", endDate: "2027-01-21", sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg" },
  { id: "foundation-apr-2026-s1", track: "foundation", label: "Foundation Students", intake: "April 2026 Intake", semester: "Semester 1", startDate: "2026-04-01", endDate: "2026-07-31", sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-12/Academic%20Calendar%20%28April%202026%20Intake%29.jpg" },
];

function AppShell() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}

function App() {
  const [theme, setTheme] = usePersistentState<Theme>("xmum.v3.theme", "light");
  const [page, setPage] = usePersistentState<Page>("xmum.v3.page", "dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState("xmum.v3.sidebarCollapsed", false);

  const [semesters, setSemesters] = usePersistentState<Record<string, SemesterData>>("xmum.v3.semesters", migrateLegacySemesters());
  const [selectedCalendarId, setSelectedCalendarId] = usePersistentState<string>("xmum.v3.calendarId", "ug-apr-2026");

  const [aiSettings, setAISettings] = usePersistentState<AISettings>("xmum.v3.aiSettings", {
    provider: "codex-cli",
    apiKey: "",
    cliCommand: "codex",
    model: "",
  });

  // Conversations are persisted; active conversation is NOT (starts fresh every load)
  const [conversations, setConversations] = usePersistentState<Record<string, Conversation>>("xmum.v3.conversations", {});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [moodle, setMoodle] = usePersistentState<MoodleState>("xmum.v3.moodle", {
    username: "", token: "", siteUser: "",
    connected: false, loading: false, lastSync: "",
    catalog: [], selectedCourseIds: [], courses: [], files: [], error: "",
  });

  const [userProfile, setUserProfile] = usePersistentState<UserProfile>("xmum.v3.userProfile", {
    displayName: "",
    avatarUrl: "",
    onboardingComplete: false,
  });

  const [calendarOptions, setCalendarOptions] = useState<AcademicOption[]>(fallbackAcademicOptions);
  const [track, setTrack] = useState<"undergraduate" | "foundation">("undergraduate");
  const [foundationIntake, setFoundationIntake] = useState("April 2026 Intake");
  const [timetablePreview, setTimetablePreview] = useState<import("./types").ParsedClass[]>([]);
  const [calendarFetchError, setCalendarFetchError] = useState("");
  const [moodlePassword, setMoodlePassword] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [knowledgeSyncStatus, setKnowledgeSyncStatus] = useState("");
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  useEffect(() => {
    api<{ options: AcademicOption[] }>("/academic-calendar")
      .then((payload) => { if (payload.options.length) setCalendarOptions(payload.options); })
      .catch((err: Error) => setCalendarFetchError(err.message));
  }, []);

  function getCurrent(): SemesterData {
    return semesters[selectedCalendarId] ?? defaultSemesterData();
  }

  function setCurrent(patch: Partial<SemesterData> | ((data: SemesterData) => SemesterData)) {
    setSemesters(prev => {
      const current = prev[selectedCalendarId] ?? defaultSemesterData();
      const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      return { ...prev, [selectedCalendarId]: next };
    });
  }

  const current = getCurrent();
  const subjects = current.subjects;
  const events = current.events;
  const assignments = current.assignments;
  const exams = current.exams;
  const activeSubjectId = current.activeSubjectId;
  const activeNoteId = current.activeNoteId;
  const activeFolderId = current.activeFolderId;

  function setSubjects(next: Subject[] | ((prev: Subject[]) => Subject[])) {
    setCurrent(data => ({ ...data, subjects: typeof next === "function" ? next(data.subjects) : next }));
  }
  function setEvents(next: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) {
    setCurrent(data => ({ ...data, events: typeof next === "function" ? next(data.events) : next }));
  }
  function setAssignments(next: Assignment[] | ((prev: Assignment[]) => Assignment[])) {
    setCurrent(data => ({ ...data, assignments: typeof next === "function" ? next(data.assignments) : next }));
  }
  function setExams(next: ExamRecord[] | ((prev: ExamRecord[]) => ExamRecord[])) {
    setCurrent(data => ({ ...data, exams: typeof next === "function" ? next(data.exams) : next }));
  }
  function setActiveSubjectId(next: string | ((prev: string) => string)) {
    setCurrent(data => ({ ...data, activeSubjectId: typeof next === "function" ? next(data.activeSubjectId) : next }));
  }
  function setActiveNoteId(next: string | ((prev: string) => string)) {
    setCurrent(data => ({ ...data, activeNoteId: typeof next === "function" ? next(data.activeNoteId) : next }));
  }
  function setActiveFolderId(next: string | ((prev: string) => string)) {
    setCurrent(data => ({ ...data, activeFolderId: typeof next === "function" ? next(data.activeFolderId) : next }));
  }

  function createSemester(id: string, label: string) {
    if (semesters[id]) return;
    setSemesters(prev => ({ ...prev, [id]: defaultSemesterData() }));
  }

  function deleteSemester(id: string) {
    if (Object.keys(semesters).length <= 1) return;
    setSemesters(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedCalendarId === id) {
      const remaining = Object.keys(semesters).filter(k => k !== id);
      setSelectedCalendarId(remaining[0]);
    }
  }

  useEffect(() => {
    if (!subjects.length) { setKnowledgeSyncStatus(""); return; }
    const timer = window.setTimeout(() => {
      api<{ noteCount: number; root: string }>("/knowledge/sync", {
        method: "POST",
        body: JSON.stringify({ subjects }),
      })
        .then((payload) => setKnowledgeSyncStatus(`Saved ${payload.noteCount} notes to ${payload.root}`))
        .catch((err: Error) => setKnowledgeSyncStatus(`Local markdown sync failed: ${err.message}`));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [subjects]);

  const activeSubject = subjects.find((s) => s.id === activeSubjectId) ?? subjects[0];
  const activeNote = activeSubject?.notes.find((n) => n.id === activeNoteId) ?? activeSubject?.notes[0];
  const selectedCalendar = calendarOptions.find((o) => o.id === selectedCalendarId) ?? fallbackAcademicOptions[0];
  const visibleCalendarOptions = calendarOptions.filter((o) =>
    track === "foundation" ? o.track === "foundation" && o.intake === foundationIntake : o.track === "undergraduate",
  );

  const today = useMemo(() => new Date(), []);
  const semStart = useMemo(() => new Date(`${selectedCalendar.startDate}T00:00:00`), [selectedCalendar.startDate]);
  const weekStart = useMemo(() => addDays(startOfWeek(today), weekOffset * 7), [today, weekOffset]);
  const weekEnd = addDays(weekStart, 6);
  const weekNumber = Math.max(1, Math.floor((+weekStart - +startOfWeek(semStart)) / 86400000 / 7) + 1);

  const todayEvents = events
    .filter((e) => e.date ? isSameDay(new Date(`${e.date}T00:00:00`), today) : e.dayIndex === todayDayIndex())
    .sort((a, b) => a.start.localeCompare(b.start));
  const upcomingAssignments = [...assignments].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
  const activeAssignments = assignments;
  const activeExams = exams.filter((exam) => exam.subjectId === activeSubject?.id);

  const calendarEvents = useMemo(() => {
    const assignmentDeadlines: CalendarEvent[] = assignments
      .filter((a) => !!a.due)
      .map((assignment) => {
        const subject = subjects.find((s) => s.id === assignment.subjectId);
        return {
          id: `assignment-${assignment.id}`,
          code: subject?.code ?? "Task",
          name: assignment.title,
          lecturer: "",
          venue: "",
          dayIndex: dateToDayIndex(assignment.due),
          start: "00:00",
          end: "23:59",
          weeks: statusLabels[assignment.status],
          subjectId: assignment.subjectId,
          type: "assignment" as const,
          color: subject?.color ?? "#525252",
          date: assignment.due,
        };
      });
    const examReminders: CalendarEvent[] = exams.map((exam) => {
      const subject = subjects.find((s) => s.id === exam.subjectId);
      return {
        id: `exam-${exam.id}`,
        code: subject?.code ?? "Exam",
        name: exam.title,
        lecturer: "",
        venue: examKindLabels[exam.kind],
        dayIndex: dateToDayIndex(exam.date),
        start: "09:00",
        end: "10:00",
        weeks: "Assessment",
        subjectId: exam.subjectId,
        type: "exam" as const,
        color: subject?.color ?? "#525252",
        date: exam.date,
      };
    });
    return [...events, ...assignmentDeadlines, ...examReminders];
  }, [assignments, events, exams, subjects]);

  const todayStr = today.toISOString().slice(0, 10);
  const todaysTasks = assignments.filter((a) => a.due === todayStr && a.status !== "graded");
  const upcomingEvents = calendarEvents
    .filter((e) => e.date && e.date > todayStr && e.type !== "assignment")
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.start.localeCompare(b.start))
    .slice(0, 6);

  // ────────────────── State mutations ──────────────────

  function nav(to: Page) { setPage(to); }

  function toastAdd(message: string, type?: "success" | "error" | "info") {
    try { addToast(message, type); } catch { /* noop */ }
  }

  function importHtmlFile(file: File | undefined) {
    if (!file) return;
    file.text().then((html) => setTimetablePreview(parseTimetable(html)));
  }

  function importBundledTimetable() {
    setTimetablePreview(parseTimetable(bundledTimetableHtml));
  }

  function applyTimetableImport() {
    if (!timetablePreview.length) return;
    setSubjects((prevSubjects) => {
      const next = [...prevSubjects];
      const newEvents: CalendarEvent[] = [];
      for (const cls of timetablePreview) {
        let subject = next.find((s) => s.code.toUpperCase() === cls.code.toUpperCase());
        if (!subject) {
          subject = {
            id: uid("subject"),
            code: cls.code.toUpperCase(),
            name: cls.name,
            lecturer: cls.lecturer,
            color: nextColor(next),
            courseInfo: `# ${cls.name}\n\nLecturer: ${cls.lecturer}\nDefault venue: ${cls.venue}\n`,
            folders: [],
            notes: [
              makeNote(`${cls.code} overview`, `# ${cls.name}\n\nLecturer: ${cls.lecturer}\nDefault venue: ${cls.venue}\n\n[[Assessment plan]]`),
              makeNote("Assessment plan", `# Assessment plan\n\nTrack assignments and tests for ${cls.code}.`),
            ],
          };
          next.push(subject);
        } else {
          if (!subject.lecturer && cls.lecturer) subject.lecturer = cls.lecturer;
        }
        newEvents.push({ ...cls, subjectId: subject.id, type: "class" as const, color: subject.color });
      }
      setEvents(newEvents);
      if (!activeSubjectId && next[0]) {
        setActiveSubjectId(next[0].id);
        setActiveNoteId(next[0].notes[0]?.id ?? "");
      }
      return next;
    });
    setTimetablePreview([]);
  }

  function addCalendarEvent(input: { title: string; date: string; start: string; end: string; venue: string; subjectId: string }) {
    const title = input.title.trim();
    if (!title || !input.date || !input.start || !input.end) return;
    const subject = subjects.find((s) => s.id === input.subjectId);
    const color = subject?.color ?? nextColor(events);
    const event: CalendarEvent = {
      id: uid("event"),
      code: subject?.code ?? "Event",
      name: title,
      lecturer: "",
      venue: input.venue.trim() || "No location",
      dayIndex: dateToDayIndex(input.date),
      start: input.start,
      end: input.end,
      weeks: "Custom",
      subjectId: subject?.id,
      type: "custom",
      color,
      date: input.date,
    };
    setEvents((prev) => [...prev, event]);
  }

  function deleteCalendarEvent(id: string) { setEvents((prev) => prev.filter((e) => e.id !== id)); }
  function updateCalendarEvent(id: string, patch: Partial<CalendarEvent>) {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e));
  }

  function updateNote(content: string) {
    if (!activeSubject || !activeNote) return;
    setSubjects((prev) => prev.map((s) =>
      s.id === activeSubject.id
        ? { ...s, notes: s.notes.map((n) => n.id === activeNote.id ? { ...n, content, updatedAt: new Date().toISOString() } : n) }
        : s,
    ));
  }

  function renameNote(title: string) {
    if (!activeSubject || !activeNote) return;
    setSubjects((prev) => prev.map((s) =>
      s.id === activeSubject.id
        ? { ...s, notes: s.notes.map((n) => n.id === activeNote.id ? { ...n, title, updatedAt: new Date().toISOString() } : n) }
        : s,
    ));
  }

  function createNote(folderId?: string) {
    if (!activeSubject) return;
    const resolvedFolderId = activeSubject.folders?.some((f) => f.id === folderId) ? folderId : undefined;
    const note = makeNote("Untitled", "# Untitled\n\n", resolvedFolderId);
    setSubjects((prev) => prev.map((s) => s.id === activeSubject.id ? { ...s, notes: [note, ...s.notes] } : s));
    setActiveNoteId(note.id);
  }

  function createFolder() {
    if (!activeSubject) return;
    const name = prompt("Folder name")?.trim();
    if (!name) return;
    const folder: NoteFolder = { id: uid("folder"), name, createdAt: new Date().toISOString() };
    setSubjects((prev) => prev.map((s) => s.id === activeSubject.id ? { ...s, folders: [...(s.folders ?? []), folder] } : s));
    setActiveFolderId(folder.id);
  }

  function deleteFolder(folderId: string) {
    if (!activeSubject) return;
    if (!confirm("Remove this folder? Notes inside it will move to Unfiled.")) return;
    setSubjects((prev) => prev.map((s) =>
      s.id === activeSubject.id
        ? {
          ...s,
          folders: (s.folders ?? []).filter((f) => f.id !== folderId),
          notes: s.notes.map((n) => n.folderId === folderId ? { ...n, folderId: undefined } : n),
        }
        : s,
    ));
    setActiveFolderId("all");
  }

  function moveNote(noteId: string, folderId: string) {
    if (!activeSubject) return;
    setSubjects((prev) => prev.map((s) =>
      s.id === activeSubject.id
        ? { ...s, notes: s.notes.map((n) => n.id === noteId ? { ...n, folderId: folderId || undefined, updatedAt: new Date().toISOString() } : n) }
        : s,
    ));
  }

  function deleteNote(noteId?: string) {
    const targetSubject = activeSubject;
    const targetNoteId = noteId ?? activeNote?.id;
    if (!targetSubject || !targetNoteId || targetSubject.notes.length <= 1) return;
    setSubjects((prev) => {
      const subject = prev.find((s) => s.id === targetSubject.id);
      if (!subject) return prev;
      const remaining = subject.notes.filter((n) => n.id !== targetNoteId);
      return prev.map((s) => s.id === targetSubject.id ? { ...s, notes: remaining } : s);
    });
    if (activeNote?.id === targetNoteId) {
      setActiveNoteId(targetSubject.notes.find((n) => n.id !== targetNoteId)?.id ?? "");
    }
  }

  function deleteSubject(id: string) {
    if (!confirm("Remove this subject and all its notes?")) return;
    setSubjects((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeSubjectId === id) {
        setActiveSubjectId(next[0]?.id ?? "");
        setActiveNoteId(next[0]?.notes[0]?.id ?? "");
        setActiveFolderId("all");
      }
      return next;
    });
    setEvents((prev) => prev.filter((e) => e.subjectId !== id));
    setAssignments((prev) => prev.filter((a) => a.subjectId !== id));
    setExams((prev) => prev.filter((exam) => exam.subjectId !== id));
    toastAdd("Subject removed", "success");
  }

  function saveCourseInfo(courseInfo: string) {
    if (!activeSubject) return;
    setSubjects((prev) => prev.map((s) => s.id === activeSubject.id ? { ...s, courseInfo } : s));
  }

  function addAssignment(input: { title: string; subjectId: string; due: string; weight: number; description: string; relatedFileIds: string[]; status?: Status; priority?: import("./types").Priority }) {
    if (!input.title.trim() || !input.subjectId) return;
    const newAssignment: Assignment = {
      id: uid("assign"),
      subjectId: input.subjectId,
      title: input.title.trim(),
      due: input.due || toIsoDate(new Date()),
      weight: Number.isFinite(input.weight) ? input.weight : 0,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      description: input.description,
      relatedFileIds: input.relatedFileIds,
      createdAt: new Date().toISOString(),
    };
    setAssignments((prev) => [newAssignment, ...prev]);
  }

  function updateAssignment(id: string, patch: Partial<Assignment>) {
    setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
  }
  function toggleAssignmentFile(id: string, fileId: string) {
    setAssignments((prev) => prev.map((assignment) => {
      if (assignment.id !== id) return assignment;
      const selected = new Set(assignment.relatedFileIds ?? []);
      if (selected.has(fileId)) selected.delete(fileId);
      else selected.add(fileId);
      return { ...assignment, relatedFileIds: Array.from(selected) };
    }));
  }
  function deleteAssignment(id: string) { setAssignments((prev) => prev.filter((a) => a.id !== id)); toastAdd("Assignment deleted", "info"); }

  function addExam(input: { title: string; subjectId: string; kind: ExamKind; date: string; weight: number; score: number; maxScore: number; notes: string; relatedFileIds: string[] }) {
    if (!input.title.trim() || !input.subjectId) return;
    const newExam: ExamRecord = {
      id: uid("exam"),
      subjectId: input.subjectId,
      title: input.title.trim(),
      kind: input.kind,
      date: input.date || toIsoDate(new Date()),
      weight: Number.isFinite(input.weight) ? input.weight : 0,
      score: Number.isFinite(input.score) ? input.score : 0,
      maxScore: Number.isFinite(input.maxScore) && input.maxScore > 0 ? input.maxScore : 100,
      notes: input.notes,
      relatedFileIds: input.relatedFileIds,
      attachments: [],
    };
    setExams((prev) => [newExam, ...prev]);
    toastAdd("Exam added", "success");
  }

  function updateExam(id: string, patch: Partial<ExamRecord>) {
    setExams((prev) => prev.map((exam) => exam.id === id ? { ...exam, ...patch } : exam));
  }
  function toggleExamFile(id: string, fileId: string) {
    setExams((prev) => prev.map((exam) => {
      if (exam.id !== id) return exam;
      const selected = new Set(exam.relatedFileIds ?? []);
      if (selected.has(fileId)) selected.delete(fileId);
      else selected.add(fileId);
      return { ...exam, relatedFileIds: Array.from(selected) };
    }));
  }
  function deleteExam(id: string) { setExams((prev) => prev.filter((exam) => exam.id !== id)); toastAdd("Exam deleted", "info"); }
  function removeExamAttachment(id: string, attachmentId: string) {
    setExams((prev) => prev.map((exam) => exam.id === id ? { ...exam, attachments: exam.attachments.filter((a) => a.id !== attachmentId) } : exam));
    toastAdd("Attachment removed", "info");
  }
  async function uploadExamFiles(id: string, files: FileList | null) {
    if (!files?.length) return;
    const uploaded: import("./types").LocalFileRef[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await readAsDataUrl(file);
      uploaded.push(await api<import("./types").LocalFileRef>("/files/upload", {
        method: "POST",
        body: JSON.stringify({ scope: "exams", filename: file.name, mime: file.type || "application/octet-stream", dataUrl }),
      }));
    }
    setExams((prev) => prev.map((exam) => exam.id === id ? { ...exam, attachments: [...exam.attachments, ...uploaded] } : exam));
    toastAdd(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`, "success");
  }

  // ────────────────── Moodle ──────────────────

  async function moodleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMoodle({ ...moodle, loading: true, error: "" });
    try {
      const auth = await api<{ token: string; username: string; fullname: string; userid: number }>("/moodle/login", {
        method: "POST",
        body: JSON.stringify({ username: moodle.username, password: moodlePassword }),
      });
      const list = await api<{ courses: import("./types").MoodleCourseLite[] }>("/moodle/courses", {
        method: "POST",
        body: JSON.stringify({ token: auth.token }),
      });
      setMoodle({ ...moodle, token: auth.token, username: auth.username, siteUser: auth.fullname, connected: true, loading: false, catalog: list.courses, error: "" });
      setMoodlePassword("");
    } catch (err) {
      setMoodle({ ...moodle, loading: false, connected: false, error: (err as Error).message });
    }
  }

  function moodleLogout() {
    setMoodle({ username: "", token: "", siteUser: "", connected: false, loading: false, lastSync: "", catalog: [], selectedCourseIds: [], courses: [], files: [], error: "" });
    setMoodlePassword("");
  }

  function toggleMoodleCourse(id: number) {
    const exists = moodle.selectedCourseIds.includes(id);
    setMoodle({ ...moodle, selectedCourseIds: exists ? moodle.selectedCourseIds.filter((cid) => cid !== id) : [...moodle.selectedCourseIds, id] });
  }

  function applyMoodleSelection() {
    setSubjects((prev) => {
      const next = [...prev];
      let createdCount = 0;
      for (const cid of moodle.selectedCourseIds) {
        const course = moodle.catalog.find((c) => c.id === cid);
        if (!course) continue;
        const linked = next.find((s) => s.moodleCourseId === cid);
        if (linked) continue;
        const codeGuess = course.shortname?.split(/\s|-/)[0]?.toUpperCase() ?? "";
        const matchByCode = next.find((s) => codeGuess && s.code.toUpperCase() === codeGuess);
        const matchByName = next.find((s) => s.name.toLowerCase() === course.fullname.toLowerCase());
        if (matchByCode) { matchByCode.moodleCourseId = cid; }
        else if (matchByName) { matchByName.moodleCourseId = cid; }
        else { next.push(makeSubjectFromMoodle(course, palette[next.length % palette.length])); createdCount += 1; }
      }
      if (!activeSubjectId && next[0]) {
        setActiveSubjectId(next[0].id);
        setActiveNoteId(next[0].notes[0]?.id ?? "");
      }
      return next;
    });
    setMoodle((prev) => ({ ...prev, error: "" }));
  }

  async function syncMoodleFiles() {
    if (!moodle.token) return;
    if (!moodle.selectedCourseIds.length) { setMoodle({ ...moodle, error: "Select one or more courses first." }); return; }
    setMoodle({ ...moodle, loading: true, error: "" });
    try {
      const payload = await api<{ courses: import("./types").MoodleSyncedCourse[]; files: MoodleFile[]; errors: { id: number; error: string }[] }>("/moodle/sync", {
        method: "POST",
        body: JSON.stringify({ token: moodle.token, courseIds: moodle.selectedCourseIds }),
      });
      setMoodle({ ...moodle, loading: false, lastSync: new Date().toLocaleString(), courses: payload.courses, files: payload.files, error: payload.errors?.length ? `Some courses failed: ${payload.errors.map((e) => e.id).join(", ")}` : "" });
    } catch (err) {
      setMoodle({ ...moodle, loading: false, error: (err as Error).message });
    }
  }

  // ────────────────── AI Actions ──────────────────

  function executeActions(actions: AIAction[]): string[] {
    const confirmations: string[] = [];
    for (const action of actions) {
      try {
        switch (action.action) {
          case "create_calendar_event":
            addCalendarEvent({
              ...action.payload,
              venue: action.payload.venue ?? "",
              subjectId: action.payload.subjectId ?? "",
            });
            confirmations.push(`Created calendar event: ${action.payload.title}`);
            break;
          case "update_calendar_event":
            updateCalendarEvent(action.payload.id, action.payload);
            confirmations.push(`Updated calendar event.`);
            break;
          case "delete_calendar_event":
            deleteCalendarEvent(action.payload.id);
            confirmations.push(`Deleted calendar event.`);
            break;
          case "create_note": {
            const s = subjects.find((sub) => sub.id === action.payload.subjectId);
            if (!s) { confirmations.push("Subject not found for note creation."); break; }
            const note = makeNote(action.payload.title, action.payload.content, action.payload.folderId);
            setSubjects((prev) => prev.map((sub) => sub.id === s.id ? { ...sub, notes: [note, ...sub.notes] } : sub));
            confirmations.push(`Created note: ${note.title}`);
            break;
          }
          case "update_note": {
            setSubjects((prev) => prev.map((sub) =>
              sub.id === action.payload.subjectId
                ? { ...sub, notes: sub.notes.map((n) => n.id === action.payload.noteId ? { ...n, title: action.payload.title ?? n.title, content: action.payload.content ?? n.content, updatedAt: new Date().toISOString() } : n) }
                : sub,
            ));
            confirmations.push(`Updated note.`);
            break;
          }
          case "delete_note": {
            setSubjects((prev) => prev.map((sub) =>
              sub.id === action.payload.subjectId
                ? { ...sub, notes: sub.notes.filter((n) => n.id !== action.payload.noteId) }
                : sub,
            ));
            confirmations.push(`Deleted note.`);
            break;
          }
          case "create_assignment":
            addAssignment({ ...action.payload, description: "", weight: action.payload.weight ?? 0, relatedFileIds: [] });
            confirmations.push(`Created assignment: ${action.payload.title}`);
            break;
          case "update_assignment":
            updateAssignment(action.payload.id, action.payload);
            confirmations.push(`Updated assignment.`);
            break;
          case "delete_assignment":
            deleteAssignment(action.payload.id);
            confirmations.push(`Deleted assignment.`);
            break;
          case "create_exam":
            addExam({
              ...action.payload,
              weight: action.payload.weight ?? 0,
              score: action.payload.score ?? 0,
              maxScore: action.payload.maxScore ?? 100,
              notes: action.payload.notes ?? "",
              relatedFileIds: [],
            });
            confirmations.push(`Created exam: ${action.payload.title}`);
            break;
          case "update_exam":
            updateExam(action.payload.id, action.payload);
            confirmations.push(`Updated exam.`);
            break;
          case "delete_exam":
            deleteExam(action.payload.id);
            confirmations.push(`Deleted exam.`);
            break;
        }
      } catch (e) {
        confirmations.push(`Action failed: ${(e as Error).message}`);
      }
    }
    return confirmations;
  }

  function getActiveConversation(): Conversation | null {
    return activeConversationId ? conversations[activeConversationId] ?? null : null;
  }

  function makeTitle(text: string): string {
    const t = text.trim().split("\n")[0].slice(0, 40);
    return t + (text.trim().length > 40 ? "…" : "");
  }

  function createConversation(firstUserText?: string): string {
    const id = uid("conv");
    const conv: Conversation = {
      id,
      title: firstUserText ? makeTitle(firstUserText) : "New chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: aiSettings.model || getDefaultModel(aiSettings.provider),
      messages: [],
    };
    setConversations((prev) => ({ ...prev, [id]: conv }));
    setActiveConversationId(id);
    return id;
  }

  function updateConversation(id: string, patch: Partial<Conversation> | ((c: Conversation) => Conversation)) {
    setConversations((prev) => {
      const conv = prev[id];
      if (!conv) return prev;
      const next = typeof patch === "function" ? patch(conv) : { ...conv, ...patch };
      return { ...prev, [id]: next };
    });
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  }

  function renameConversation(id: string, title: string) {
    updateConversation(id, { title: title.trim() || "Untitled" });
  }

  function getDefaultModel(provider: AIProvider): string {
    switch (provider) {
      case "openai": return "gpt-4o-mini";
      case "anthropic": return "claude-3-5-haiku-latest";
      case "claude-code": return "claude";
      case "codex-cli": return "codex";
      case "opencode": return "opencode";
      default: return "";
    }
  }

  async function sendChat(text: string, displayText?: string, fileIds?: string[]) {
    let convId = activeConversationId;
    if (!convId) {
      convId = createConversation(displayText ?? text);
    }

    const displayContent = displayText ?? text;
    const userMsg: ChatMessage = { id: uid("msg"), role: "user", content: displayContent };

    // Update conversation with user message
    setConversations((prev) => {
      const conv = prev[convId!];
      if (!conv) return prev;
      return {
        ...prev,
        [convId!]: {
          ...conv,
          messages: [...conv.messages, userMsg],
          updatedAt: new Date().toISOString(),
          title: conv.messages.length === 0 ? makeTitle(displayContent) : conv.title,
        },
      };
    });

    setLoadingConversationId(convId);
    try {
      const conv = getActiveConversation();
      const system = buildSystemContext({ subjects, events, assignments, exams, selectedCalendar, today, activeSubject });
      const effectiveModel = conv?.model ?? aiSettings.model ?? getDefaultModel(aiSettings.provider);
      const allMessages = conv ? [...conv.messages, userMsg] : [userMsg];
      const historyForAPI = allMessages.slice(-20).map((m) => ({ role: m.role, content: m.content }));

      const payload = await api<{ reply: string }>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          cliCommand: aiSettings.cliCommand,
          model: effectiveModel,
          system,
          messages: historyForAPI,
        }),
      });
      const actions = extractActions(payload.reply);
      const cleanReply = stripActionBlocks(payload.reply);
      const confirmations = executeActions(actions);

      if (confirmations.length) {
        toastAdd(confirmations.join(" · "), "success");
      }

      const replyMsgs: ChatMessage[] = [];
      if (cleanReply.trim()) {
        replyMsgs.push({ id: uid("msg"), role: "assistant", content: cleanReply.trim() });
      }
      if (!replyMsgs.length) {
        replyMsgs.push({ id: uid("msg"), role: "assistant", content: "Done." });
      }

      setConversations((prev) => {
        const conv = prev[convId!];
        if (!conv) return prev;
        return {
          ...prev,
          [convId!]: {
            ...conv,
            messages: [...conv.messages, ...replyMsgs],
            updatedAt: new Date().toISOString(),
          },
        };
      });
    } catch (err) {
      setConversations((prev) => {
        const conv = prev[convId!];
        if (!conv) return prev;
        return {
          ...prev,
          [convId!]: {
            ...conv,
            messages: [...conv.messages, { id: uid("msg"), role: "assistant", content: `Error: ${(err as Error).message}` }],
            updatedAt: new Date().toISOString(),
          },
        };
      });
    } finally {
      setLoadingConversationId((prev) => prev === convId ? null : prev);
    }
  }

  // ────────────────── Render ──────────────────

  return (
    <>
      {!userProfile.onboardingComplete && (
        <Onboarding
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          onComplete={() => setUserProfile({ ...userProfile, onboardingComplete: true })}
          onSkip={() => setUserProfile({ ...userProfile, onboardingComplete: true })}
          // Semester / Timetable
          calendarOptions={calendarOptions}
          track={track}
          setTrack={setTrack}
          foundationIntake={foundationIntake}
          setFoundationIntake={setFoundationIntake}
          selectedCalendarId={selectedCalendarId}
          setSelectedCalendarId={setSelectedCalendarId}
          timetablePreview={timetablePreview}
          importHtmlFile={importHtmlFile}
          importBundledTimetable={importBundledTimetable}
          applyTimetableImport={applyTimetableImport}
          // Moodle
          moodle={moodle}
          setMoodle={setMoodle}
          moodlePassword={moodlePassword}
          setMoodlePassword={setMoodlePassword}
          moodleLogin={moodleLogin}
          toggleMoodleCourse={toggleMoodleCourse}
          applyMoodleSelection={applyMoodleSelection}
          syncMoodleFiles={syncMoodleFiles}
          // AI
          aiSettings={aiSettings}
          setAISettings={setAISettings}
          // Navigation
          nav={nav}
        />
      )}
      <div className="app">
        <Sidebar
          page={page}
          nav={nav}
          semester={selectedCalendar.semester}
          moodleConnected={moodle.connected}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          userProfile={userProfile}
        />
        <div className="workspace">
          <div className="page">
            {page === "dashboard" && (
            <Dashboard
              today={today}
              todayEvents={todayEvents}
              subjects={subjects}
              conversation={getActiveConversation()}
              conversations={conversations}
              sendChat={sendChat}
              loadingConversationId={loadingConversationId}
              aiSettings={aiSettings}
              setAISettings={setAISettings}
              activeConversationId={activeConversationId}
              setActiveConversationId={setActiveConversationId}
              createConversation={createConversation}
              deleteConversation={deleteConversation}
              renameConversation={renameConversation}
              moodleFiles={moodle.files}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              assignments={assignments}
              todaysTasks={todaysTasks}
              upcomingEvents={upcomingEvents}
              activeSubject={activeSubject}
              go={nav}
            />
          )}
          {page === "calendar" && (
            <CalendarPage
              selectedCalendar={selectedCalendar}
              events={calendarEvents}
              subjects={subjects}
              assignments={assignments}
              exams={exams}
              addCalendarEvent={addCalendarEvent}
              updateCalendarEvent={updateCalendarEvent}
              deleteCalendarEvent={deleteCalendarEvent}
              addAssignment={addAssignment}
              updateAssignment={updateAssignment}
              deleteAssignment={deleteAssignment}
              weekStart={weekStart}
              weekEnd={weekEnd}
              weekNumber={weekNumber}
              today={today}
              weekOffset={weekOffset}
              setWeekOffset={setWeekOffset}
            />
          )}
          {page === "knowledge" && (
            <KnowledgePage
              subjects={subjects}
              activeSubject={activeSubject}
              activeNote={activeNote}
              activeSubjectId={activeSubjectId}
              setActiveSubjectId={setActiveSubjectId}
              setActiveNoteId={setActiveNoteId}
              activeFolderId={activeFolderId}
              setActiveFolderId={setActiveFolderId}
              createNote={createNote}
              createFolder={createFolder}
              deleteFolder={deleteFolder}
              moveNote={moveNote}
              deleteNote={deleteNote}
              updateNote={updateNote}
              renameNote={renameNote}
              saveCourseInfo={saveCourseInfo}
              deleteSubject={deleteSubject}
              syncStatus={knowledgeSyncStatus}
              theme={theme}
              conversation={getActiveConversation()}
              conversations={conversations}
              sendChat={sendChat}
              loadingConversationId={loadingConversationId}
              aiSettings={aiSettings}
              setAISettings={setAISettings}
              activeConversationId={activeConversationId}
              setActiveConversationId={setActiveConversationId}
              createConversation={createConversation}
              deleteConversation={deleteConversation}
              renameConversation={renameConversation}
              userProfile={userProfile}
            />
          )}
          {page === "assignments" && (
            <AssignmentsPage
              subjects={subjects}
              assignments={assignments}
              activeSubject={activeSubject}
              activeSubjectId={activeSubjectId}
              activeAssignments={activeAssignments}
              addAssignment={addAssignment}
              updateAssignment={updateAssignment}
              toggleAssignmentFile={toggleAssignmentFile}
              deleteAssignment={deleteAssignment}
              moodleFiles={moodle.files}
              selectedCalendar={selectedCalendar}
            />
          )}
          {page === "exams" && (
            <ExamsPage
              subjects={subjects}
              exams={exams}
              activeSubject={activeSubject}
              activeSubjectId={activeSubjectId}
              setActiveSubjectId={setActiveSubjectId}
              activeExams={activeExams}
              selectedCalendar={selectedCalendar}
              addExam={addExam}
              updateExam={updateExam}
              toggleExamFile={toggleExamFile}
              deleteExam={deleteExam}
              uploadExamFiles={uploadExamFiles}
              removeExamAttachment={removeExamAttachment}
              moodleFiles={moodle.files}
            />
          )}
          {page === "moodle" && (
            <MoodlePage
              moodle={moodle}
              setMoodle={setMoodle}
              moodlePassword={moodlePassword}
              setMoodlePassword={setMoodlePassword}
              moodleLogin={moodleLogin}
              moodleLogout={moodleLogout}
              toggleMoodleCourse={toggleMoodleCourse}
              applyMoodleSelection={applyMoodleSelection}
              syncMoodleFiles={syncMoodleFiles}
              subjects={subjects}
            />
          )}
          {page === "settings" && (
            <SettingsPage
              calendarOptions={calendarOptions}
              calendarFetchError={calendarFetchError}
              selectedCalendar={selectedCalendar}
              selectedCalendarId={selectedCalendarId}
              setSelectedCalendarId={setSelectedCalendarId}
              track={track}
              setTrack={setTrack}
              foundationIntake={foundationIntake}
              setFoundationIntake={setFoundationIntake}
              visibleCalendarOptions={visibleCalendarOptions}
              timetablePreview={timetablePreview}
              importHtmlFile={importHtmlFile}
              importBundledTimetable={importBundledTimetable}
              applyTimetableImport={applyTimetableImport}
              aiSettings={aiSettings}
              setAISettings={setAISettings}
              theme={theme}
              setTheme={setTheme}
              semesters={semesters}
              createSemester={createSemester}
              deleteSemester={deleteSemester}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
            />
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default AppShell;
