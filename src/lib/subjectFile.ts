import type { Subject, ExamRecord, ExamStatus } from "../types";
import { uid } from "./utils";

export type KnowledgePoint = {
  name: string;
  completed: boolean;
  linkedNoteId?: string;
};

export type CourseChapter = {
  title: string;
  points: KnowledgePoint[];
};

export type SubjectBasicInfo = {
  lecturer: string;
  venue: string;
  semester: string;
  creditHours: string;
};

export type ParsedSubjectFile = {
  basicInfo: SubjectBasicInfo;
  chapters: CourseChapter[];
  assessments: Partial<ExamRecord>[];
};

const defaultBasicInfo = (): SubjectBasicInfo => ({
  lecturer: "",
  venue: "",
  semester: "",
  creditHours: "",
});

const defaultChapters = (): CourseChapter[] => [
  { title: "Chapter 1", points: [{ name: "Point 1", completed: false }] },
  { title: "Chapter 2", points: [{ name: "Point 1", completed: false }] },
  { title: "Chapter 3", points: [{ name: "Point 1", completed: false }] },
];

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function parseTable(markdown: string, heading: string): string[][] | null {
  const idx = markdown.indexOf(heading);
  if (idx === -1) return null;
  const after = markdown.slice(idx + heading.length);
  const lines = after.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows: string[][] = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith("|")) {
      inTable = true;
      // skip separator lines like |---|---|
      if (/^\|[-\s:|]+\|$/.test(line)) continue;
      // split and preserve empty cells by dropping only the leading/trailing empty strings from |...|
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length > 1) {
        rows.push(cells);
      }
    } else if (inTable) {
      break;
    }
  }
  return rows.length ? rows : null;
}

export function parseSubjectFile(markdown: string): ParsedSubjectFile {
  const basicInfo = { ...defaultBasicInfo() };
  const basicRows = parseTable(markdown, "## Basic Information");
  if (basicRows) {
    for (const row of basicRows) {
      const key = row[0]?.toLowerCase().trim();
      const val = row[1]?.trim() ?? "";
      if (key.includes("lecturer")) basicInfo.lecturer = val;
      else if (key.includes("venue")) basicInfo.venue = val;
      else if (key.includes("semester")) basicInfo.semester = val;
      else if (key.includes("credit")) basicInfo.creditHours = val;
    }
  }

  const chapters: CourseChapter[] = [];
  const contentRows = parseTable(markdown, "## Course Content");
  if (contentRows && contentRows.length > 1) {
    const headers = contentRows[0];
    for (let i = 1; i < contentRows.length; i++) {
      const row = contentRows[i];
      if (row.length < 2) continue;
      const chapterMatch = row[0].match(/^Chapter\s*\d*[:\s]*(.*)$/i);
      const title = chapterMatch ? chapterMatch[1].trim() : row[0].trim();
      const points: KnowledgePoint[] = [];
      // last column is always progress; skip it
      for (let j = 1; j < row.length - 1; j++) {
        const cell = row[j].trim();
        if (!cell) continue;
        const kpMatch = cell.match(/^\[([ xX])\]\s*(.*)$/);
        if (!kpMatch) continue; // skip anything that doesn't look like a checkbox
        const name = kpMatch[2].trim();
        if (!name) continue;
        points.push({ name, completed: kpMatch[1].toLowerCase() === "x" });
      }
      chapters.push({ title: title || `Chapter ${i}`, points });
    }
  }

  const assessments: Partial<ExamRecord>[] = [];
  const planRows = parseTable(markdown, "## Assessment Plan");
  if (planRows && planRows.length > 1) {
    const headers = planRows[0].map((h) => h.toLowerCase());
    for (let i = 1; i < planRows.length; i++) {
      const row = planRows[i];
      const get = (keys: string[]) => {
        for (const k of keys) {
          const idx = headers.findIndex((h) => h.includes(k));
          if (idx !== -1) return row[idx]?.trim() ?? "";
        }
        return "";
      };
      const name = get(["assessment", "component", "name"]);
      if (!name) continue;
      const weight = parseFloat(get(["weight"])) || 0;
      const score = parseFloat(get(["score obtained", "score"])) || 0;
      const maxScore = parseFloat(get(["full marks", "full", "max"])) || 100;
      const status = (get(["status"]).toLowerCase().replace(/\s/g, "-") as ExamStatus) || "not-started";
      const kind: ExamRecord["kind"] =
        name.toLowerCase().includes("quiz") ? "quiz"
        : name.toLowerCase().includes("midterm") ? "midterm"
        : name.toLowerCase().includes("final") ? "final"
        : name.toLowerCase().includes("lab") ? "lab"
        : "other";
      assessments.push({ title: name, weight, score, maxScore, status, kind });
    }
  }

  return { basicInfo, chapters: chapters.length ? chapters : defaultChapters(), assessments };
}

