import type { Subject, CalendarEvent, Assignment, ExamRecord, AcademicOption } from "../types";
import { statusLabels, examKindLabels, toIsoDate, fmtRange, startOfWeek, addDays, isSameDay, todayDayIndex } from "./utils";

export function buildSystemContext(params: {
  subjects: Subject[];
  events: CalendarEvent[];
  assignments: Assignment[];
  exams: ExamRecord[];
  selectedCalendar: AcademicOption;
  today: Date;
  activeSubject?: Subject;
}) {
  const { subjects, events, assignments, exams, selectedCalendar, today, activeSubject } = params;
  const todayIso = toIsoDate(today);

  const subjectList = subjects.map((s) => `- ${s.code}: ${s.name} (id: ${s.id})`).join("\n") || "None";

  const calendarItems = events.map((e) => {
    const date = e.date ?? `${e.dayIndex} (recurring)`;
    return `- ${e.code} · ${e.name} | ${date} ${e.start}-${e.end} | type: ${e.type} | id: ${e.id}`;
  }).join("\n") || "None";

  const assignmentList = assignments.map((a) => {
    const subj = subjects.find((s) => s.id === a.subjectId);
    return `- ${a.title} (${subj?.code ?? "?"}) | due: ${a.due || "none"} | weight: ${a.weight}% | status: ${statusLabels[a.status]} | id: ${a.id}`;
  }).join("\n") || "None";

  const examList = exams.map((e) => {
    const subj = subjects.find((s) => s.id === e.subjectId);
    return `- ${e.title} (${subj?.code ?? "?"}) | ${examKindLabels[e.kind]} | date: ${e.date} | weight: ${e.weight}% | score: ${e.score}/${e.maxScore} | id: ${e.id}`;
  }).join("\n") || "None";

  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const notesContext = subjects.flatMap((s) =>
    s.notes.map((n) => `- ${s.code} / ${n.title} (note id: ${n.id}, subject id: ${s.id})`)
  ).join("\n") || "None";

  return `You are an intelligent academic assistant embedded in a student productivity platform called XMUM OS.
Today's date is ${todayIso}. The active semester is ${selectedCalendar.semester} (${selectedCalendar.startDate} to ${selectedCalendar.endDate}).
Current week: ${fmtRange(weekStart, weekEnd)}.
Active subject: ${activeSubject ? `${activeSubject.code} - ${activeSubject.name}` : "None selected"}.

You have FULL CONTEXT of the user's academic workspace:

--- SUBJECTS ---
${subjectList}

--- CALENDAR EVENTS ---
${calendarItems}

--- TASKS ---
${assignmentList}

--- EXAMS / QUIZZES ---
${examList}

--- NOTES ---
${notesContext}

--- YOUR CAPABILITIES ---
You can take actions by including a special JSON block in your response. Use markdown code blocks tagged with \`action\`:

\`\`\`action
{"action": "create_calendar_event", "payload": {"title": "...", "date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM", "venue?": "...", "subjectId?": "..."}}
\`\`\`

Supported actions:
- create_calendar_event / update_calendar_event / delete_calendar_event
- create_note / update_note / delete_note
- create_assignment / update_assignment / delete_assignment
- create_exam / update_exam / delete_exam

For note actions, payload must include subjectId and noteId where relevant.
For task/exam create, default status is "todo" and kind is "quiz" if not specified.
If the user asks you to plan a study schedule, analyze the calendar availability, task deadlines, and exam dates, then suggest a schedule. You do not need an action block for suggestions unless you are actually creating events.

Keep responses concise, elegant, and actionable. Use context naturally. Do not mention the raw IDs to the user unless necessary.
`;
}
