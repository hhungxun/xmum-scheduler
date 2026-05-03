import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const cmdMap: Record<string, string> = {
    "/academic-calendar": "academic_calendar",
    "/moodle/login": "moodle_login",
    "/moodle/courses": "moodle_courses",
    "/moodle/sync": "moodle_sync",
    "/knowledge/sync": "knowledge_sync",
    "/files/upload": "upload_file",
    "/ai/chat": "ai_chat",
  };

  const cmd = cmdMap[path];
  if (!cmd) {
    throw new Error(`Unknown API path: ${path}`);
  }

  const body = init?.body ? JSON.parse(init.body as string) : {};
  return invoke<T>(cmd, body);
}

export function apiOrigin() {
  return "";
}

export function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
    reader.readAsDataURL(file);
  });
}

export async function getLocalFileUrl(path: string, type: "moodle" | "upload"): Promise<string> {
  try {
    const bytes = await invoke<number[]>(type === "moodle" ? "get_moodle_file" : "get_upload_file", {
      request: { path },
    });
    const blob = new Blob([new Uint8Array(bytes)]);
    return URL.createObjectURL(blob);
  } catch {
    return "";
  }
}