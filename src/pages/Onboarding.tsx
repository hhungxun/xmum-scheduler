import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRight, ArrowLeft, Sparkles, User, Calendar, BookOpen, Cloud, BrainCircuit, Compass, CheckCircle2, GraduationCap, Upload, Dices, Monitor, FileText, ClipboardList, Trophy, Settings, MessageSquare, Palette, LayoutDashboard, X, ChevronRight, ExternalLink, Loader2, AlertCircle, FileCheck, FolderSync, Zap, KeyRound, Terminal, Bot, Eye, EyeOff, Lock, Globe, BookMarked, Target, Bell, Layers, Search, Clock, PenTool, BarChart3, CheckCheck, PartyPopper, RotateCcw, SkipForward, Folder, FolderOpen, CircleDot, CircleCheck, CircleX, Info, Rocket
} from "lucide-react";
import type {
  UserProfile, AcademicOption, AISettings, AIProvider, Theme, MoodleState, ParsedClass, Subject
} from "../types";
import { Avatar, PRESETS, randomAvatarPreset } from "../components/Avatar";
import { readAsDataUrl } from "../lib/utils";

type OnboardingStep =
  | "welcome"
  | "profile"
  | "storage"
  | "semester"
  | "timetable"
  | "moodle"
  | "ai-setup"
  | "getting-started"
  | "complete";

interface OnboardingProps {
  userProfile: UserProfile;
  setUserProfile: (v: UserProfile) => void;
  onComplete: () => void;
  onStartTour: () => void;

  // Semester / Timetable
  calendarOptions: AcademicOption[];
  track: "undergraduate" | "foundation";
  setTrack: (v: "undergraduate" | "foundation") => void;
  foundationIntake: string;
  setFoundationIntake: (v: string) => void;
  selectedCalendarId: string;
  setSelectedCalendarId: (v: string) => void;
  timetablePreview: ParsedClass[];
  importHtmlFile: (f: File | undefined) => void;
  importBundledTimetable: () => void;
  applyTimetableImport: () => void;

  // Moodle
  moodle: MoodleState;
  setMoodle: (v: MoodleState | ((prev: MoodleState) => MoodleState)) => void;
  moodlePassword: string;
  setMoodlePassword: (v: string) => void;
  moodleLogin: (e: React.FormEvent<HTMLFormElement>, usernameOverride?: string) => Promise<void>;
  toggleMoodleCourse: (id: number) => void;
  applyMoodleSelection: () => void;
  syncMoodleFiles: () => Promise<void>;

  // AI
  aiSettings: AISettings;
  setAISettings: (v: AISettings) => void;

  // Storage
  notesDirectory: string | undefined;
  onPickNotesDirectory: () => void;

  // Subjects (from timetable, for Moodle matching)
  subjects: Subject[];

  // Navigation
  nav: (page: import("../types").Page) => void;
}

const STEPS: { id: OnboardingStep; label: string; icon: React.ReactNode }[] = [
  { id: "welcome", label: "Welcome", icon: <Rocket size={14} /> },
  { id: "profile", label: "Profile", icon: <User size={14} /> },
  { id: "storage", label: "Storage", icon: <Folder size={14} /> },
  { id: "semester", label: "Semester", icon: <Calendar size={14} /> },
  { id: "timetable", label: "Timetable", icon: <BookOpen size={14} /> },
  { id: "moodle", label: "Moodle", icon: <Cloud size={14} /> },
  { id: "ai-setup", label: "AI", icon: <BrainCircuit size={14} /> },
  { id: "getting-started", label: "Get Started", icon: <Sparkles size={14} /> },
  { id: "complete", label: "Done", icon: <CheckCircle2 size={14} /> },
];

const STEP_ORDER: OnboardingStep[] = STEPS.map((s) => s.id);

