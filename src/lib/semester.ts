import type { SemesterData, Subject } from "../types";
import { makeMySpaceSubject } from "./utils";

export function defaultSemesterData(): SemesterData {
  const welcomeSubject: Subject = makeMySpaceSubject();
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
