import { useState } from "react";
import { Moon, Sun, Type, Palette, Zap, Upload, Trash2, Plus, BookOpen, User, Camera } from "lucide-react";
import type { AcademicOption, AISettings, Theme, StudentTrack, ParsedClass, SemesterData, UserProfile } from "../types";
import { dayLabels, readAsDataUrl } from "../lib/utils";
import { Field } from "../components/Field";
import { Avatar } from "../components/Avatar";
import { AvatarPickerModal } from "../components/AvatarPickerModal";

const themeMeta: { id: Theme; label: string; icon: React.ReactNode; bg: string; accent: string }[] = [
  { id: "light", label: "Light", icon: <Sun size={14} />, bg: "#ffffff", accent: "#18181b" },
  { id: "dark", label: "Dark", icon: <Moon size={14} />, bg: "#0a0a0a", accent: "#fafafa" },
  { id: "typewriter", label: "Typewriter", icon: <Type size={14} />, bg: "#f7f5f0", accent: "#3d3d3d" },
  { id: "modern", label: "Modern", icon: <Palette size={14} />, bg: "#ffffff", accent: "#4f46e5" },
  { id: "cyberpunk", label: "Cyberpunk", icon: <Zap size={14} />, bg: "#05050a", accent: "#00f0ff" },
];

