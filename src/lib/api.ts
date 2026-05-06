import { invoke as tauriInvoke } from "@tauri-apps/api/core";

const API_BASE = "http://localhost:8787/api";

function isTauriAvailable(): boolean {
  return typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
}

const cmdMap: Record<string, string> = {
  "/academic-calendar": "academic_calendar",
  "/moodle/login": "moodle_login",
  "/moodle/courses": "moodle_courses",
  "/moodle/sync": "moodle_sync",
  "/knowledge/sync": "knowledge_sync",
  "/files/upload": "upload_file",
  "/ai/chat": "ai_chat",
  "/pick-directory": "pick_directory",
};

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeys(value: unknown, direction: "toSnake" | "toCamel"): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => convertKeys(v, direction));
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const newKey = direction === "toSnake" ? camelToSnake(key) : snakeToCamel(key);
      result[newKey] = convertKeys(val, direction);
    }
    return result;
  }
  return value;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const body = init?.body ? JSON.parse(init.body as string) : {};

  if (isTauriAvailable()) {
    const cmd = cmdMap[path];
    if (!cmd) {
      throw new Error(`Unknown API path: ${path}`);
    }
    const snakeBody = convertKeys(body, "toSnake");
    // Tauri commands expect a named "request" parameter for struct args
    const args = cmd === "academic_calendar" || cmd === "pick_directory"
      ? snakeBody
      : { request: snakeBody };
    const result = await tauriInvoke<unknown>(cmd, args as Parameters<typeof tauriInvoke>[1]);
    return convertKeys(result, "toCamel") as T;
  }

  // Fallback for browser dev mode
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(`Cannot reach the local API server at ${API_BASE}. Restart with npm run dev so the API and Vite run together.`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  return payload as T;
}

export function apiOrigin() {
  return isTauriAvailable() ? "" : API_BASE.replace(/\/api$/, "");
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
  if (isTauriAvailable()) {
    try {
      const bytes = await tauriInvoke<number[]>(type === "moodle" ? "get_moodle_file" : "get_upload_file", {
        request: { path },
      });
      const blob = new Blob([new Uint8Array(bytes)]);
      return URL.createObjectURL(blob);
    } catch {
      return "";
    }
  }
  return `${API_BASE}/${type === "moodle" ? "moodle/file" : "local-file"}?path=${encodeURIComponent(path)}`;
}

export async function pickDirectory(): Promise<string | null> {
  if (isTauriAvailable()) {
    try {
      const result = await tauriInvoke<string | null>("pick_directory");
      return result;
    } catch {
      return null;
    }
  }
  return null;
}

export async function openMoodleFile(file: import("../types").MoodleFile, event?: { preventDefault: () => void }) {
  event?.preventDefault();
  if (isTauriAvailable() && file.localPath && file.installed) {
    try {
      const url = await getLocalFileUrl(file.localPath, "moodle");
      if (url) window.open(url, "_blank");
      return;
    } catch {
      // fallback to default link behaviour
    }
  }
  const href = file.localUrl?.startsWith("/api")
    ? `${apiOrigin()}${file.localUrl}`
    : file.localUrl || file.fileurl || (file.localPath ? `file://${file.localPath}` : "");
  if (href) window.open(href, "_blank", "noopener,noreferrer");
}
