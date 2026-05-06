export const palette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];
export const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const fullDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const statusLabels: Record<import("../types").Status, string> = {
  todo: "Todo",
  progress: "Doing",
  done: "Done",
};
export const examKindLabels: Record<import("../types").ExamKind, string> = {
  quiz: "Quiz",
  midterm: "Midterm",
  final: "Final",
  lab: "Lab",
  other: "Other",
};
export const ALL_NOTES_FOLDER = "all";
export const UNFILED_FOLDER = "unfiled";
export const MY_SPACE_CODE = "SPACE";
export const HOUR_START = 8;
export const HOUR_END = 22;

export function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateToDayIndex(value: string) {
  const day = new Date(`${value}T00:00:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

export function dateLikeToDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  const maybeDate = value as { toDate?: () => Date; valueOf?: () => number } | null | undefined;
  if (maybeDate?.toDate) return maybeDate.toDate();
  if (maybeDate?.valueOf) return new Date(maybeDate.valueOf());
  return new Date();
}

export function timeFromDate(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function localDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`);
}

export function localAssetHref(url?: string, origin?: string) {
  if (!url) return "";
  return url.startsWith("/api") ? `${origin ?? ""}${url}` : url;
}

export function moodleFileKey(file: import("../types").MoodleFile) {
  return file.localPath ?? file.fileurl ?? `${file.courseId}:${file.section ?? ""}:${file.moduleName ?? ""}:${file.filename}`;
}

