import { useState } from "react";
import { Moon, Sun, Type, Palette, Zap, Upload, Trash2, Plus, BookOpen, User, Cloud, Compass, ChevronRight, RotateCcw, Folder, FolderOpen, FileText } from "lucide-react";
import type { AcademicOption, AISettings, Theme, StudentTrack, ParsedClass, SemesterData, UserProfile } from "../types";
import { dayLabels } from "../lib/utils";
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

const PROVIDER_SETUP: {
  id: string;
  name: string;
  category: "api" | "cli";
  status: "available" | "unavailable";
  instructions: string;
  link?: string;
}[] = [
  {
    id: "openai",
    name: "OpenAI",
    category: "api",
    status: "available",
    instructions: "Add your API key to enable OpenAI models. Get a key at platform.openai.com",
    link: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "api",
    status: "available",
    instructions: "Add your API key to enable Claude models. Get a key at console.anthropic.com",
    link: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    category: "cli",
    status: "unavailable",
    instructions: "Install Codex CLI globally: npm install -g @openai/codex",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    category: "cli",
    status: "unavailable",
    instructions: "Install Claude Code: npm install -g @anthropic-ai/claude-code",
  },
  {
    id: "opencode",
    name: "OpenCode",
    category: "cli",
    status: "unavailable",
    instructions: "Install OpenCode CLI. Configure in your terminal to enable local models.",
  },
];

type SettingsTab = "profile" | "appearance" | "calendar" | "ai" | "data" | "storage" | "moodle" | "onboarding";