export function SettingsPage({
  calendarOptions, calendarFetchError, selectedCalendar, selectedCalendarId, setSelectedCalendarId,
  track, setTrack, foundationIntake, setFoundationIntake, visibleCalendarOptions,
  timetablePreview, importHtmlFile, importBundledTimetable, applyTimetableImport,
  aiSettings, setAISettings, theme, setTheme,
  semesters, createSemester, deleteSemester,
  userProfile, setUserProfile,
}: {
  calendarOptions: AcademicOption[];
  calendarFetchError: string;
  selectedCalendar: AcademicOption;
  selectedCalendarId: string;
  setSelectedCalendarId: (v: string) => void;
  track: StudentTrack;
  setTrack: (v: StudentTrack) => void;
  foundationIntake: string;
  setFoundationIntake: (v: string) => void;
  visibleCalendarOptions: AcademicOption[];
  timetablePreview: ParsedClass[];
  importHtmlFile: (f: File | undefined) => void;
  importBundledTimetable: () => void;
  applyTimetableImport: () => void;
  aiSettings: AISettings; setAISettings: (v: AISettings) => void;
  theme: Theme; setTheme: (t: Theme) => void;
  semesters: Record<string, SemesterData>;
  createSemester: (id: string, label: string) => void;
  deleteSemester: (id: string) => void;
  userProfile: UserProfile;
  setUserProfile: (v: UserProfile) => void;
}) {
  const foundationIntakes = Array.from(new Set(calendarOptions.filter((o) => o.track === "foundation").map((o) => o.intake ?? ""))).filter(Boolean);
  const [newSemesterName, setNewSemesterName] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);

  const semesterList = Object.entries(semesters).map(([id, data]) => {
    const option = calendarOptions.find((o) => o.id === id);
    return { id, option, data, label: option ? `${option.semester} (${option.startDate})` : id };
  });

  return (
    <div className="grid cols-2 settings-grid">
      {/* Profile */}
      <div className="card settings-profile-card">
        <h2 style={{ margin: "0 0 14px", fontSize: "0.95rem", fontWeight: 600 }}>Profile</h2>
        <div className="settings-profile-avatar-area">
          <div className="settings-avatar-preview" onClick={() => setAvatarOpen(true)}>
            <Avatar profile={userProfile} size={64} alt="Avatar" />
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button className="btn" onClick={() => setAvatarOpen(true)}>
              <Upload size={14} /> Choose avatar
            </button>
            <button className="btn btn-ghost" onClick={() => setUserProfile({ ...userProfile, avatarPreset: { seed: Math.random().toString(36).slice(2) } })}>
              Randomize
            </button>
            {(userProfile.avatarUrl || userProfile.avatarPreset) && (
              <button className="btn btn-ghost btn-danger" onClick={() => setUserProfile({ ...userProfile, avatarUrl: undefined, avatarPreset: undefined })}>
                Remove
              </button>
            )}
          </div>
        </div>
        <Field label="Display name">
          <input className="input" placeholder="Your name" value={userProfile.displayName} onChange={(e) => setUserProfile({ ...userProfile, displayName: e.target.value })} />
        </Field>
        {avatarOpen && (
          <AvatarPickerModal
            profile={userProfile}
            onSave={(patch) => setUserProfile({ ...userProfile, ...patch })}
            onClose={() => setAvatarOpen(false)}
          />
        )}
      </div>

      {/* Appearance */}
      <div className="card">
        <h2 style={{ margin: "0 0 14px", fontSize: "0.95rem", fontWeight: 600 }}>Appearance</h2>
        <div className="theme-swatches">
          {themeMeta.map((t) => (
            <button
              key={t.id}
              className={`theme-swatch ${theme === t.id ? "active" : ""}`}
              onClick={() => setTheme(t.id)}
              title={t.label}
            >
              <div
                className="theme-swatch-preview"
                style={{ background: t.bg, borderColor: t.accent }}
              >
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent, margin: "auto" }} />
              </div>
              <span className="theme-swatch-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Semesters</h2>
        </div>
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {semesterList.map((s) => (
            <div key={s.id} className="preview-row" style={{ padding: "8px 0" }}>
              <div className="row" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                <BookOpen size={14} className="muted" />
                <span style={{ fontWeight: s.id === selectedCalendarId ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
                {s.id === selectedCalendarId && <span className="tag">Active</span>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {s.id !== selectedCalendarId && (
                  <button className="btn btn-ghost" onClick={() => setSelectedCalendarId(s.id)}>Switch</button>
                )}
                {Object.keys(semesters).length > 1 && (
                  <button className="btn btn-ghost btn-danger" onClick={() => deleteSemester(s.id)} aria-label="Delete semester">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="New semester name (e.g. Sep 2026)"
            value={newSemesterName}
            onChange={(e) => setNewSemesterName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            disabled={!newSemesterName.trim()}
            onClick={() => {
              const id = `custom-${newSemesterName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
              createSemester(id, newSemesterName.trim());
              setNewSemesterName("");
            }}
          >
            <Plus size={14} /> Create
          </button>
        </div>
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: 10 }}>
          Each semester has its own subjects, assignments, exams, and notes. Switching semesters preserves all data.
        </p>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Academic calendar</h2>
          <a className="btn btn-ghost" href={selectedCalendar.sourceUrl} target="_blank" rel="noreferrer">Source</a>
        </div>
        {calendarFetchError && <div className="alert warn">Bundled calendar in use: {calendarFetchError}</div>}
        <div className="grid cols-2" style={{ gap: 10 }}>
          <Field label="Student type">
            <select className="select" value={track} onChange={(e) => setTrack(e.target.value as StudentTrack)}>
              <option value="undergraduate">Undergraduate</option>
              <option value="foundation">Foundation</option>
            </select>
          </Field>
          {track === "foundation" && (
            <Field label="Intake">
              <select className="select" value={foundationIntake} onChange={(e) => setFoundationIntake(e.target.value)}>
                {foundationIntakes.map((intake) => <option key={intake}>{intake}</option>)}
              </select>
            </Field>
          )}
          <Field label="Semester range" full>
            <select className="select" value={selectedCalendarId} onChange={(e) => setSelectedCalendarId(e.target.value)}>
              {visibleCalendarOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.intake ? `${option.intake} · ` : ""}{option.semester} ({option.startDate} - {option.endDate})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Import timetable</h2>
          <button className="btn" onClick={importBundledTimetable}>Demo file</button>
        </div>
        <div className="dropzone">
          <label className="dropzone-label">
            <Upload size={14} /> Choose HTML
            <input type="file" accept=".html,text/html" onChange={(e) => importHtmlFile(e.target.files?.[0])} />
          </label>
          <button className="btn btn-primary" disabled={!timetablePreview.length} onClick={applyTimetableImport}>
            Apply {timetablePreview.length || ""} classes
          </button>
        </div>
        {timetablePreview.length > 0 && (
          <div className="settings-preview">
            {timetablePreview.slice(0, 8).map((item) => (
              <div key={item.id} className="preview-row">
                <span className="tag">{dayLabels[item.dayIndex]}</span>
                <span>{item.code}</span>
                <small>{item.start}-{item.end}</small>
              </div>
            ))}
            {timetablePreview.length > 8 && <small className="muted">+{timetablePreview.length - 8} more</small>}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 14px", fontSize: "0.95rem", fontWeight: 600 }}>AI Provider</h2>
        <div className="grid" style={{ gap: 10 }}>
          <Field label="Provider">
            <select className="select" value={aiSettings.provider} onChange={(e) => {
              const provider = e.target.value as AISettings["provider"];
              const defaults: Record<AISettings["provider"], Partial<AISettings>> = {
                "codex-cli": { cliCommand: "codex" },
                "claude-code": { cliCommand: "claude" },
                "opencode": { cliCommand: "opencode" },
                "openai": { cliCommand: "" },
                "anthropic": { cliCommand: "" },
              };
              setAISettings({ ...aiSettings, provider, ...defaults[provider] });
            }}>
              <option value="codex-cli">Codex CLI</option>
              <option value="claude-code">Claude Code</option>
              <option value="opencode">OpenCode</option>
              <option value="openai">OpenAI API</option>
              <option value="anthropic">Anthropic API</option>
            </select>
          </Field>
          {["openai", "anthropic"].includes(aiSettings.provider) && (
            <>
              <Field label="API key (stored locally)">
                <input className="input" type="password" placeholder="sk-…" value={aiSettings.apiKey} onChange={(e) => setAISettings({ ...aiSettings, apiKey: e.target.value })} />
              </Field>
              <Field label="Model">
                <select className="select" value={aiSettings.model} onChange={(e) => setAISettings({ ...aiSettings, model: e.target.value })}>
                  {aiSettings.provider === "openai" ? (
                    <>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o mini</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </>
                  ) : (
                    <>
                      <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
                      <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku</option>
                      <option value="claude-3-opus-latest">Claude 3 Opus</option>
                    </>
                  )}
                </select>
              </Field>
            </>
          )}
          {["codex-cli", "claude-code", "opencode"].includes(aiSettings.provider) && (
            <Field label="CLI command">
              <input className="input" placeholder={
                aiSettings.provider === "claude-code" ? "claude"
                : aiSettings.provider === "codex-cli" ? "codex"
                : "opencode"
              } value={aiSettings.cliCommand} onChange={(e) => setAISettings({ ...aiSettings, cliCommand: e.target.value })} />
            </Field>
          )}
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 14px", fontSize: "0.95rem", fontWeight: 600 }}>Onboarding</h2>
        <p className="muted" style={{ fontSize: "0.84rem", marginBottom: 12 }}>
          {userProfile.onboardingComplete
            ? "You've completed the onboarding tutorial."
            : "New to XMUM OS? Take a quick tour to get started."}
        </p>
        <button className="btn" onClick={() => setUserProfile({ ...userProfile, onboardingComplete: false })}>
          Restart onboarding tutorial
        </button>
      </div>
    </div>
  );
}
