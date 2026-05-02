import { useState } from "react";
import { User, Camera, Upload, BookOpen, Cloud, CheckSquare, MessageSquare, ArrowRight, ArrowLeft, Dices } from "lucide-react";
import type { UserProfile } from "../types";
import { Avatar, PRESETS, randomAvatarPreset } from "../components/Avatar";
import { readAsDataUrl } from "../lib/utils";

const steps = [
  {
    title: "Welcome to your Academic Assistant",
    desc: "Manage your subjects, Moodle files, assignments, exams, and notes — all in one place. Let's get you set up in a few steps.",
    icon: <User size={24} />,
  },
  {
    title: "Set your profile",
    desc: "Choose a display name and avatar so the app feels like yours.",
    icon: <Camera size={24} />,
  },
  {
    title: "Import your timetable",
    desc: "Go to Settings to import your timetable HTML. Your classes will appear in the dashboard and calendar.",
    icon: <BookOpen size={24} />,
  },
  {
    title: "Sync Moodle files",
    desc: "Connect your Moodle account to sync course files. You can reference them anywhere with @ in chat.",
    icon: <Cloud size={24} />,
  },
  {
    title: "Create your first task",
    desc: "Head to Assignments to create tasks with due dates, weights, and status tracking.",
    icon: <CheckSquare size={24} />,
  },
  {
    title: "Use AI chat",
    desc: "Type / to use AI skills, @ to reference files, and ask questions about your notes, assignments, and exams.",
    icon: <MessageSquare size={24} />,
  },
  {
    title: "You're ready to start!",
    desc: "Your profile is set up. Explore the dashboard, calendar, and knowledge workspace at your own pace.",
    icon: <CheckSquare size={24} />,
  },
];

export function Onboarding({
  userProfile,
  setUserProfile,
  onComplete,
  onSkip,
}: {
  userProfile: UserProfile;
  setUserProfile: (v: UserProfile) => void;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(userProfile.displayName);
  const initialPreset = (userProfile.avatarPreset && "seed" in userProfile.avatarPreset) ? userProfile.avatarPreset : PRESETS[0];
  const [preset, setPreset] = useState<import("../types").AvatarPreset>(initialPreset);
  const [uploadedUrl, setUploadedUrl] = useState<string | undefined>(userProfile.avatarUrl);

  const isLast = step === steps.length - 1;

  function finish() {
    setUserProfile({
      displayName: name || userProfile.displayName,
      avatarUrl: uploadedUrl,
      avatarPreset: uploadedUrl ? undefined : preset,
      onboardingComplete: true,
    });
    onComplete();
  }

  function handleNext() {
    if (isLast) {
      finish();
      return;
    }
    if (step === 1) {
      setUserProfile({
        ...userProfile,
        displayName: name,
        avatarUrl: uploadedUrl,
        avatarPreset: uploadedUrl ? undefined : preset,
      });
    }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  const previewProfile = {
    displayName: name || userProfile.displayName,
    avatarUrl: uploadedUrl,
    avatarPreset: uploadedUrl ? undefined : preset,
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-steps">
          {steps.map((_, i) => (
            <div key={i} className={`onboarding-step-dot ${i === step ? "active" : i < step ? "done" : ""}`} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>{steps[step].icon}</div>
          <div>
            <h2>{steps[step].title}</h2>
            <p>{steps[step].desc}</p>
          </div>
        </div>

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--muted)" }}>Display name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoFocus
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <Avatar profile={previewProfile} size={72} alt="Preview" />
              <div className="onboarding-avatar-options">
                {PRESETS.slice(0, 8).map((p, i) => (
                  <button
                    key={i}
                    className={`onboarding-avatar-btn ${preset.seed === p.seed && !uploadedUrl ? "selected" : ""}`}
                    onClick={() => { setPreset(p); setUploadedUrl(undefined); }}
                    title={p.seed}
                  >
                    <Avatar profile={{ avatarPreset: p }} size={44} alt={p.seed} />
                  </button>
                ))}
                <button
                  className="onboarding-avatar-btn"
                  onClick={() => { const r = randomAvatarPreset(); setPreset(r); setUploadedUrl(undefined); }}
                  title="Randomize"
                >
                  <Dices size={16} />
                </button>
                <label className="onboarding-avatar-btn" style={{ cursor: "pointer" }} title="Upload photo">
                  <Upload size={16} />
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
                <button className="btn btn-ghost" style={{ fontSize: "0.8rem" }} onClick={() => setUploadedUrl(undefined)}>
                  Remove uploaded photo
                </button>
              )}
            </div>
          </div>
        )}

        {step === 6 && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎉</div>
          </div>
        )}

        <div className="onboarding-actions">
          <button className="btn" onClick={() => { setUserProfile({ ...userProfile, displayName: name || userProfile.displayName, avatarUrl: uploadedUrl, avatarPreset: uploadedUrl ? undefined : preset, onboardingComplete: true }); onSkip(); }}>Skip</button>
          <div className="row" style={{ gap: 8 }}>
            {step > 0 && (
              <button className="btn" onClick={handleBack}>
                <ArrowLeft size={14} /> Back
              </button>
            )}
            <button className="btn btn-primary" onClick={handleNext}>
              {isLast ? "Go to dashboard" : "Next"} {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--muted)" }}>
          Step {step + 1} of {steps.length}
        </div>
      </div>
    </div>
  );
}
