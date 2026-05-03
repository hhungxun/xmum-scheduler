import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight, ArrowLeft, Sparkles, User, Calendar, BookOpen, Cloud, BrainCircuit, Compass, CheckCircle2, GraduationCap, Upload, Dices, Monitor, FileText, ClipboardList, Trophy, Settings, MessageSquare, Palette, LayoutDashboard, X, ChevronRight, ExternalLink, Loader2, AlertCircle, FileCheck, FolderSync, Zap, KeyRound, Terminal, Bot, Eye, EyeOff, Lock, Globe, BookMarked, Target, Bell, Layers, Search, Clock, PenTool, BarChart3, CheckCheck, PartyPopper, RotateCcw, SkipForward
} from "lucide-react";
import type {
  UserProfile, AcademicOption, AISettings, AIProvider, Theme, MoodleState, ParsedClass
} from "../types";
import { Avatar, PRESETS, randomAvatarPreset } from "../components/Avatar";
import { readAsDataUrl } from "../lib/utils";

type OnboardingStep =
  | "welcome"
  | "profile"
  | "semester"
  | "timetable"
  | "moodle"
  | "ai"
  | "tour"
  | "complete";

interface OnboardingProps {
  userProfile: UserProfile;
  setUserProfile: (v: UserProfile) => void;
  onComplete: () => void;
  onSkip: () => void;

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
  moodleLogin: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  toggleMoodleCourse: (id: number) => void;
  applyMoodleSelection: () => void;
  syncMoodleFiles: () => Promise<void>;

  // AI
  aiSettings: AISettings;
  setAISettings: (v: AISettings) => void;

  // Navigation
  nav: (page: import("../types").Page) => void;
}

const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "profile", label: "Profile" },
  { id: "semester", label: "Semester" },
  { id: "timetable", label: "Timetable" },
  { id: "moodle", label: "Moodle" },
  { id: "ai", label: "AI" },
  { id: "tour", label: "Tour" },
  { id: "complete", label: "Done" },
];

const STEP_ORDER: OnboardingStep[] = STEPS.map((s) => s.id);

const providerMeta: { id: AIProvider; label: string; desc: string; icon: React.ReactNode; needsKey: boolean; needsCli: boolean }[] = [
  { id: "openai", label: "OpenAI", desc: "GPT-4o, GPT-4o-mini", icon: <Bot size={18} />, needsKey: true, needsCli: false },
  { id: "anthropic", label: "Anthropic", desc: "Claude 3.5 Haiku, Sonnet", icon: <Sparkles size={18} />, needsKey: true, needsCli: false },
  { id: "claude-code", label: "Claude Code", desc: "Local Claude CLI", icon: <Terminal size={18} />, needsKey: false, needsCli: true },
  { id: "codex-cli", label: "Codex CLI", desc: "OpenAI Codex CLI", icon: <Zap size={18} />, needsKey: false, needsCli: true },
  { id: "opencode", label: "Opencode", desc: "Opencode CLI", icon: <KeyRound size={18} />, needsKey: false, needsCli: true },
];

