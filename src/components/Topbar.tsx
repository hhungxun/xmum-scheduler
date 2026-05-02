import { Moon, Sun } from "lucide-react";
import type { Page, Theme } from "../types";

const titles: Record<Page, [string, string]> = {
  dashboard: ["Command Center", "Manage everything through conversation"],
  calendar: ["Calendar", "Schedule and weekly overview"],
  knowledge: ["Knowledge", "Notes and AI-assisted writing"],
  assignments: ["Assignments", "Kanban board and task tracking"],
  exams: ["Exams", "Quizzes, grades, and analytics"],
  moodle: ["Moodle", "Course sync and file management"],
  settings: ["Settings", "Semester, timetable, and preferences"],
};

export function Topbar({ page, theme, setTheme }: { page: Page; theme: Theme; setTheme: (t: Theme) => void }) {
  const [title, sub] = titles[page];
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" aria-label="Toggle theme" title="Toggle theme" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </header>
  );
}
