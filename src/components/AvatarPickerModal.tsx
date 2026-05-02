import { useState, useMemo } from "react";
import { X, Shuffle, Upload, Trash2, Dices } from "lucide-react";
import type { AvatarPreset, UserProfile } from "../types";
import { Avatar, PRESETS, avatarDataUrl, randomAvatarPreset } from "./Avatar";

export function AvatarPickerModal({
  profile,
  onSave,
  onClose,
}: {
  profile: UserProfile;
  onSave: (patch: Partial<UserProfile>) => void;
  onClose: () => void;
}) {
  const initialPreset = (profile.avatarPreset && "seed" in profile.avatarPreset) ? profile.avatarPreset : PRESETS[0];
  const [preset, setPreset] = useState<AvatarPreset>(initialPreset);
  const [seedInput, setSeedInput] = useState(initialPreset.seed);

  const previewUrl = useMemo(() => avatarDataUrl(preset), [preset]);

  function applySeed(seed: string) {
    const trimmed = seed.trim();
    setSeedInput(trimmed);
    if (trimmed) setPreset({ seed: trimmed });
  }

  function randomize() {
    const p = randomAvatarPreset();
    setPreset(p);
    setSeedInput(p.seed);
  }

  function savePreset(p: AvatarPreset) {
    onSave({ avatarPreset: p, avatarUrl: undefined });
    onClose();
  }

  function removeAvatar() {
    onSave({ avatarPreset: undefined, avatarUrl: undefined });
    onClose();
  }

  function handleUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) { alert("Image must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      onSave({ avatarUrl: reader.result as string, avatarPreset: undefined });
      onClose();
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content avatar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Choose avatar</h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="avatar-preview-large">
          <img src={previewUrl} alt="Preview" />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
          <button className="btn" onClick={randomize} title="Randomize">
            <Dices size={14} /> Randomize
          </button>
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Glass presets
        </div>
        <div className="avatar-preset-grid">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              className={`avatar-preset-btn ${preset.seed === p.seed ? "selected" : ""}`}
              onClick={() => { setPreset(p); setSeedInput(p.seed); }}
              title={p.seed}
            >
              <img src={avatarDataUrl(p)} alt={`Preset ${i + 1}`} />
            </button>
          ))}
        </div>

        <div className="avatar-modal-actions">
          <label className="btn" style={{ cursor: "pointer" }}>
            <Upload size={14} /> Upload image
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          </label>
          <button className="btn btn-ghost btn-danger" onClick={removeAvatar}>
            <Trash2 size={14} /> Remove
          </button>
          <button className="btn btn-primary" onClick={() => savePreset(preset)} style={{ marginLeft: "auto" }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