const tourCards: { page: import("../types").Page; title: string; desc: string; icon: React.ReactNode; features: string[] }[] = [
  {
    page: "dashboard",
    title: "Dashboard",
    desc: "Your command center. See today's schedule, upcoming deadlines, and chat with AI.",
    icon: <LayoutDashboard size={28} />,
    features: ["Today's class schedule", "Upcoming assignments", "AI chat assistant", "Quick stats overview"],
  },
  {
    page: "calendar",
    title: "Calendar",
    desc: "Visualize your week. See classes, exams, and assignment deadlines at a glance.",
    icon: <Calendar size={28} />,
    features: ["Weekly timetable view", "Assignment deadlines", "Exam reminders", "Custom events"],
  },
  {
    page: "knowledge",
    title: "Knowledge",
    desc: "Organize notes by subject. Write in Markdown with LaTeX math and wikilinks.",
    icon: <BookOpen size={28} />,
    features: ["Markdown note editor", "Subject folders", "LaTeX math support", "Course info panels"],
  },
  {
    page: "assignments",
    title: "Assignments",
    desc: "Track tasks with kanban boards. Manage due dates, weights, and statuses.",
    icon: <ClipboardList size={28} />,
    features: ["Kanban task boards", "Due date tracking", "Weight & priority", "Moodle file linking"],
  },
  {
    page: "exams",
    title: "Exams",
    desc: "Monitor grades and calculate targets. Track quizzes, midterms, and finals.",
    icon: <Trophy size={28} />,
    features: ["Grade tracking", "Target score calculator", "Analytics charts", "Weighted averages"],
  },
  {
    page: "moodle",
    title: "Moodle",
    desc: "Sync course materials from XMUM Moodle. Access files directly in the app.",
    icon: <Cloud size={28} />,
    features: ["One-click login", "Course file sync", "Offline file access", "Auto-link to subjects"],
  },
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
          <GraduationCap size={64} strokeWidth={1.2} />
        </div>
        <h1 className="ob-hero-title">Welcome to XMUM Scheduler</h1>
        <p className="ob-hero-subtitle">
          Your all-in-one academic workspace. Let's get you set up in just a few steps.
        </p>
      </div>

      <div className="ob-features-grid">
        <div className="ob-feature-card">
          <Calendar size={24} />
          <strong>Manage Timetable</strong>
          <span>Import your class schedule and never miss a lecture</span>
        </div>
        <div className="ob-feature-card">
          <Cloud size={24} />
          <strong>Sync Moodle</strong>
          <span>Download course files and access them offline</span>
        </div>
        <div className="ob-feature-card">
          <ClipboardList size={24} />
          <strong>Track Assignments</strong>
          <span>Monitor deadlines, weights, and progress</span>
        </div>
        <div className="ob-feature-card">
          <BrainCircuit size={24} />
          <strong>AI Assistant</strong>
          <span>Get help with notes, assignments, and study plans</span>
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

  const preview = {
    displayName: name || "Student",
    avatarUrl: uploadedUrl,
    avatarPreset: uploadedUrl ? undefined : preset,
  };

  function save() {
    setUserProfile({
      ...userProfile,
      displayName: name || userProfile.displayName,
      avatarUrl: uploadedUrl,
      avatarPreset: uploadedUrl ? undefined : preset,
    });
    onNext();
  }

  return (
    <div className="ob-step ob-step-profile">
      <div className="ob-step-header">
        <h2>Set up your profile</h2>
        <p>Personalize your experience with a name and avatar</p>
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
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            autoFocus
          />
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
                <span>{p.seed}</span>
              </button>
            ))}
            <button
              className="ob-avatar-option ob-avatar-random"
              onClick={() => { const r = randomAvatarPreset(); setPreset(r); setUploadedUrl(undefined); }}
              title="Randomize"
            >
              <Dices size={24} />
              <span>Random</span>
            </button>
            <label className="ob-avatar-option ob-avatar-upload" title="Upload photo">
              <Upload size={24} />
              <span>Upload</span>
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

      <StepActions onBack={onBack} onNext={save} nextLabel="Continue" />
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
  selectedCalendar, timetablePreview, importHtmlFile, importBundledTimetable, applyTimetableImport, onNext, onBack
}: {
  selectedCalendar: AcademicOption;
  timetablePreview: ParsedClass[];
  importHtmlFile: (f: File | undefined) => void;
  importBundledTimetable: () => void;
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

          <div className="ob-divider">
            <span>or</span>
          </div>

          <button className="btn ob-btn-wide" onClick={importBundledTimetable}>
            <FileCheck size={16} /> Use bundled {selectedCalendar.semester} timetable
          </button>

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
        onNext={hasPreview ? handleApply : onNext}
        nextLabel={hasPreview ? "Apply timetable" : "Skip for now"}
        nextVariant={hasPreview ? "primary" : "ghost"}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   MOODLE STEP
   ═══════════════════════════════════════════ */
function MoodleStep({
  moodle, setMoodle, moodlePassword, setMoodlePassword, moodleLogin,
  toggleMoodleCourse, applyMoodleSelection, syncMoodleFiles, onNext, onBack
}: {
  moodle: MoodleState;
  setMoodle: (v: MoodleState | ((prev: MoodleState) => MoodleState)) => void;
  moodlePassword: string;
  setMoodlePassword: (v: string) => void;
  moodleLogin: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  toggleMoodleCourse: (id: number) => void;
  applyMoodleSelection: () => void;
  syncMoodleFiles: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [localUsername, setLocalUsername] = useState(moodle.username);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Temporarily set username into moodle state so moodleLogin works
    setMoodle((prev) => ({ ...prev, username: localUsername }));
    await moodleLogin(e);
  };

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
            <label className="field-label">Select courses to sync</label>
            <div className="ob-course-list-compact">
              {moodle.catalog.map((course) => {
                const selected = moodle.selectedCourseIds.includes(course.id);
                return (
                  <button
                    key={course.id}
                    className={`ob-course-option ${selected ? "selected" : ""}`}
                    onClick={() => toggleMoodleCourse(course.id)}
                  >
                    <div className="ob-course-check">{selected && <CheckCircle2 size={16} />}</div>
                    <div className="ob-course-info">
                      <strong>{course.fullname}</strong>
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

      {!moodle.connected && (
        <StepActions onBack={onBack} onNext={onNext} nextLabel="Skip for now" nextVariant="ghost" />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   AI STEP
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

  return (
    <div className="ob-step ob-step-ai">
      <div className="ob-step-header">
        <h2>Set up AI assistant</h2>
        <p>Choose an AI provider for the built-in chat assistant</p>
      </div>

      <div className="ob-form">
        <div className="field">
          <label className="field-label">AI Provider</label>
          <div className="ob-provider-grid">
            {providerMeta.map((p) => (
              <button
                key={p.id}
                className={`ob-provider-option ${aiSettings.provider === p.id ? "selected" : ""}`}
                onClick={() => setAISettings({ ...aiSettings, provider: p.id })}
              >
                <div className="ob-provider-icon">{p.icon}</div>
                <div className="ob-provider-info">
                  <strong>{p.label}</strong>
                  <span>{p.desc}</span>
                </div>
                {aiSettings.provider === p.id && <CheckCircle2 size={16} className="ob-check" />}
              </button>
            ))}
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
            <label className="field-label">CLI Command (optional)</label>
            <input
              className="input"
              value={aiSettings.cliCommand}
              onChange={(e) => setAISettings({ ...aiSettings, cliCommand: e.target.value })}
              placeholder={`e.g., ${meta.id === "claude-code" ? "claude" : meta.id === "codex-cli" ? "codex" : "opencode"}`}
            />
            <span className="ob-input-hint">
              <Terminal size={12} /> Make sure the command is available in your PATH
            </span>
          </div>
        )}
      </div>

      <StepActions onBack={onBack} onNext={onNext} nextLabel={meta.needsKey && !aiSettings.apiKey ? "Skip for now" : "Continue"} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   TOUR STEP
   ═══════════════════════════════════════════ */
function TourStep({ nav, onNext, onBack }: { nav: (p: import("../types").Page) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="ob-step ob-step-tour">
      <div className="ob-step-header">
        <h2>Take a quick tour</h2>
        <p>Here's what each page does. Click any card to jump there after finishing.</p>
      </div>

      <div className="ob-tour-grid">
        {tourCards.map((card) => (
          <div key={card.page} className="ob-tour-card">
            <div className="ob-tour-card-icon">{card.icon}</div>
            <strong>{card.title}</strong>
            <p>{card.desc}</p>
            <ul>
              {card.features.map((f, i) => (
                <li key={i}><CheckCheck size={12} /> {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <StepActions onBack={onBack} onNext={onNext} nextLabel="Finish setup" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   COMPLETE STEP
   ═══════════════════════════════════════════ */
function CompleteStep({ userProfile, nav, onFinish }: { userProfile: UserProfile; nav: (p: import("../types").Page) => void; onFinish: () => void }) {
  const name = userProfile.displayName || "there";

  function finishAndGo(page: import("../types").Page) {
    onFinish();
    nav(page);
  }

  return (
    <div className="ob-step ob-step-complete">
      <div className="ob-complete-hero">
        <div className="ob-complete-icon">
          <PartyPopper size={72} strokeWidth={1.2} />
        </div>
        <h2>You're all set, {name}!</h2>
        <p>Your academic workspace is ready. Where would you like to start?</p>
      </div>

      <div className="ob-complete-actions">
        <button className="btn btn-primary ob-btn-xl" onClick={() => finishAndGo("dashboard")}>
          <LayoutDashboard size={18} /> Open Dashboard
        </button>
        <div className="ob-complete-grid">
          <button className="btn ob-complete-option" onClick={() => finishAndGo("calendar")}>
            <Calendar size={16} /> Calendar
          </button>
          <button className="btn ob-complete-option" onClick={() => finishAndGo("knowledge")}>
            <BookOpen size={16} /> Knowledge
          </button>
          <button className="btn ob-complete-option" onClick={() => finishAndGo("assignments")}>
            <ClipboardList size={16} /> Assignments
          </button>
          <button className="btn ob-complete-option" onClick={() => finishAndGo("settings")}>
            <Settings size={16} /> Settings
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STEP ACTIONS
   ═══════════════════════════════════════════ */
function StepActions({
  onBack, onNext, nextLabel = "Continue", nextVariant = "primary", showSkip = false, onSkip
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextVariant?: "primary" | "ghost";
  showSkip?: boolean;
  onSkip?: () => void;
}) {
  return (
    <div className="ob-step-actions">
      <button className="btn" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>
      <div className="row" style={{ gap: 8 }}>
        {showSkip && onSkip && (
          <button className="btn btn-ghost" onClick={onSkip}>
            <SkipForward size={14} /> Skip
          </button>
        )}
        <button className={`btn ${nextVariant === "primary" ? "btn-primary" : ""}`} onClick={onNext}>
          {nextLabel} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN ONBOARDING COMPONENT
   ═══════════════════════════════════════════ */
export function Onboarding(props: OnboardingProps) {
  const { step, next, back, goTo, canGoBack, progress } = useStepNavigation("welcome");

  function finish() {
    props.setUserProfile({ ...props.userProfile, onboardingComplete: true });
    props.onComplete();
  }

  function skipAll() {
    props.setUserProfile({ ...props.userProfile, onboardingComplete: true });
    props.onSkip();
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

      {/* Skip button */}
      {step !== "complete" && (
        <button className="ob-skip-btn" onClick={skipAll}>
          Skip setup <ChevronRight size={14} />
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
            selectedCalendar={selectedCalendar}
            timetablePreview={props.timetablePreview}
            importHtmlFile={props.importHtmlFile}
            importBundledTimetable={props.importBundledTimetable}
            applyTimetableImport={props.applyTimetableImport}
            onNext={next}
            onBack={back}
          />
        )}

        {step === "moodle" && (
          <MoodleStep
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

        {step === "ai" && (
          <AIStep
            aiSettings={props.aiSettings}
            setAISettings={props.setAISettings}
            onNext={next}
            onBack={back}
          />
        )}

        {step === "tour" && (
          <TourStep nav={props.nav} onNext={next} onBack={back} />
        )}

        {step === "complete" && (
          <CompleteStep
            userProfile={props.userProfile}
            nav={props.nav}
            onFinish={finish}
          />
        )}
      </div>

      {/* Step indicator dots */}
      {step !== "complete" && (
        <div className="ob-dots">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`ob-dot ${s === step ? "active" : STEP_ORDER.indexOf(step) > i ? "done" : ""}`}
              title={STEPS.find((x) => x.id === s)?.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