export function formatFileSize(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

export function normalizeTime(value: string) {
  const match = value.replace(/\s/g, "").match(/^(\d{1,2})(?:[.:](\d{2}))?(am|pm)$/i);
  if (!match) return "08:00";
  let hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const period = match[3].toLowerCase();
  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

export function addHours(time: string, hours: number) {
  const [hour, minute] = time.split(":").map(Number);
  return `${String(hour + hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseTimeRange(value: string) {
  const [start, end] = value.replace(/\s/g, "").split("-");
  return { start: normalizeTime(start ?? "8.00am"), end: normalizeTime(end ?? "9.00am") };
}

export function timeToHours(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

export function decodeEntities(value: string) {
  const el = document.createElement("textarea");
  el.innerHTML = value;
  return el.value;
}

export function cellLines(cell: HTMLTableCellElement) {
  const raw = cell.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(raw)
    .split("\n")
    .map((line) => line.replace(/\u00A0/g, " ").trim())
    .filter(Boolean);
}

export function parseTimetable(html: string): import("../types").ParsedClass[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];
  const headers = Array.from(table.querySelectorAll("thead th"))
    .slice(1)
    .map((th) => th.textContent?.trim() ?? "")
    .filter(Boolean);
  const spans = new Array(headers.length).fill(0);
  const parsed: import("../types").ParsedClass[] = [];

  Array.from(table.querySelectorAll("tbody tr")).forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll("td"));
    const time = parseTimeRange(cells[0]?.textContent ?? "");
    let dayCol = 0;

    cells.slice(1).forEach((cell) => {
      while (spans[dayCol] > 0) dayCol += 1;
      const lines = cellLines(cell);
      const rowSpan = Number(cell.getAttribute("rowspan") ?? "1");
      if (lines.length >= 4 && headers[dayCol]) {
        const code = lines[0].split("-")[0];
        parsed.push({
          id: `${code}-${rowIndex}-${dayCol}`,
          code,
          name: lines[1],
          lecturer: lines[2],
          venue: lines[3],
          dayIndex: dayCol,
          start: time.start,
          end: rowSpan > 1 ? addHours(time.start, rowSpan) : time.end,
          weeks: lines.find((line) => line.includes("Week"))?.replace(/[()]/g, "") ?? "Week 1-14",
        });
      }
      if (rowSpan > 1) spans[dayCol] = rowSpan - 1;
      dayCol += 1;
    });

    for (let i = 0; i < spans.length; i += 1) if (spans[i] > 0) spans[i] -= 1;
  });

  return parsed;
}

export function backlinks(content: string) {
  return Array.from(content.matchAll(/\[\[([^\]]+)]]/g)).map((match) => match[1]);
}

export function todayDayIndex() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function fmtDay(date: Date) {
  return date.toLocaleDateString(undefined, { day: "numeric" });
}

export function fmtRange(a: Date, b: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${a.toLocaleDateString(undefined, opts)} – ${b.toLocaleDateString(undefined, opts)}, ${b.getFullYear()}`;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isDateInWeek(date: string | undefined, weekStart: Date) {
  if (!date) return true;
  const eventDate = new Date(`${date}T00:00:00`);
  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);
  return eventDate >= weekStart && eventDate <= weekEnd;
}

export function isDateInRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

export function eventDayIndex(event: import("../types").CalendarEvent) {
  return event.date ? dateToDayIndex(event.date) : event.dayIndex;
}

export function semesterClassDates(event: import("../types").CalendarEvent, selectedCalendar: import("../types").AcademicOption) {
  if (event.date) return [event.date];
  const start = new Date(`${selectedCalendar.startDate}T00:00:00`);
  const end = new Date(`${selectedCalendar.endDate}T23:59:59`);
  const cursor = addDays(startOfWeek(start), event.dayIndex);
  const dates: string[] = [];
  while (cursor <= end) {
    if (cursor >= start) dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

export function nextColor(existing: { color: string }[]) {
  return palette[existing.length % palette.length];
}

export function makeNote(title: string, body: string, folderId?: string): import("../types").Note {
  return {
    id: uid("note"),
    title,
    content: body,
    updatedAt: new Date().toISOString(),
    folderId,
  };
}

export function gettingStartedNoteMarkdown(subjectCode = "this subject") {
  return `# Getting Started

Use this note as a quick reference for the Knowledge workspace.

## Core workflow

1. Create folders from the Knowledge sidebar to group lecture notes, labs, tutorials, and revision material.
2. Create a note in the right folder, then write in rich text mode by default.
3. Type [[ to link another note, then use the picker to choose an existing note.
4. Type @ to link a synced Moodle file, then choose the subject and file from the picker.
5. Open the note AI chat to ask questions using the current note as context.

## Linking examples

- Link another note: [[Lecture 1]]
- Link a Moodle file: type @ and choose a PDF, slide deck, lab sheet, or assignment brief.
- Example revision flow: open [[${subjectCode} overview]], link the lecture slides with @, then ask AI to generate practice questions.

## Tips

- Use All notes to scan everything in the subject.
- Use Unfiled for quick captures before sorting into folders.
- Moodle file links open the synced file when available.
- The Course Content table in the overview note tracks chapters, knowledge points, assessment plans, and progress.
`;
}

export function makeMySpaceSubject(): import("../types").Subject {
  return {
    id: uid("subject"),
    code: MY_SPACE_CODE,
    name: "My Space",
    lecturer: "",
    color: "#64748b",
    courseInfo: "# My Space\n\nPersonal notes and folders that are not tied to a single subject.\n",
    folders: [],
    notes: [
      makeNote("Getting Started", gettingStartedNoteMarkdown("My Space")),
    ],
  };
}

export function makeSubjectFromMoodle(course: import("../types").MoodleCourseLite, color: string): import("../types").Subject {
  const code = course.shortname?.split(/\s|-/)[0]?.toUpperCase() ?? `M${course.id}`;
  const folderId = uid("folder");
  const courseInfo = `# ${code} ${course.fullname}

## Basic Information

| Field | Value |
|---|---|
| Lecturer |  |
| Venue |  |
| Credit Hours |  |

## Course Content

| Chapter | Knowledge Point 1 | Knowledge Point 2 | Knowledge Point 3 | Chapter Progress |
|---|---|---|---|---|
| Chapter 1: Introduction | [ ] Point 1 | [ ] Point 2 | [ ] Point 3 | ░░░░░░░░░░ 0% |
| Chapter 2: Core Topics | [ ] Point 1 | [ ] Point 2 | [ ] Point 3 | ░░░░░░░░░░ 0% |
| Chapter 3: Advanced | [ ] Point 1 | [ ] Point 2 | [ ] Point 3 | ░░░░░░░░░░ 0% |

**Overall Course Progress:** ░░░░░░░░░░ **0%**

## Assessment Plan

| Assessment Component | Weight (%) | Score Obtained | Full Marks | Weighted Score | Status |
|---|---:|---:|---:|---:|---|

**Total Weight:** 0% ⚠️ Should be 100%

## Examination / Quiz Statistics

- **Current completed assessment percentage:** 0%
- **Current weighted score:** 0.0%
- **Remaining percentage:** 100%
- **Estimated final grade:** F
- **Progress by assessment type:**
  - other: 0%
- **Upcoming incomplete assessments:**
  - None
`;
  return {
    id: uid("subject"),
    code,
    name: course.fullname,
    lecturer: "",
    color,
    courseInfo,
    folders: [{ id: folderId, name: code, createdAt: new Date().toISOString() }],
    moodleCourseId: course.id,
    notes: [
      makeNote(`${code} overview`, courseInfo, folderId),
      makeNote("Getting Started", gettingStartedNoteMarkdown(code)),
    ],
  };
}