const providerMeta: { id: AIProvider; label: string; desc: string; icon: React.ReactNode; needsKey: boolean; needsCli: boolean; defaultCli: string; checkCmd?: string }[] = [
  { id: "openai", label: "OpenAI", desc: "GPT-4o, GPT-4o-mini", icon: <Bot size={18} />, needsKey: true, needsCli: false, defaultCli: "" },
  { id: "anthropic", label: "Anthropic", desc: "Claude 3.5 Haiku, Sonnet", icon: <Sparkles size={18} />, needsKey: true, needsCli: false, defaultCli: "" },
  { id: "claude-code", label: "Claude Code", desc: "Local Claude CLI", icon: <Terminal size={18} />, needsKey: false, needsCli: true, defaultCli: "claude", checkCmd: "claude" },
  { id: "codex-cli", label: "Codex CLI", desc: "OpenAI Codex CLI", icon: <Zap size={18} />, needsKey: false, needsCli: true, defaultCli: "codex", checkCmd: "codex" },
  { id: "opencode", label: "Opencode", desc: "Opencode CLI", icon: <KeyRound size={18} />, needsKey: false, needsCli: true, defaultCli: "opencode", checkCmd: "opencode" },
];

function useStepNavigation(initial: OnboardingStep = "welcome") {
  const [step, setStep] = useState<OnboardingStep>(initial);
  const idx = STEP_ORDER.indexOf(step);
  const canGoBack = idx > 0;
  const canGoForward = idx < STEP_ORDER.length - 1;
  const progress = ((idx + 1) / STEP_ORDER.length) * 100;

  const next = useCallback(() => {
    if (canGoForward) setStep(STEP_ORDER[idx + 1]);
  }, [idx, canGoForward]);

  const back = useCallback(() => {
    if (canGoBack) setStep(STEP_ORDER[idx - 1]);
  }, [idx, canGoBack]);

  const goTo = useCallback((s: OnboardingStep) => setStep(s), []);

  return { step, idx, next, back, goTo, canGoBack, canGoForward, progress };
}

/* ═══════════════════════════════════════════
   WELCOME STEP
   ═══════════════════════════════════════════ */
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="ob-step ob-step-welcome">
      <div className="ob-hero">
        <div className="ob-hero-icon">
          <BrainCircuit size={56} strokeWidth={1.2} />
        </div>
        <h1 className="ob-hero-title">Welcome to XMUM OS</h1>
        <p className="ob-hero-subtitle">
          Your <strong>AI-powered academic workspace</strong>. Timetable, Moodle, tasks, exams, and notes — unified and intelligent.
        </p>
      </div>

      <div className="ob-features-grid">
        <div className="ob-feature-card">
          <Calendar size={22} />
          <strong>Smart Schedule</strong>
          <span>Import from <code>ac.xmu.edu.my</code>, auto-generate events</span>
        </div>
        <div className="ob-feature-card">
          <Cloud size={22} />
          <strong>Moodle Sync</strong>
          <span>Course files linked to subjects, accessible offline</span>
        </div>
        <div className="ob-feature-card">
          <BrainCircuit size={22} />
          <strong>AI Assistant</strong>
          <span>Plan, summarize, create tasks — all through chat</span>
        </div>
        <div className="ob-feature-card">
          <Folder size={22} />
          <strong>Local-first Notes</strong>
          <span>Markdown notes saved to your filesystem</span>
        </div>
      </div>

      <div className="ob-step-actions center">
        <button className="btn btn-primary ob-btn-xl" onClick={onNext}>
          Get Started <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PROFILE STEP
   ═══════════════════════════════════════════ */
