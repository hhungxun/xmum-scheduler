import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { glass } from "@dicebear/collection";
import type { AvatarPreset } from "../types";

const GLASS_OPTIONS = {
  seed: "",
  size: 128,
};

export function generateAvatarSvg(preset: AvatarPreset): string {
  const seed = (preset as { seed?: string }).seed ?? "XMUM";
  const avatar = createAvatar(glass, { ...GLASS_OPTIONS, seed });
  return avatar.toString();
}

export const PRESETS: AvatarPreset[] = [
  { seed: "Aiden" },
  { seed: "Bella" },
  { seed: "Caleb" },
  { seed: "Diana" },
  { seed: "Ethan" },
  { seed: "Fiona" },
  { seed: "Grace" },
  { seed: "Henry" },
  { seed: "Iris" },
  { seed: "Jack" },
  { seed: "Kara" },
  { seed: "Leo" },
];

export function avatarDataUrl(preset: AvatarPreset): string {
  const svg = generateAvatarSvg(preset);
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

export function randomAvatarPreset(): AvatarPreset {
  const adjectives = ["Cool", "Bright", "Swift", "Calm", "Bold", "Witty", "Kind", "Fierce", "Gentle", "Noble"];
  const nouns = ["Panda", "Fox", "Owl", "Wolf", "Bear", "Hawk", "Lynx", "Raven", "Stag", "Dove", "Tiger", "Eagle"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return { seed: `${adj}${noun}${num}` };
}

/* ═══════════════════════════════════════════
   AVATAR COMPONENT
   ═══════════════════════════════════════════ */
export function Avatar({
  profile, size = 36, alt = "Avatar", className = "",
}: {
  profile: { displayName?: string; avatarUrl?: string; avatarPreset?: AvatarPreset } | null | undefined;
  size?: number;
  alt?: string;
  className?: string;
}) {
  const src = useMemo(() => {
    if (!profile) return null;
    if (profile.avatarUrl) return profile.avatarUrl;
    if (profile.avatarPreset) return avatarDataUrl(profile.avatarPreset);
    return null;
  }, [profile?.avatarUrl, profile?.avatarPreset]);

  const initial = (profile?.displayName || "?").charAt(0).toUpperCase();

  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--surface)",
    border: "1.5px solid var(--line)",
  };

  if (src) {
    return <img src={src} alt={alt} className={className} style={style} />;
  }

  return (
    <span className={className} style={{ ...style, fontSize: size * 0.45, fontWeight: 600, color: "var(--muted)" }}>
      {initial}
    </span>
  );
}