export function SettingsPage({
  calendarOptions, calendarFetchError, selectedCalendar, selectedCalendarId, setSelectedCalendarId,
  track, setTrack, foundationIntake, setFoundationIntake, visibleCalendarOptions,
  timetablePreview, importHtmlFile, importBundledTimetable, applyTimetableImport,
  aiSettings, setAISettings, theme, setTheme,
  semesters, createSemester, deleteSemester,
  userProfile, setUserProfile,
  onPickNotesDirectory,
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
  onPickNotesDirectory: () => void;
}) {
  const foundationIntakes = Array.from(new Set(calendarOptions.filter((o) => o.track === "foundation").map((o) => o.intake ?? ""))).filter(Boolean);
  const [newSemesterName, setNewSemesterName] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [apiKeyInput, setApiKeyInput] = useState(aiSettings.apiKey);

  const semesterList = Object.entries(semesters).map(([id, data]) => {
    const option = calendarOptions.find((o) => o.id === id);
    return { id, option, data, label: option ? `${option.semester} (${option.startDate})` : id };
  });

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User size={14} /> },
    { id: "appearance", label: "Appearance", icon: <Palette size={14} /> },
    { id: "calendar", label: "Calendar", icon: <BookOpen size={14} /> },
    { id: "ai", label: "AI", icon: <Zap size={14} /> },
    { id: "data", label: "Data", icon: <Upload size={14} /> },
    { id: "storage", label: "Storage", icon: <Folder size={14} /> },
    { id: "moodle", label: "Moodle", icon: <Cloud size={14} /> },
    { id: "onboarding", label: "Onboarding", icon: <Compass size={14} /> },
  ];

  return (
    <div className="settings-page">
      {/* Tab navigation */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="settings-content">
        {activeTab === "profile" && (
          <div className="settings-section">
            <div className="settings-block">
              <div className="settings-block-title"><h3>Avatar &amp; identity</h3></div>
              <p className="settings-block-desc">How you appear in the sidebar and chat. Stored locally on this device only.</p>
              <div className="settings-profile-area">
                <div className="settings-avatar-section">
                  <div className="settings-avatar-preview" onClick={() => setAvatarOpen(true)}>
                    <Avatar profile={userProfile} size={64} alt="Avatar" />
                  </div>
                  <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    <button className="btn btn-sm" onClick={() => setAvatarOpen(true)}>
                      <Upload size={13} /> Choose avatar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setUserProfile({ ...userProfile, avatarPreset: { seed: Math.random().toString(36).slice(2) } })}>
                      Randomize
                    </button>
                    {(userProfile.avatarUrl || userProfile.avatarPreset) && (
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => setUserProfile({ ...userProfile, avatarUrl: undefined, avatarPreset: undefined })}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <Field label="Display name">
                  <input className="input" placeholder="Your name" value={userProfile.displayName} onChange={(e) => setUserProfile({ ...userProfile, displayName: e.target.value })} />
                </Field>
              </div>
            </div>
            {avatarOpen && (
              <AvatarPickerModal
                profile={userProfile}
                onSave={(patch) => setUserProfile({ ...userProfile, ...patch })}
                onClose={() => setAvatarOpen(false)}
              />
            )}
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="settings-section">
            <div className="settings-block">
              <div className="settings-block-title"><h3>Theme</h3></div>
              <p className="settings-block-desc">Choose how XMUM OS looks. Themes affect every page.</p>
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
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="settings-section">
            <div className="settings-block">
              <div className="settings-block-title">
                <h3>Academic calendar</h3>
                <a className="btn btn-ghost btn-sm" href={selectedCalendar.sourceUrl} target="_blank" rel="noreferrer">Source <ChevronRight size={12} /></a>
              </div>
              <p className="settings-block-desc">Used by the calendar grid and recurring class events. Pick the period that matches your XMUM intake.</p>
              {calendarFetchError && <div className="alert warn">Bundled calendar in use: {calendarFetchError}</div>}
              <div className="settings-grid-2">
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

            <div className="settings-block">
              <div className="settings-block-title"><h3>Semesters</h3></div>
              <p className="settings-block-desc">Each semester keeps its own subjects, tasks, exams, and notes. Switching semesters preserves all data.</p>
              <div style={{ display: "grid", gap: 6 }}>
                {semesterList.map((s) => (
                  <div key={s.id} className="settings-row">
                    <div className="row" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                      <BookOpen size={14} className="muted" />
                      <span style={{ fontWeight: s.id === selectedCalendarId ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.label}
                      </span>
                      {s.id === selectedCalendarId && <span className="status-badge status-success"><span className="dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />Active</span>}
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      {s.id !== selectedCalendarId && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCalendarId(s.id)}>Switch</button>
                      )}
                      {Object.keys(semesters).length > 1 && (
                        <button className="btn btn-ghost btn-danger btn-sm" onClick={() => deleteSemester(s.id)} aria-label="Delete semester">
                          <Trash2 size={12} />
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
                  className="btn btn-primary btn-sm"
                  disabled={!newSemesterName.trim()}
                  onClick={() => {
                    const id = `custom-${newSemesterName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
                    createSemester(id, newSemesterName.trim());
                    setNewSemesterName("");
                  }}
                >
                  <Plus size={13} /> Create
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="settings-section">
            <div className="settings-block">
              <div className="settings-block-title">
                <h3>AI providers</h3>
              </div>
              <p className="settings-block-desc">
                Configure your available AI providers below. You choose which model to use per conversation in the chat composer — there is no single &ldquo;active&rdquo; provider.
              </p>
            </div>

            <div className="settings-block">
              <div className="settings-block-title"><h3>API providers</h3></div>
              <p className="settings-block-desc">Add a key to use cloud models. Keys are stored locally on this device only.</p>
              <div className="ai-provider-list">
                {PROVIDER_SETUP.filter((p) => p.category === "api").map((p) => {
                  const isConfigured = !!aiSettings.apiKey && aiSettings.provider === p.id;
                  return (
                    <div key={p.id} className="ai-provider-card">
                      <div className="ai-provider-info">
                        <div className="ai-provider-header">
                          <div className="row" style={{ gap: 8 }}>
                            <span className={`ai-status-dot ${isConfigured ? "on" : "off"}`} />
                            <strong>{p.name}</strong>
                            <span className="ai-provider-badge">API</span>
                          </div>
                          <span className={`ai-status-label ${isConfigured ? "on" : "off"}`}>
                            {isConfigured ? "Connected" : "Ready to connect"}
                          </span>
                        </div>
                        <p className="ai-provider-desc">{p.instructions}</p>
                        {p.link && (
                          <a href={p.link} target="_blank" rel="noreferrer" className="ai-provider-link">
                            Get API key <ChevronRight size={12} />
                          </a>
                        )}
                      </div>
                      <div className="ai-provider-action">
                        <input
                          className="input input-sm"
                          type="password"
                          placeholder="sk-…"
                          value={aiSettings.provider === p.id ? apiKeyInput : ""}
                          onChange={(e) => {
                            setApiKeyInput(e.target.value);
                            if (aiSettings.provider === p.id) {
                              setAISettings({ ...aiSettings, apiKey: e.target.value });
                            }
                          }}
                          onFocus={() => {
                            if (aiSettings.provider !== p.id) {
                              setAISettings({ ...aiSettings, provider: p.id as AISettings["provider"], apiKey: "" });
                              setApiKeyInput("");
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="settings-block">
              <div className="settings-block-title"><h3>CLI providers</h3></div>
              <p className="settings-block-desc">Run AI through a local command. The CLI must be installed and on your PATH.</p>
              <div className="ai-provider-list">
                {PROVIDER_SETUP.filter((p) => p.category === "cli").map((p) => {
                  const isConfigured = !!aiSettings.cliCommand && aiSettings.provider === p.id;
                  return (
                    <div key={p.id} className="ai-provider-card">
                      <div className="ai-provider-info">
                        <div className="ai-provider-header">
                          <div className="row" style={{ gap: 8 }}>
                            <span className={`ai-status-dot ${isConfigured ? "on" : "off"}`} />
                            <strong>{p.name}</strong>
                            <span className="ai-provider-badge">CLI</span>
                          </div>
                          <span className={`ai-status-label ${isConfigured ? "on" : "off"}`}>
                            {isConfigured ? "Connected" : "Not configured"}
                          </span>
                        </div>
                        <p className="ai-provider-desc">{p.instructions}</p>
                      </div>
                      <div className="ai-provider-action">
                        <input
                          className="input input-sm"
                          placeholder={p.id === "claude-code" ? "claude" : p.id === "codex-cli" ? "codex" : "opencode"}
                          value={aiSettings.provider === p.id ? aiSettings.cliCommand : ""}
                          onChange={(e) => {
                            if (aiSettings.provider === p.id) {
                              setAISettings({ ...aiSettings, cliCommand: e.target.value });
                            }
                          }}
                          onFocus={() => {
                            if (aiSettings.provider !== p.id) {
                              setAISettings({ ...aiSettings, provider: p.id as AISettings["provider"], cliCommand: "" });
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="settings-section">
            <div className="settings-block">
              <div className="settings-block-title">
                <h3>Import timetable</h3>
                <button className="btn btn-sm" onClick={importBundledTimetable}>Use demo file</button>
              </div>
              <p className="settings-block-desc">
                Save your XMUM timetable from <code>ac.xmu.edu.my</code> as an <code>.html</code> file, then drop it here.
                Subjects, lecturers, venues, and recurring class events are created automatically.
              </p>
              <div className="dropzone">
                <label className="dropzone-label">
                  <Upload size={14} /> Choose HTML
                  <input type="file" accept=".html,text/html" onChange={(e) => importHtmlFile(e.target.files?.[0])} />
                </label>
                <button className="btn btn-primary btn-sm" disabled={!timetablePreview.length} onClick={applyTimetableImport}>
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

            <div className="settings-block">
              <div className="settings-block-title"><h3>Backup &amp; restore</h3></div>
              <p className="settings-block-desc">
                All your data — subjects, semesters, tasks, exams, notes, conversations — lives in your browser&apos;s local storage.
                Use these to take a snapshot or move to another device.
              </p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-sm" onClick={() => {
                  const dump: Record<string, unknown> = {};
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith("xmum.")) { try { dump[k] = JSON.parse(localStorage.getItem(k) ?? "null"); } catch { dump[k] = localStorage.getItem(k); } }
                  }
                  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `xmum-os-backup-${new Date().toISOString().slice(0,10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}><Upload size={13} style={{ transform: "rotate(180deg)" }} /> Export all data</button>
                <label className="btn btn-sm">
                  <Upload size={13} /> Import backup
                  <input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    file.text().then((text) => {
                      try {
                        const dump = JSON.parse(text);
                        if (!confirm("Restore from this backup? Existing data with the same keys will be overwritten.")) return;
                        for (const [k, v] of Object.entries(dump)) {
                          if (k.startsWith("xmum.")) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
                        }
                        alert("Backup restored. Reloading…");
                        window.location.reload();
                      } catch (err) { alert("Invalid backup file: " + (err as Error).message); }
                    });
                  }} />
                </label>
              </div>
            </div>

            <div className="settings-block">
              <div className="settings-block-title"><h3 style={{ color: "var(--danger)" }}>Reset data</h3></div>
              <p className="settings-block-desc">Wipes all subjects, tasks, exams, notes, conversations, and settings on this device. Cannot be undone.</p>
              <div>
                <button className="btn btn-danger btn-sm" onClick={() => {
                  if (!confirm("This will delete all XMUM OS data on this device. Continue?")) return;
                  if (!confirm("Really delete everything? This cannot be undone.")) return;
                  const keys: string[] = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i); if (k && k.startsWith("xmum.")) keys.push(k);
                  }
                  keys.forEach((k) => localStorage.removeItem(k));
                  window.location.reload();
                }}><Trash2 size={13} /> Reset all data</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "storage" && (
          <div className="settings-section">
            <div className="settings-block">
              <div className="settings-block-title"><h3>Notes directory</h3></div>
              <p className="settings-block-desc">
                Choose where your notes are saved locally as Markdown files. Changing this will move your notes to the new location on the next sync.
              </p>
              <div className="field">
                <div className="ob-input-with-btn">
                  <input
                    className="input"
                    value={userProfile.notesDirectory ?? ""}
                    readOnly
                    placeholder="Default app data folder"
                  />
                  <button type="button" className="btn" onClick={onPickNotesDirectory}>
                    <FolderOpen size={14} /> Browse
                  </button>
                </div>
                <span className="ob-input-hint" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: "var(--muted)", fontSize: "0.78rem" }}>
                  <FileText size={12} /> {userProfile.notesDirectory ? "Notes will be saved here" : "Using default app data location"}
                </span>
              </div>
              {userProfile.notesDirectory && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setUserProfile({ ...userProfile, notesDirectory: undefined })}
                >
                  Reset to default location
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "moodle" && (
          <div className="settings-section">
            <div className="settings-block">
              <div className="settings-block-title"><h3>Moodle sync</h3></div>
              <p className="settings-block-desc">
                Manage Moodle from the dedicated <strong>Moodle</strong> section in the sidebar — sign in, choose courses to sync,
                link them as subjects, and download files for offline access. Synced files are then referenceable from chat with <code>@</code>.
              </p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="settings-status-pill"><span className="dot" />Open the Moodle tab in the sidebar to manage sync</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "onboarding" && (
          <div className="settings-section">
            <div className="settings-block">
              <div className="settings-block-title">
                <h3>Onboarding tutorial</h3>
                <span className={`settings-status-pill ${userProfile.onboardingComplete ? "on" : ""}`}>
                  <span className="dot" />{userProfile.onboardingComplete ? "Completed" : "Not started"}
                </span>
              </div>
              <p className="settings-block-desc">
                The onboarding flow walks you through importing your timetable, connecting Moodle, configuring an AI provider,
                and learning the slash-command vocabulary. You can replay it any time.
              </p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-sm" onClick={() => setUserProfile({ ...userProfile, onboardingComplete: false })}>
                  <RotateCcw size={13} /> Restart onboarding
                </button>
              </div>
            </div>
            <div className="settings-block">
              <div className="settings-block-title"><h3>What onboarding covers</h3></div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>
                <li>Profile setup — your name and avatar</li>
                <li>Choosing your academic semester</li>
                <li>Importing your XMUM timetable HTML</li>
                <li>Connecting Moodle and selecting courses</li>
                <li>Configuring an AI provider or local CLI</li>
                <li>Slash commands (<code>/plan</code>, <code>/schedule-study</code>, …) and <code>@</code>-mentions for files</li>
                <li>An optional interactive tour of every page</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