function ProfileStep({
  userProfile, setUserProfile, onNext, onBack
}: {
  userProfile: UserProfile;
  setUserProfile: (v: UserProfile) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(userProfile.displayName);
  const [preset, setPreset] = useState(userProfile.avatarPreset ?? PRESETS[0]);
  const [uploadedUrl, setUploadedUrl] = useState<string | undefined>(userProfile.avatarUrl);
  const [error, setError] = useState("");

  const preview = {
    displayName: name || "Student",
    avatarUrl: uploadedUrl,
    avatarPreset: uploadedUrl ? undefined : preset,
  };

  const isValid = name.trim().length > 0;

  function save() {
    if (!isValid) {
      setError("Please enter your name");
      return;
    }
    setUserProfile({
      ...userProfile,
      displayName: name.trim(),
      avatarUrl: uploadedUrl,
      avatarPreset: uploadedUrl ? undefined : preset,
    });
    onNext();
  }

  return (
    <div className="ob-step ob-step-profile">
      <div className="ob-step-header">
        <h2>Set up your profile</h2>
        <p>Personalize your workspace with a name and avatar</p>
      </div>

      <div className="ob-profile-preview">
        <Avatar profile={preview} size={96} alt="Preview" />
        <div className="ob-profile-name-display">{preview.displayName || "Your name"}</div>
      </div>

      <div className="ob-form">
        <div className="field">
          <label className="field-label">Display name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && isValid) save(); }}
            placeholder="Enter your name"
            autoFocus
          />
          {error && <span className="field-error">{error}</span>}
        </div>

        <div className="field">
          <label className="field-label">Choose an avatar</label>
          <div className="ob-avatar-grid">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                className={`ob-avatar-option ${preset.seed === p.seed && !uploadedUrl ? "selected" : ""}`}
                onClick={() => { setPreset(p); setUploadedUrl(undefined); }}
                title={p.seed}
              >
                <Avatar profile={{ avatarPreset: p }} size={52} alt={p.seed} />
              </button>
            ))}
            <button
              className="ob-avatar-option ob-avatar-random"
              onClick={() => { const r = randomAvatarPreset(); setPreset(r); setUploadedUrl(undefined); }}
              title="Randomize"
            >
              <Dices size={24} />
            </button>
            <label className="ob-avatar-option ob-avatar-upload" title="Upload photo">
              <Upload size={24} />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB"); return; }
                  readAsDataUrl(file).then((url) => setUploadedUrl(url));
                }}
              />
            </label>
          </div>
          {uploadedUrl && (
            <button className="btn btn-ghost" style={{ fontSize: "0.8rem", marginTop: 8 }} onClick={() => setUploadedUrl(undefined)}>
              Remove uploaded photo
            </button>
          )}
        </div>
      </div>

      <StepActions onBack={onBack} onNext={save} nextLabel="Continue" nextVariant={isValid ? "primary" : "ghost"} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   STORAGE STEP — choose where to save notes locally
   ═══════════════════════════════════════════ */
