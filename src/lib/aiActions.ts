import type { Status, ExamKind } from "../types";

export type AIAction =
  | { action: "create_calendar_event"; payload: { title: string; date: string; start: string; end: string; venue?: string; subjectId?: string } }
  | { action: "update_calendar_event"; payload: { id: string; title?: string; date?: string; start?: string; end?: string; venue?: string; subjectId?: string } }
  | { action: "delete_calendar_event"; payload: { id: string } }
  | { action: "create_note"; payload: { subjectId: string; title: string; content: string; folderId?: string } }
  | { action: "update_note"; payload: { subjectId: string; noteId: string; title?: string; content?: string } }
  | { action: "delete_note"; payload: { subjectId: string; noteId: string } }
  | { action: "create_assignment"; payload: { title: string; subjectId: string; due: string; weight?: number; description?: string; status?: Status } }
  | { action: "update_assignment"; payload: { id: string; title?: string; due?: string; weight?: number; description?: string; status?: Status; subjectId?: string } }
  | { action: "delete_assignment"; payload: { id: string } }
  | { action: "create_exam"; payload: { title: string; subjectId: string; kind: ExamKind; date: string; weight?: number; score?: number; maxScore?: number; notes?: string } }
  | { action: "update_exam"; payload: { id: string; title?: string; kind?: ExamKind; date?: string; weight?: number; score?: number; maxScore?: number; notes?: string; subjectId?: string } }
  | { action: "delete_exam"; payload: { id: string } };

export function extractActions(text: string): AIAction[] {
  const actions: AIAction[] = [];
  const regex = /```action\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed.action === "string" && parsed.payload) {
        actions.push(parsed as AIAction);
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return actions;
}

export function stripActionBlocks(text: string): string {
  return text.replace(/```action\s*[\s\S]*?\s*```/g, "").trim();
}
