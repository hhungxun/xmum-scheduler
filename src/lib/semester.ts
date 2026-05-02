import type { SemesterData, Subject } from "../types";
import { uid, makeNote } from "./utils";

export function defaultSemesterData(): SemesterData {
  const welcomeSubject: Subject = {
    id: uid("subject"),
    code: "START",
    name: "Getting Started",
    lecturer: "",
    color: "#4f46e5",
    courseInfo: "# Getting Started\n\nWelcome to XMUM OS.",
    folders: [],
    notes: [
      makeNote("Welcome", `# Welcome to XMUM OS

This is your academic workspace. Here's how to get started:

## 1. Import your timetable
Go to **Settings** and import your semester timetable HTML file. This will create all your subjects automatically.

## 2. Take notes
Use the **Knowledge** page to write lecture notes. You can use:
- **Markdown** formatting
- **LaTeX** math like $E = mc^2$
- **Wiki links** with [[Note Name]]

## 3. Track assignments
In **Assignments**, create and drag tasks across the Kanban board (Todo → Doing → Submitted → Graded).

## 4. Plan with AI
Use the chat assistant to:
- Plan your week with "/plan"
- Create assignments with "/create-assignment"
- Schedule study sessions with "/schedule-study"

## 5. Manage exams
In **Exams**, track your scores and see your weighted average across the semester.

## Quick Tips
- Type "/" in the chat to see available AI commands
- Notes auto-sync to the data/knowledge folder as markdown
- Each semester has completely isolated data — switch freely in Settings`),
    ],
  };
  return {
    subjects: [welcomeSubject],
    events: [],
    assignments: [],
    exams: [],
    activeSubjectId: welcomeSubject.id,
    activeNoteId: welcomeSubject.notes[0].id,
    activeFolderId: "all",
  };
}

export function migrateLegacySemesters(): Record<string, SemesterData> {
  try {
    const subjectsRaw = localStorage.getItem("xmum.v3.subjects");
    const eventsRaw = localStorage.getItem("xmum.v3.events");
    const assignmentsRaw = localStorage.getItem("xmum.v3.assignments");
    const examsRaw = localStorage.getItem("xmum.v3.exams");
    const activeSubjectRaw = localStorage.getItem("xmum.v3.activeSubject");
    const activeNoteRaw = localStorage.getItem("xmum.v3.activeNote");
    const activeFolderRaw = localStorage.getItem("xmum.v3.activeFolder");
    const calendarIdRaw = localStorage.getItem("xmum.v3.calendarId");

    const subjects = subjectsRaw ? JSON.parse(subjectsRaw) : null;
    const events = eventsRaw ? JSON.parse(eventsRaw) : null;
    const assignments = assignmentsRaw ? JSON.parse(assignmentsRaw) : null;
    const exams = examsRaw ? JSON.parse(examsRaw) : null;

    const hasData =
      Array.isArray(subjects) ||
      Array.isArray(events) ||
      Array.isArray(assignments) ||
      Array.isArray(exams);

    if (!hasData) return {};

    const calendarId = calendarIdRaw ? JSON.parse(calendarIdRaw) : "default";

    return {
      [calendarId]: {
        subjects: Array.isArray(subjects) ? subjects : [],
        events: Array.isArray(events) ? events : [],
        assignments: Array.isArray(assignments) ? assignments : [],
        exams: Array.isArray(exams) ? exams : [],
        activeSubjectId: activeSubjectRaw ? JSON.parse(activeSubjectRaw) : "",
        activeNoteId: activeNoteRaw ? JSON.parse(activeNoteRaw) : "",
        activeFolderId: activeFolderRaw ? JSON.parse(activeFolderRaw) : "",
      },
    };
  } catch {
    return {};
  }
}