function StorageStep({
  notesDirectory, onPickNotesDirectory, onNext, onBack
}: {
  notesDirectory: string | undefined;
  onPickNotesDirectory: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="ob-step ob-step-storage">
      <div className="ob-step-header">
        <h2>Choose your notes folder</h2>
        <p>All notes are saved as local Markdown files. Pick a directory you control — sync it with Git, Dropbox, or anything else.</p>
      </div>

      <div className="ob-storage-callout">
        <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--accent)" }} />
        <div>
          <strong>Local-first by design.</strong> Your notes live on your filesystem as <code>.md</code> files, organized by subject. No cloud lock-in.
        </div>
      </div>

      <div className="ob-form">
        <div className="field">
          <label className="field-label">Notes directory</label>
          <div className="ob-input-with-btn">
            <input
              className="input"
              value={notesDirectory ?? ""}
              readOnly
              placeholder="Default app data folder"
            />
            <button type="button" className="btn btn-primary" onClick={onPickNotesDirectory}>
              <FolderOpen size={14} /> Browse
            </button>
          </div>
          <span className="ob-input-hint">
            <FileText size={12} /> {notesDirectory ? "Notes will be saved here" : "Using default location — you can change this later in Settings"}
          </span>
        </div>

        <div className="ob-storage-preview">
          <div className="ob-storage-tree">
            <div className="ob-storage-tree-item">
              <Folder size={14} /> <span>{notesDirectory ? notesDirectory.split("/").pop() || "Selected folder" : "App data folder"}</span>
            </div>
            <div className="ob-storage-tree-item nested">
              <Folder size={14} /> <span>PHY211/</span>
            </div>
            <div className="ob-storage-tree-item nested-2">
              <FileText size={14} /> <span>PHY211-overview.md</span>
            </div>
            <div className="ob-storage-tree-item nested-2">
              <FileText size={14} /> <span>Lecture-1-notes.md</span>
            </div>
            <div className="ob-storage-tree-item nested">
              <Folder size={14} /> <span>BSC128/</span>
            </div>
            <div className="ob-storage-tree-item nested-2">
              <FileText size={14} /> <span>BSC128-overview.md</span>
            </div>
          </div>
        </div>
      </div>

      <StepActions onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   SEMESTER STEP
   ═══════════════════════════════════════════ */
function SemesterStep({
  calendarOptions, track, setTrack, foundationIntake, setFoundationIntake,
  selectedCalendarId, setSelectedCalendarId, onNext, onBack
}: {
  calendarOptions: AcademicOption[];
  track: "undergraduate" | "foundation";
  setTrack: (v: "undergraduate" | "foundation") => void;
  foundationIntake: string;
  setFoundationIntake: (v: string) => void;
  selectedCalendarId: string;
  setSelectedCalendarId: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const foundationIntakes = Array.from(new Set(calendarOptions.filter((o) => o.track === "foundation").map((o) => o.intake ?? ""))).filter(Boolean);
  const visibleOptions = calendarOptions.filter((o) =>
    track === "foundation" ? o.track === "foundation" && o.intake === foundationIntake : o.track === "undergraduate"
  );

  return (
    <div className="ob-step ob-step-semester">
      <div className="ob-step-header">
        <h2>Choose your semester</h2>
        <p>Select your student track and current academic period</p>
      </div>

      <div className="ob-form">
        <div className="field">
          <label className="field-label">Student track</label>
          <div className="ob-track-picker">
            <button className={`ob-track-option ${track === "undergraduate" ? "selected" : ""}`} onClick={() => setTrack("undergraduate")}>
              <GraduationCap size={20} />
              <span>Undergraduate</span>
            </button>
            <button className={`ob-track-option ${track === "foundation" ? "selected" : ""}`} onClick={() => setTrack("foundation")}>
              <BookMarked size={20} />
              <span>Foundation</span>
            </button>
          </div>
        </div>

        {track === "foundation" && (
          <div className="field">
            <label className="field-label">Intake</label>
            <div className="ob-intake-picker">
              {foundationIntakes.map((intake) => (
                <button
                  key={intake}
                  className={`ob-intake-option ${foundationIntake === intake ? "selected" : ""}`}
                  onClick={() => setFoundationIntake(intake)}
                >
                  {intake}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label">Academic period</label>
          <div className="ob-semester-list">
            {visibleOptions.map((opt) => (
              <button
                key={opt.id}
                className={`ob-semester-option ${selectedCalendarId === opt.id ? "selected" : ""}`}
                onClick={() => setSelectedCalendarId(opt.id)}
              >
                <div className="ob-semester-option-main">
                  <strong>{opt.semester}</strong>
                  <span>{opt.startDate} – {opt.endDate}</span>
                </div>
                {selectedCalendarId === opt.id && <CheckCircle2 size={18} className="ob-check" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <StepActions onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   TIMETABLE STEP
   ═══════════════════════════════════════════ */
function TimetableStep({
  timetablePreview, importHtmlFile, applyTimetableImport, onNext, onBack
}: {
  timetablePreview: ParsedClass[];
  importHtmlFile: (f: File | undefined) => void;
  applyTimetableImport: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const hasPreview = timetablePreview.length > 0;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) importHtmlFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    importHtmlFile(e.target.files?.[0]);
  }

  function handleApply() {
    applyTimetableImport();
    onNext();
  }

  return (
    <div className="ob-step ob-step-timetable">
      <div className="ob-step-header">
        <h2>Import your timetable</h2>
        <p>Import the HTML timetable from <code>ac.xmu.edu.my</code> so your classes appear automatically</p>
      </div>

      {!hasPreview ? (
        <div className="ob-timetable-import">
          <div
            className={`ob-dropzone ${dragOver ? "dragover" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload size={40} className="ob-dropzone-icon" />
            <div className="ob-dropzone-text">
              <strong>Drop your timetable HTML here</strong>
              <span>Or click to browse</span>
            </div>
            <input type="file" accept=".html,.htm" onChange={handleFileInput} />
          </div>

          <div className="ob-help-text">
            <AlertCircle size={14} />
            <span>Go to <strong>ac.xmu.edu.my</strong> &rarr; Timetable &rarr; right-click &rarr; Save Page As HTML. Then drop it here.</span>
          </div>
        </div>
      ) : (
        <div className="ob-timetable-preview">
          <div className="ob-preview-header">
            <CheckCircle2 size={20} className="ob-success-icon" />
            <span><strong>{timetablePreview.length}</strong> classes found</span>
          </div>
          <div className="ob-preview-list">
            {timetablePreview.slice(0, 8).map((cls) => (
              <div key={cls.id} className="ob-preview-row">
                <div className="ob-preview-code">{cls.code}</div>
                <div className="ob-preview-name">{cls.name}</div>
                <div className="ob-preview-meta">{cls.lecturer} &middot; {cls.venue}</div>
              </div>
            ))}
            {timetablePreview.length > 8 && (
              <div className="ob-preview-more">+{timetablePreview.length - 8} more classes</div>
            )}
          </div>
        </div>
      )}

      <StepActions
        onBack={onBack}
        onNext={handleApply}
        nextLabel={hasPreview ? "Apply timetable" : "Skip"}
        nextVariant={hasPreview ? "primary" : "ghost"}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   MOODLE STEP
   ═══════════════════════════════════════════ */
function MoodleStep({
  subjects, moodle, setMoodle, moodlePassword, setMoodlePassword, moodleLogin,
  toggleMoodleCourse, applyMoodleSelection, syncMoodleFiles, onNext, onBack
}: {
  subjects: Subject[];
  moodle: MoodleState;
  setMoodle: (v: MoodleState | ((prev: MoodleState) => MoodleState)) => void;
  moodlePassword: string;
  setMoodlePassword: (v: string) => void;
  moodleLogin: (e: React.FormEvent<HTMLFormElement>, usernameOverride?: string) => Promise<void>;
  toggleMoodleCourse: (id: number) => void;
  applyMoodleSelection: () => void;
  syncMoodleFiles: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [localUsername, setLocalUsername] = useState(moodle.username);
  const [autoMatched, setAutoMatched] = useState<Set<number>>(new Set());

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await moodleLogin(e, localUsername);
  };

  // Auto-match Moodle courses with timetable subjects when catalog loads
  useEffect(() => {
    if (!moodle.connected || moodle.catalog.length === 0 || subjects.length === 0) return;

    const matched = new Set<number>();
    const subjectCodes = subjects.map((s) => s.code.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    const subjectNames = subjects.map((s) => s.name);
    const subjectLecturers = subjects.map((s) => s.lecturer.toLowerCase());

    for (const course of moodle.catalog) {
      const courseCode = (course.shortname ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const courseName = course.fullname;
      const courseNameLower = courseName.toLowerCase();

      const codeMatch = subjectCodes.some((sc) => {
        if (sc.length < 2) return false;
        return courseCode.includes(sc) || courseNameLower.includes(sc.toLowerCase());
      });

      if (codeMatch) { matched.add(course.id); continue; }

      const exactNameMatch = subjectNames.some((sn) => {
        const escaped = sn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");
        return regex.test(courseName);
      });

      if (exactNameMatch) { matched.add(course.id); continue; }

      const lecturerMatch = subjectLecturers.some((sl) => {
        if (sl.length < 3) return false;
        return courseNameLower.includes(sl);
      });

      if (lecturerMatch) { matched.add(course.id); }
    }

    setAutoMatched(matched);
    if (matched.size > 0) {
      setMoodle((prev) => ({
        ...prev,
        selectedCourseIds: Array.from(matched),
      }));
    }
  }, [moodle.connected, moodle.catalog, subjects, setMoodle]);

  const handleApplyAndSync = async () => {
    applyMoodleSelection();
    await syncMoodleFiles();
    onNext();
  };

  return (
    <div className="ob-step ob-step-moodle">
      <div className="ob-step-header">
        <h2>Connect to Moodle</h2>
        <p>Sign in to sync your course materials from XMUM Moodle</p>
      </div>

      {!moodle.connected ? (
        <form className="ob-form" onSubmit={handleLogin}>
          <div className="field">
            <label className="field-label">XMUM Moodle username</label>
            <input
              className="input"
              value={localUsername}
              onChange={(e) => setLocalUsername(e.target.value)}
              placeholder="your.student.id"
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input
              className="input"
              type="password"
              value={moodlePassword}
              onChange={(e) => setMoodlePassword(e.target.value)}
              placeholder="Moodle password"
            />
          </div>
          {moodle.error && <div className="alert warn">{moodle.error}</div>}
          <button type="submit" className="btn btn-primary ob-btn-wide" disabled={moodle.loading}>
            {moodle.loading ? <><Loader2 size={16} className="spin" /> Signing in…</> : <><Cloud size={16} /> Sign in to Moodle</>}
          </button>
          <button type="button" className="btn btn-ghost" style={{ alignSelf: "center", fontSize: "0.82rem" }} onClick={onNext}>
            Skip for now <SkipForward size={12} />
          </button>
        </form>
      ) : (
        <div className="ob-moodle-connected">
          <div className="ob-moodle-user">
            <CheckCircle2 size={20} className="ob-success-icon" />
            <div>
              <strong>Connected as {moodle.siteUser || moodle.username}</strong>
              <span>{moodle.catalog.length} courses available</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Select courses to sync
              {autoMatched.size > 0 && (
                <span className="ob-moodle-auto-match-badge">
                  <Sparkles size={12} /> {autoMatched.size} matched with timetable
                </span>
              )}
            </label>
            <div className="ob-course-list-compact">
              {moodle.catalog.map((course) => {
                const selected = moodle.selectedCourseIds.includes(course.id);
                const isAutoMatched = autoMatched.has(course.id);
                return (
                  <button
                    key={course.id}
                    className={`ob-course-option ${selected ? "selected" : ""}`}
                    onClick={() => toggleMoodleCourse(course.id)}
                  >
                    <div className="ob-course-check">{selected && <CheckCircle2 size={16} />}</div>
                    <div className="ob-course-info">
                      <div className="ob-course-name-row">
                        <strong>{course.fullname}</strong>
                        {isAutoMatched && <span className="ob-course-match-tag">Matched</span>}
                      </div>
                      <span>{course.shortname}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {moodle.files.length > 0 && (
            <div className="alert ok">
              <FolderSync size={14} /> {moodle.files.filter((f) => f.installed).length} files synced
            </div>
          )}

          <div className="ob-moodle-actions">
            <button className="btn" onClick={() => { setMoodle((prev) => ({ ...prev, connected: false, token: "" })); }}>
              <RotateCcw size={14} /> Switch account
            </button>
            <button className="btn btn-primary" onClick={handleApplyAndSync} disabled={moodle.loading || !moodle.selectedCourseIds.length}>
              {moodle.loading ? <><Loader2 size={16} className="spin" /> Syncing…</> : <><FolderSync size={16} /> Sync & continue</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   AI STEP — with provider availability indicators
   ═══════════════════════════════════════════ */
function AIStep({
  aiSettings, setAISettings, onNext, onBack
}: {
  aiSettings: AISettings;
  setAISettings: (v: AISettings) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const meta = providerMeta.find((p) => p.id === aiSettings.provider)!;

  // Determine availability for each provider
  function getProviderStatus(p: typeof providerMeta[0]): "configured" | "available" | "needs-setup" {
    if (p.needsKey && aiSettings.provider === p.id && aiSettings.apiKey) return "configured";
    if (p.needsCli && aiSettings.provider === p.id && aiSettings.cliCommand) return "configured";
    if (p.needsKey) return "needs-setup";
    return "available";
  }

  return (
    <div className="ob-step ob-step-ai">
      <div className="ob-step-header">
        <h2>Configure AI providers</h2>
        <p>Set up one or more providers. You can switch between them per-conversation in chat.</p>
      </div>

      <div className="ob-ai-info-callout">
        <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Each conversation lets you choose which model to use. Configure your preferred providers below — you&apos;re not locked into one.</span>
      </div>

      <div className="ob-form">
        <div className="field">
          <label className="field-label">Select a provider to configure</label>
          <div className="ob-provider-grid">
            {providerMeta.map((p) => {
              const status = getProviderStatus(p);
              return (
                <button
                  key={p.id}
                  className={`ob-provider-option ${aiSettings.provider === p.id ? "selected" : ""}`}
                  onClick={() => setAISettings({ ...aiSettings, provider: p.id, cliCommand: p.defaultCli })}
                >
                  <div className="ob-provider-icon">{p.icon}</div>
                  <div className="ob-provider-info">
                    <strong>{p.label}</strong>
                    <span>{p.desc}</span>
                  </div>
                  <div className="ob-provider-status">
                    {status === "configured" && <CircleCheck size={15} className="ob-status-configured" />}
                    {status === "available" && <CircleDot size={15} className="ob-status-available" />}
                    {status === "needs-setup" && <CircleX size={15} className="ob-status-needs-setup" />}
                  </div>
                  {aiSettings.provider === p.id && <CheckCircle2 size={16} className="ob-check" />}
                </button>
              );
            })}
          </div>
          <div className="ob-provider-legend">
            <span><CircleCheck size={12} className="ob-status-configured" /> Configured</span>
            <span><CircleDot size={12} className="ob-status-available" /> Available</span>
            <span><CircleX size={12} className="ob-status-needs-setup" /> Needs key</span>
          </div>
        </div>

        {meta.needsKey && (
          <div className="field">
            <label className="field-label">API Key</label>
            <div className="ob-input-with-eye">
              <input
                className="input"
                type={showKey ? "text" : "password"}
                value={aiSettings.apiKey}
                onChange={(e) => setAISettings({ ...aiSettings, apiKey: e.target.value })}
                placeholder={`Enter your ${meta.label} API key`}
              />
              <button type="button" className="icon-btn ob-eye-btn" onClick={() => setShowKey((s) => !s)}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span className="ob-input-hint">
              <Lock size={12} /> Stored locally on your device only
            </span>
          </div>
        )}

        {meta.needsCli && (
          <div className="field">
            <label className="field-label">CLI Command</label>
            <input
              className="input"
              value={aiSettings.cliCommand}
              onChange={(e) => setAISettings({ ...aiSettings, cliCommand: e.target.value })}
              placeholder={`e.g., ${meta.defaultCli}`}
            />
            <span className="ob-input-hint">
              <Terminal size={12} /> Make sure <code>{meta.defaultCli || "the command"}</code> is available in your PATH
            </span>
          </div>
        )}
      </div>

      <StepActions onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   GETTING STARTED STEP — emphasizes what to do first
   ═══════════════════════════════════════════ */
function GettingStartedStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="ob-step ob-step-getting-started">
      <div className="ob-step-header">
        <h2>You&apos;re almost ready</h2>
        <p>Here&apos;s how to make the most of your workspace from day one.</p>
      </div>

      <div className="ob-getting-started-hero">
        <div className="ob-gs-card ob-gs-card-primary">
          <div className="ob-gs-card-icon"><MessageSquare size={24} /></div>
          <div className="ob-gs-card-content">
            <strong>Start with the AI chat</strong>
            <p>Your dashboard AI chat is the quickest way to interact. Try asking it to plan your week, summarize a note, or create tasks for you.</p>
            <div className="ob-gs-commands">
              <code>/plan</code>
              <code>/summarize-note</code>
              <code>/create-assignment</code>
            </div>
          </div>
        </div>
      </div>

      <div className="ob-gs-grid">
        <div className="ob-gs-card">
          <div className="ob-gs-card-icon"><FileText size={20} /></div>
          <div className="ob-gs-card-content">
            <strong>Take notes in Knowledge</strong>
            <span>Create notes per subject, organize in folders. Notes are saved as Markdown.</span>
          </div>
        </div>
        <div className="ob-gs-card">
          <div className="ob-gs-card-icon"><ClipboardList size={20} /></div>
          <div className="ob-gs-card-content">
            <strong>Track tasks & deadlines</strong>
            <span>Use the kanban board or ask AI to create tasks for you.</span>
          </div>
        </div>
        <div className="ob-gs-card">
          <div className="ob-gs-card-icon"><Trophy size={20} /></div>
          <div className="ob-gs-card-content">
            <strong>Log exams & grades</strong>
            <span>Track your assessments and calculate targets for future exams.</span>
          </div>
        </div>
        <div className="ob-gs-card">
          <div className="ob-gs-card-icon"><FileText size={20} /></div>
          <div className="ob-gs-card-content">
            <strong>Use @mentions in chat</strong>
            <span>Type <code>@</code> to attach a Moodle file or note as context for the AI.</span>
          </div>
        </div>
      </div>

      <div className="ob-gs-tip">
        <Sparkles size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <span>
          <strong>Pro tip:</strong> The AI can create, update, or delete tasks, exams, notes, and calendar events — all from a single chat message.
        </span>
      </div>

      <StepActions onBack={onBack} onNext={onNext} nextLabel="Finish setup" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPLETE STEP
   ═══════════════════════════════════════════ */
function CompleteStep({ userProfile, nav, onFinish, onStartTour }: { userProfile: UserProfile; nav: (p: import("../types").Page) => void; onFinish: () => void; onStartTour: () => void }) {
  const name = userProfile.displayName || "there";

  function finishAndGo(page: import("../types").Page) {
    onFinish();
    nav(page);
  }

  return (
    <div className="ob-step ob-step-complete">
      <div className="ob-complete-hero">
        <div className="ob-complete-icon">
          <PartyPopper size={64} strokeWidth={1.2} />
        </div>
        <h2>You&apos;re all set, {name}!</h2>
        <p>Let&apos;s take a quick tour of your workspace — it only takes a minute.</p>
      </div>

      <div className="ob-complete-actions">
        <button className="btn btn-primary ob-btn-xl" onClick={onStartTour}>
          <Compass size={18} /> Start the interactive tour
        </button>
        <button className="btn btn-ghost" style={{ fontSize: "0.84rem" }} onClick={() => finishAndGo("dashboard")}>
          Skip tour, go to Dashboard <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP ACTIONS
   ═══════════════════════════════════════════ */
function StepActions({
  onBack, onNext, nextLabel = "Continue", nextVariant = "primary", nextDisabled = false
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextVariant?: "primary" | "ghost";
  nextDisabled?: boolean;
}) {
  return (
    <div className="ob-step-actions">
      <button className="btn" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>
      <button className={`btn ${nextVariant === "primary" ? "btn-primary" : ""}`} onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <ArrowRight size={14} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN ONBOARDING COMPONENT
   ═══════════════════════════════════════════ */
export function Onboarding(props: OnboardingProps) {
  const { step, idx, next, back, goTo, canGoBack, progress } = useStepNavigation("welcome");

  function finish() {
    props.setUserProfile({ ...props.userProfile, onboardingComplete: true });
    props.onComplete();
  }

  const selectedCalendar = props.calendarOptions.find((o) => o.id === props.selectedCalendarId) ?? props.calendarOptions[0];

  return (
    <div className="onboarding-fullscreen">
      {/* Progress bar */}
      <div className="ob-progress-wrap">
        <div className="ob-progress-track">
          <div className="ob-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Step breadcrumb */}
      {step !== "welcome" && step !== "complete" && (
        <div className="ob-breadcrumb">
          {STEPS.map((s, i) => {
            const isActive = s.id === step;
            const isDone = idx > i;
            return (
              <div key={s.id} className={`ob-breadcrumb-item ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
                {s.icon}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Skip button */}
      {step !== "welcome" && step !== "complete" && (
        <button className="ob-skip-btn" onClick={() => goTo("complete")}>
          Skip all <SkipForward size={12} />
        </button>
      )}

      {/* Step content */}
      <div className="ob-content">
        {step === "welcome" && <WelcomeStep onNext={next} />}

        {step === "profile" && (
          <ProfileStep
            userProfile={props.userProfile}
            setUserProfile={props.setUserProfile}
            onNext={next}
            onBack={back}
          />
        )}

        {step === "storage" && (
          <StorageStep
            notesDirectory={props.notesDirectory}
            onPickNotesDirectory={props.onPickNotesDirectory}
            onNext={next}
            onBack={back}
          />
        )}

        {step === "semester" && (
          <SemesterStep
            calendarOptions={props.calendarOptions}
            track={props.track}
            setTrack={props.setTrack}
            foundationIntake={props.foundationIntake}
            setFoundationIntake={props.setFoundationIntake}
            selectedCalendarId={props.selectedCalendarId}
            setSelectedCalendarId={props.setSelectedCalendarId}
            onNext={next}
            onBack={back}
          />
        )}

        {step === "timetable" && (
          <TimetableStep
            timetablePreview={props.timetablePreview}
            importHtmlFile={props.importHtmlFile}
            applyTimetableImport={props.applyTimetableImport}
            onNext={next}
            onBack={back}
          />
        )}

        {step === "moodle" && (
          <MoodleStep
            subjects={props.subjects}
            moodle={props.moodle}
            setMoodle={props.setMoodle}
            moodlePassword={props.moodlePassword}
            setMoodlePassword={props.setMoodlePassword}
            moodleLogin={props.moodleLogin}
            toggleMoodleCourse={props.toggleMoodleCourse}
            applyMoodleSelection={props.applyMoodleSelection}
            syncMoodleFiles={props.syncMoodleFiles}
            onNext={next}
            onBack={back}
          />
        )}

        {step === "ai-setup" && (
          <AIStep
            aiSettings={props.aiSettings}
            setAISettings={props.setAISettings}
            onNext={next}
            onBack={back}
          />
        )}

        {step === "getting-started" && (
          <GettingStartedStep onNext={next} onBack={back} />
        )}

        {step === "complete" && (
          <CompleteStep
            userProfile={props.userProfile}
            nav={props.nav}
            onFinish={finish}
            onStartTour={props.onStartTour}
          />
        )}
      </div>

      {/* Step indicator dots */}
      {step !== "complete" && (
        <div className="ob-dots">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`ob-dot ${s === step ? "active" : idx > i ? "done" : ""}`}
              title={STEPS.find((x) => x.id === s)?.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