function chapterProgress(chapter: CourseChapter): number {
  if (!chapter.points.length) return 0;
  const done = chapter.points.filter((p) => p.completed).length;
  return Math.round((done / chapter.points.length) * 100);
}

function overallProgress(chapters: CourseChapter[]): number {
  const total = chapters.reduce((sum, c) => sum + c.points.length, 0);
  if (!total) return 0;
  const done = chapters.reduce((sum, c) => sum + c.points.filter((p) => p.completed).length, 0);
  return Math.round((done / total) * 100);
}

function progressBar(pct: number, width = 10): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty));
}

function weightedScore(exam: ExamRecord): number {
  if (exam.maxScore <= 0) return 0;
  return (exam.score / exam.maxScore) * (exam.weight ?? 0);
}

export function generateSubjectFileMarkdown(
  subject: Subject,
  exams: ExamRecord[],
  overrides?: { basicInfo?: SubjectBasicInfo; chapters?: CourseChapter[] }
): string {
  const parsed = parseSubjectFile(subject.courseInfo);
  const basic = overrides?.basicInfo ?? parsed.basicInfo;
  const chapters = overrides?.chapters ?? parsed.chapters;
  const subjectExams = exams.filter((e) => e.subjectId === subject.id);

  const maxPoints = Math.max(3, ...chapters.map((c) => c.points.length));
  const kpHeaders = Array.from({ length: maxPoints }, (_, i) => `Knowledge Point ${i + 1}`);

  let md = `# ${subject.code} ${subject.name}\n\n`;

  md += `## Basic Information\n\n`;
  md += `| Field | Value |\n|---|---|\n`;
  md += `| Lecturer | ${escapeCell(basic.lecturer || subject.lecturer || "")} |\n`;
  md += `| Venue | ${escapeCell(basic.venue)} |\n`;
  md += `| Credit Hours | ${escapeCell(basic.creditHours)} |\n`;
  md += `\n`;

  md += `## Course Content\n\n`;
  md += `| Chapter | ${kpHeaders.join(" | ")} | Chapter Progress |\n`;
  md += `|---|${kpHeaders.map(() => "---").join("|")}|---|\n`;
  for (const chapter of chapters) {
    const pct = chapterProgress(chapter);
    const rowCells = kpHeaders.map((_, i) => {
      const p = chapter.points[i];
      if (!p) return "";
      return `${p.completed ? "[x]" : "[ ]"} ${escapeCell(p.name)}`;
    });
    md += `| Chapter ${chapters.indexOf(chapter) + 1}: ${escapeCell(chapter.title)} | ${rowCells.join(" | ")} | ${progressBar(pct)} ${pct}% |\n`;
  }
  const overall = overallProgress(chapters);
  md += `\n**Overall Course Progress:** ${progressBar(overall)} **${overall}%**\n\n`;

  md += `## Assessment Plan\n\n`;
  md += `| Assessment Component | Weight (%) | Score Obtained | Full Marks | Weighted Score | Status |\n`;
  md += `|---|---:|---:|---:|---:|---|\n`;
  let totalWeight = 0;
  for (const exam of subjectExams) {
    const ws = weightedScore(exam);
    totalWeight += exam.weight ?? 0;
    const status = exam.status ?? "not-started";
    md += `| ${escapeCell(exam.title)} | ${exam.weight ?? 0} | ${exam.score ?? ""} | ${exam.maxScore ?? 100} | ${ws.toFixed(1)} | ${status.replace(/-/g, " ")} |\n`;
  }
  md += `\n**Total Weight:** ${totalWeight}%${totalWeight !== 100 ? " ⚠️ Should be 100%" : ""}\n\n`;

  md += `## Examination / Quiz Statistics\n\n`;
  const completedExams = subjectExams.filter((e) => (e.score ?? 0) > 0 || e.status === "completed" || e.status === "released");
  const completedWeight = completedExams.reduce((s, e) => s + (e.weight ?? 0), 0);
  const totalWeighted = subjectExams.reduce((s, e) => s + weightedScore(e), 0);
  const currentAvg = completedWeight > 0 ? (totalWeighted / completedWeight) * 100 : 0;
  const remaining = Math.max(0, 100 - completedWeight);
  md += `- **Current completed assessment percentage:** ${completedWeight}%\n`;
  md += `- **Current weighted score:** ${totalWeighted.toFixed(1)}%\n`;
  md += `- **Remaining percentage:** ${remaining}%\n`;
  md += `- **Estimated final grade:** ${estimateGrade(currentAvg)}\n`;
  md += `- **Progress by assessment type:**\n`;
  const byKind = new Map<string, number>();
  for (const e of subjectExams) {
    const key = e.kind ?? "other";
    byKind.set(key, (byKind.get(key) ?? 0) + (e.weight ?? 0));
  }
  for (const [kind, w] of byKind) {
    md += `  - ${kind}: ${w}%\n`;
  }
  md += `- **Upcoming incomplete assessments:**\n`;
  const upcoming = subjectExams.filter((e) => e.status !== "completed" && e.status !== "released").sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) md += `  - None\n`;
  for (const e of upcoming) {
    md += `  - ${escapeCell(e.title)} (${e.date}) — ${e.weight ?? 0}%\n`;
  }
  md += `\n`;

  return md;
}

function estimateGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 75) return "A-";
  if (pct >= 70) return "B+";
  if (pct >= 65) return "B";
  if (pct >= 60) return "B-";
  if (pct >= 55) return "C+";
  if (pct >= 50) return "C";
  if (pct >= 45) return "C-";
  if (pct >= 40) return "D+";
  return "F";
}

export function syncAssessmentsToExams(
  subjectId: string,
  assessments: Partial<ExamRecord>[],
  existingExams: ExamRecord[],
): ExamRecord[] {
  const subjectExams = existingExams.filter((e) => e.subjectId === subjectId);
  const remaining = existingExams.filter((e) => e.subjectId !== subjectId);
  const updated: ExamRecord[] = [];
  const usedIds = new Set<string>();

  for (const a of assessments) {
    const match = subjectExams.find((e) => e.title === a.title && !usedIds.has(e.id));
    if (match) {
      usedIds.add(match.id);
      updated.push({
        ...match,
        weight: a.weight ?? match.weight,
        score: a.score ?? match.score,
        maxScore: a.maxScore ?? match.maxScore,
        status: a.status ?? match.status,
        kind: a.kind ?? match.kind,
      });
    } else {
      updated.push({
        id: uid("exam"),
        subjectId,
        title: a.title ?? "Untitled",
        kind: a.kind ?? "other",
        date: new Date().toISOString().slice(0, 10),
        weight: a.weight ?? 0,
        score: a.score ?? 0,
        maxScore: a.maxScore ?? 100,
        notes: "",
        status: a.status ?? "not-started",
        attachments: [],
      });
    }
  }

  return [...remaining, ...updated];
}

export function defaultSubjectFileMarkdown(subject: Subject): string {
  return `# ${subject.code} ${subject.name}

## Basic Information

| Field | Value |
|---|---|
| Lecturer | ${subject.lecturer || ""} |
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
}
