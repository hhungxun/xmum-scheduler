import { FormEvent, useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  Send, Bot, Sparkles, Calendar, FileText, BookOpen,
  Trash2, Plus, Search, MessageSquare, ChevronDown, Pencil, Cpu, Paperclip, X, Star,
  FolderPlus, Folder, FolderOpen, ChevronRight as ChevronRightIcon, MoreHorizontal, ImagePlus,
} from "lucide-react";
import type { Conversation, AISettings, ChatMessage, ChatImage, MoodleFile, UserProfile, Subject, ChatFolder } from "../types";
import { moodleFileKey } from "../lib/utils";
import { Avatar } from "./Avatar";

/* ─── slash commands with groups ─── */
const slashCommands = [
  { id: "/plan", label: "Plan my week", group: "Planning", icon: <Calendar size={13} />, prompt: "Analyze my upcoming tasks, exams, and calendar events for this week. Create a realistic study plan and suggest any calendar events I should add." },
  { id: "/schedule-study", label: "Schedule study sessions", group: "Planning", icon: <Calendar size={13} />, prompt: "Based on my exam dates and task deadlines, suggest and create study session calendar events. Spread them reasonably across available days." },
  { id: "/summarize-note", label: "Summarize current note", group: "Notes", icon: <BookOpen size={13} />, prompt: "Summarize the current note I'm viewing. Highlight key concepts, formulas, and any action items." },
  { id: "/explain-file", label: "Explain a Moodle file", group: "Notes", icon: <FileText size={13} />, prompt: "I'll attach a Moodle file with @. Explain what it covers, the key concepts, and what I should focus on for revision." },
  { id: "/revision-questions", label: "Generate revision questions", group: "Notes", icon: <Sparkles size={13} />, prompt: "Using my notes and any attached materials, generate 5–10 revision questions of mixed difficulty with brief answer hints." },
  { id: "/create-assignment", label: "Create task", group: "Create", icon: <FileText size={13} />, prompt: "I want to create a new task. Ask me for the subject, title, due date, and weight, then create it using an action block." },
  { id: "/create-exam", label: "Create exam", group: "Create", icon: <Sparkles size={13} />, prompt: "I want to create a new exam or quiz. Ask me for the subject, title, type, date, and weight, then create it using an action block." },
  { id: "/track-exams", label: "Track exam progress", group: "Insights", icon: <Sparkles size={13} />, prompt: "Summarize my current exam progress: weighted score so far, average, what I still need to score on remaining assessments to hit my target, and which subjects need attention." },
];

type AIModelDef = {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
  tag?: string;
};

const ALL_MODELS: AIModelDef[] = [
  { id: "gpt-5", name: "GPT-5", provider: "openai", providerLabel: "OpenAI" },
  { id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai", providerLabel: "OpenAI" },
  { id: "gpt-5-nano", name: "GPT-5 Nano", provider: "openai", providerLabel: "OpenAI", tag: "fast" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", providerLabel: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", providerLabel: "OpenAI", tag: "fast" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", providerLabel: "OpenAI" },
  { id: "o3-mini", name: "o3-mini", provider: "openai", providerLabel: "OpenAI", tag: "reasoning" },
  { id: "o1", name: "o1", provider: "openai", providerLabel: "OpenAI", tag: "reasoning" },
  { id: "claude-4-opus-latest", name: "Claude 4 Opus", provider: "anthropic", providerLabel: "Anthropic" },
  { id: "claude-4-sonnet-latest", name: "Claude 4 Sonnet", provider: "anthropic", providerLabel: "Anthropic" },
  { id: "claude-4-haiku-latest", name: "Claude 4 Haiku", provider: "anthropic", providerLabel: "Anthropic", tag: "fast" },
  { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", provider: "anthropic", providerLabel: "Anthropic" },
  { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", provider: "anthropic", providerLabel: "Anthropic", tag: "fast" },
  { id: "claude-3-opus-latest", name: "Claude 3 Opus", provider: "anthropic", providerLabel: "Anthropic" },
  { id: "claude", name: "Claude Code", provider: "claude-code", providerLabel: "Claude Code" },
  { id: "codex", name: "Codex CLI", provider: "codex-cli", providerLabel: "Codex CLI" },
  { id: "opencode", name: "OpenCode", provider: "opencode", providerLabel: "OpenCode" },
  { id: "opencode-go", name: "OpenCode Go", provider: "opencode", providerLabel: "OpenCode", tag: "fast" },
  { id: "opencode-zen", name: "OpenCode Zen", provider: "opencode", providerLabel: "OpenCode", tag: "balanced" },
];

type BrandDef = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
};

const BRANDS: BrandDef[] = [
  { id: "openai", label: "OpenAI", icon: <Sparkles size={16} />, color: "#10a37f" },
  { id: "anthropic", label: "Anthropic", icon: <Bot size={16} />, color: "#d97757" },
  { id: "claude-code", label: "Claude Code", icon: <Bot size={16} />, color: "#7c3aed" },
  { id: "codex-cli", label: "Codex", icon: <Cpu size={16} />, color: "#3b82f6" },
  { id: "opencode", label: "OpenCode", icon: <Sparkles size={16} />, color: "#06b6d4" },
];

function modelLabel(provider: string, model: string): string {
  return ALL_MODELS.find((m) => m.provider === provider && m.id === model)?.name ?? model;
}
function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (diffDays(d, now) < 1 && d.getDate() === now.getDate()) return "Today";
  if (diffDays(d, now) < 2 && d.getDate() === now.getDate() - 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function diffDays(a: Date, b: Date) { return Math.abs((a.getTime() - b.getTime()) / 86400000); }
function visibleMessages(conv: Conversation | null): ChatMessage[] {
  if (!conv) return [];
  return conv.messages.filter((m) => m.role !== "system");
}

function modelSupportsImages(provider: string, model: string): boolean {
  // OpenAI's reasoning models (o1, o3-mini) are text-only, no vision
  if (provider === "openai" && (model === "o1" || model === "o3-mini")) return false;
  return true;
}

/* ═══════════════════════════════════════════
   MARKDOWN RENDERER
   ═══════════════════════════════════════════ */
interface MdNode { type: "text" | "bold" | "italic" | "code" | "link" | "br"; text: string; url?: string; }

function parseInline(text: string): MdNode[] {
  const out: MdNode[] = [];
  const pattern = /(```[\s\S]*?```|`[^`]+`|\*\*[^*]+?\*\*|\*[^*]+?\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith("```")) { out.push({ type: "code", text: raw.slice(3, -3).trim() }); }
    else if (raw.startsWith("`")) { out.push({ type: "code", text: raw.slice(1, -1) }); }
    else if (raw.startsWith("**")) { out.push({ type: "bold", text: raw.slice(2, -2) }); }
    else if (raw.startsWith("*")) { out.push({ type: "italic", text: raw.slice(1, -1) }); }
    else if (raw.startsWith("[")) { out.push({ type: "link", text: m[2], url: m[3] }); }
    last = m.index + raw.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

function Inline({ nodes }: { nodes: MdNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "bold": return <strong key={i}>{n.text}</strong>;
          case "italic": return <em key={i}>{n.text}</em>;
          case "code": return <code key={i} style={{ background: "var(--bg)", padding: "1px 5px", borderRadius: 4, fontSize: "0.88em", fontFamily: "ui-monospace, monospace" }}>{n.text}</code>;
          case "link": return <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>{n.text}</a>;
          case "br": return <br key={i} />;
          default: return <span key={i}>{n.text}</span>;
        }
      })}
    </>
  );
}

function MarkdownContent({ content }: { content: string }) {
  if (typeof content !== "string") return <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>;

  const lines = content.split("\n");
  const elems: React.ReactNode[] = [];
  let i = 0;

  // scan for code fences — group lines by block type
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trimStart();
    const indent = raw.length - trimmed.length;

    // code fence block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const blockLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        blockLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elems.push(
        <pre key={elems.length} style={{
          margin: "8px 0",
          padding: 12,
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          overflowX: "auto",
          fontSize: "0.84rem",
          lineHeight: 1.55,
          fontFamily: "ui-monospace, monospace",
        }}>
          {lang ? <div className="muted" style={{ fontSize: "0.7rem", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{lang}</div> : null}
          <code>{blockLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const isSep = /^\|[\s\-:]+\|$/.test(trimmed);
      if (isSep) { i++; continue; }
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      elems.push(
        <div key={elems.length} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--line)", fontSize: "0.9rem" }}>
          {cells.map((cell, ci) => (
            <span key={ci} style={{ flex: 1, minWidth: 0 }}><Inline nodes={parseInline(cell)} /></span>
          ))}
        </div>
      );
      i++;
      continue;
    }

    // horizontal rule
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      elems.push(<hr key={elems.length} style={{ border: 0, borderTop: "1px solid var(--line)", margin: "12px 0" }} />);
      i++; continue;
    }

    // heading
    if (/^###\s/.test(trimmed)) {
      elems.push(<div key={elems.length} style={{ fontWeight: 600, fontSize: "1rem", margin: "10px 0 4px" }}><Inline nodes={parseInline(trimmed.replace(/^###\s/, ""))} /></div>);
      i++; continue;
    }
    if (/^##\s/.test(trimmed)) {
      elems.push(<div key={elems.length} style={{ fontWeight: 600, fontSize: "1.08rem", margin: "12px 0 4px" }}><Inline nodes={parseInline(trimmed.replace(/^##\s/, ""))} /></div>);
      i++; continue;
    }
    if (/^#\s/.test(trimmed)) {
      elems.push(<div key={elems.length} style={{ fontWeight: 700, fontSize: "1.16rem", margin: "14px 0 4px" }}><Inline nodes={parseInline(trimmed.replace(/^#\s/, ""))} /></div>);
      i++; continue;
    }

    // blockquote
    if (trimmed.startsWith(">")) {
      elems.push(
        <div key={elems.length} style={{ borderLeft: "3px solid var(--line-strong)", paddingLeft: 12, color: "var(--muted)", margin: "6px 0", fontStyle: "italic" }}>
          <Inline nodes={parseInline(trimmed.replace(/^>\s?/, ""))} />
        </div>
      );
      i++; continue;
    }

    // unordered list
    if (/^[-*]\s/.test(trimmed)) {
      elems.push(
        <div key={elems.length} style={{ paddingLeft: 18, position: "relative", marginBottom: 2 }}>
          <span style={{ position: "absolute", left: 6 }}>•</span>
          <Inline nodes={parseInline(trimmed.replace(/^[-*]\s/, ""))} />
        </div>
      );
      i++; continue;
    }

    // ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^\d+/)?.[0] ?? "";
      elems.push(
        <div key={elems.length} style={{ paddingLeft: 22, position: "relative", marginBottom: 2 }}>
          <span style={{ position: "absolute", left: 6, fontWeight: 600 }}>{num}.</span>
          <Inline nodes={parseInline(trimmed.replace(/^\d+\.\s/, ""))} />
        </div>
      );
      i++; continue;
    }

    // empty line
    if (trimmed === "") {
      elems.push(<div key={elems.length} style={{ height: 8 }} />);
      i++; continue;
    }

    // regular paragraph
    elems.push(
      <div key={elems.length} style={{ marginBottom: 2 }}>
        <Inline nodes={parseInline(trimmed)} />
      </div>
    );
    i++;
  }

  return <div style={{ lineHeight: 1.65 }}>{elems}</div>;
}

/* ═══════════════════════════════════════════
   CHAT PANEL
   ═══════════════════════════════════════════ */
export function ChatPanel({
  conversation, conversations, onSend, loading, aiSettings, setAISettings,
  activeConversationId, setActiveConversationId, createConversation,
  deleteConversation, renameConversation, moodleFiles = [],
  setConversationModel,
  placeholder = "How can I help you today?", compact = false,
  userProfile, subjects = [],
  chatFolders = [], createChatFolder, renameChatFolder, deleteChatFolder, moveConversationToFolder,
}: {
  conversation: Conversation | null;
  conversations: Record<string, Conversation>;
  onSend: (text: string, displayText?: string, fileIds?: string[], contextPrefix?: string, targetConversationId?: string, images?: ChatImage[]) => void;
  loading?: boolean;
  aiSettings: AISettings;
  setAISettings: (v: AISettings) => void;
  setConversationModel?: (id: string, model: string, provider: AISettings["provider"]) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createConversation: (firstUserText?: string) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  moodleFiles?: MoodleFile[];
  placeholder?: string;
  compact?: boolean;
  userProfile?: UserProfile;
  subjects?: Subject[];
  chatFolders?: ChatFolder[];
  createChatFolder?: (name: string) => string;
  renameChatFolder?: (id: string, name: string) => void;
  deleteChatFolder?: (id: string) => void;
  moveConversationToFolder?: (convId: string, folderId: string | undefined) => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [atOpen, setAtOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("openai");
  const [selectedFileGroupId, setSelectedFileGroupId] = useState("");
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<MoodleFile[]>([]);
  const [attachedImages, setAttachedImages] = useState<{ data: string; mediaType: string; preview: string }[]>([]);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [convMenuId, setConvMenuId] = useState<string | null>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const convMenuRef = useRef<HTMLDivElement>(null);
  // Drag-and-drop state
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // folder id or "__unfiled__"

  const msgs = visibleMessages(conversation);
  const isNewChat = !conversation || msgs.length === 0;

  const conversationList = useMemo(() => {
    const list = Object.values(conversations).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [msgs, loading]);

  // Global paste listener — catches image paste from clipboard across all browsers/WebKit2GTK
  useEffect(() => {
    function onDocPaste(e: ClipboardEvent) {
      // Only process if our textarea is focused
      if (document.activeElement !== inputRef.current) return;
      const cd = e.clipboardData;
      if (!cd) return;
      let hasImage = false;
      try {
        // Check files first (WebKit/Linux often exposes here)
        if (cd.files && cd.files.length > 0) {
          for (let i = 0; i < cd.files.length; i++) {
            if (cd.files[i].type.startsWith("image/")) {
              hasImage = true;
              processImageFile(cd.files[i]);
            }
          }
        }
        // Check items (Chromium exposes images here)
        if (!hasImage && cd.items) {
          for (let i = 0; i < cd.items.length; i++) {
            if (cd.items[i].type.startsWith("image/")) {
              const file = cd.items[i].getAsFile();
              if (file) { hasImage = true; processImageFile(file); }
            }
          }
        }
      } catch (err) {
        console.warn("Paste clipboard access error:", err);
      }
      // Async fallback: try navigator.clipboard.read() if nothing found
      if (!hasImage) {
        navigator.clipboard.read?.().then((items) => {
          for (const item of items) {
            const imgType = item.types.find((t: string) => t.startsWith("image/"));
            if (imgType) {
              item.getType(imgType).then((blob: Blob) => {
                processImageFile(new File([blob], "clipboard-image", { type: imgType }));
              });
            }
          }
        }).catch(() => { /* clipboard read not available or denied */ });
        return;
      }
      if (hasImage) e.preventDefault();
    }
    document.addEventListener("paste", onDocPaste);
    return () => document.removeEventListener("paste", onDocPaste);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    if (modelOpen) { document.addEventListener("mousedown", onClick); return () => document.removeEventListener("mousedown", onClick); }
  }, [modelOpen]);
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [inputValue]);

  // close folder/conv context menus on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) setFolderMenuId(null);
      if (convMenuRef.current && !convMenuRef.current.contains(e.target as Node)) setConvMenuId(null);
    }
    if (folderMenuId || convMenuId) { document.addEventListener("mousedown", onClick); return () => document.removeEventListener("mousedown", onClick); }
  }, [folderMenuId, convMenuId]);

  function toggleFolderCollapse(id: string) {
    setCollapsedFolders((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  // group conversations by folder
  const { folderedConvs, unfiledConvs } = useMemo(() => {
    const foldered = new Map<string, Conversation[]>();
    const unfiled: Conversation[] = [];
    for (const conv of conversationList) {
      if (conv.folderId && chatFolders.some((f) => f.id === conv.folderId)) {
        if (!foldered.has(conv.folderId)) foldered.set(conv.folderId, []);
        foldered.get(conv.folderId)!.push(conv);
      } else {
        unfiled.push(conv);
      }
    }
    return { folderedConvs: foldered, unfiledConvs: unfiled };
  }, [conversationList, chatFolders]);

  // fuzzy match for slash
  const slashMatches = useMemo(() => {
    if (!slashOpen) return [];
    const q = inputValue.slice(1).trim().toLowerCase();
    if (!q) return slashCommands;
    return slashCommands.filter((c) => c.id.toLowerCase().includes(q) || c.label.toLowerCase().includes(q));
  }, [slashOpen, inputValue]);

  // grouped for display
  const slashGrouped = useMemo(() => {
    const groups = new Map<string, typeof slashCommands>();
    for (const cmd of slashMatches) {
      const g = cmd.group ?? "Other";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(cmd);
    }
    return groups;
  }, [slashMatches]);

  const filteredFiles = useMemo(() => {
    const empty = { grouped: new Map<string, { subject: Subject; files: MoodleFile[] }>(), unmatchedFiles: [] as MoodleFile[] };
    if (!atOpen) return empty;
    const q = atQuery(inputValue).toLowerCase();
    
    // Group files by subject
    const grouped: Map<string, { subject: Subject; files: MoodleFile[] }> = new Map();
    
    for (const subject of subjects) {
      const subjectFiles = moodleFiles.filter((f) => {
        const codeMatch = f.courseName.toUpperCase().includes(subject.code.toUpperCase());
        const nameMatch = f.courseName.toLowerCase().includes(subject.name.toLowerCase());
        return codeMatch || nameMatch;
      });
      
      if (subjectFiles.length > 0) {
        const filtered = q
          ? subjectFiles.filter((f) => f.filename.toLowerCase().includes(q))
          : subjectFiles;
        if (filtered.length > 0) {
          grouped.set(subject.id, { subject, files: filtered.slice(0, 8) });
        }
      }
    }
    
    // Also include unmatched files
    const matchedFileIds = new Set<string>();
    for (const group of grouped.values()) {
      for (const file of group.files) {
        matchedFileIds.add(moodleFileKey(file));
      }
    }
    
    const unmatchedFiles = moodleFiles
      .filter((f) => !matchedFileIds.has(moodleFileKey(f)))
      .filter((f) => !q || f.filename.toLowerCase().includes(q))
      .slice(0, 8);
    
    return { grouped, unmatchedFiles };
  }, [atOpen, inputValue, moodleFiles, subjects]);

  const fileGroups = useMemo(() => {
    const groups = Array.from(filteredFiles.grouped.values()).map(({ subject, files }) => ({
      id: subject.id,
      label: subject.code,
      sublabel: subject.name,
      color: subject.color,
      files,
    }));
    if (filteredFiles.unmatchedFiles.length) {
      groups.push({
        id: "__other__",
        label: "Other",
        sublabel: "Unmatched Moodle files",
        color: "var(--muted)",
        files: filteredFiles.unmatchedFiles,
      });
    }
    return groups;
  }, [filteredFiles]);

  const selectedFileGroup = fileGroups.find((group) => group.id === selectedFileGroupId) ?? fileGroups[0];

  function atQuery(val: string): string {
    const idx = val.lastIndexOf("@");
    if (idx === -1) return "";
    const after = val.slice(idx + 1);
    const space = after.search(/\s/);
    return space === -1 ? after : after.slice(0, space);
  }

  // flatten items for arrow-key nav
  const slashFlat = slashOpen ? slashMatches : [];
  const menuItems = slashOpen ? slashFlat : [];
  const menuLength = menuItems.length;
  
  // Flatten files for keyboard navigation
  const fileFlat = useMemo(() => atOpen ? selectedFileGroup?.files ?? [] : [], [atOpen, selectedFileGroup]);
  const fileLength = fileFlat.length;

  useEffect(() => {
    if (!atOpen) return;
    if (!fileGroups.length) {
      setSelectedFileGroupId("");
      return;
    }
    if (!fileGroups.some((group) => group.id === selectedFileGroupId)) {
      setSelectedFileGroupId(fileGroups[0].id);
    }
  }, [atOpen, fileGroups, selectedFileGroupId]);

  function resetMenu() { setHighlightIdx(0); setSlashOpen(false); setAtOpen(false); }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if ((!text && !attachedImages.length) || loading) return;
    const finalText = text || (attachedImages.length ? "Analyze this image" : "");

    const imgPayload: ChatImage[] | undefined = attachedImages.length
      ? attachedImages.map((img) => ({ data: img.data, mediaType: img.mediaType as ChatImage["mediaType"] }))
      : undefined;

    const command = slashOpen ? slashFlat[highlightIdx] ?? null : null;
    if (command && slashOpen) {
      const rest = finalText.slice(command.id.length).trim();
      const prompt = `${command.prompt}${rest ? "\n" + rest : ""}`;
      onSend(prompt, finalText, attachedFiles.map((f) => moodleFileKey(f)), undefined, undefined, imgPayload);
    } else {
      onSend(finalText, undefined, attachedFiles.map((f) => moodleFileKey(f)), undefined, undefined, imgPayload);
    }
    setInputValue(""); setAttachedFiles([]); setAttachedImages([]); resetMenu();
  }

  function handleInputChange(value: string) {
    setInputValue(value);
    if (value.startsWith("/") && !value.includes(" ")) {
      setSlashOpen(true); setAtOpen(false); setHighlightIdx(0);
    } else if (value.lastIndexOf("@") > -1) {
      const afterAt = value.slice(value.lastIndexOf("@") + 1);
      if (!afterAt.includes(" ")) {
        setAtOpen(true); setSlashOpen(false); setHighlightIdx(0);
      } else { setAtOpen(false); }
    } else { resetMenu(); }
  }

  function insertCommand(cmd: typeof slashCommands[0]) {
    setInputValue(cmd.id + " "); resetMenu(); inputRef.current?.focus();
  }
  function insertFile(file: MoodleFile) {
    const idx = inputValue.lastIndexOf("@");
    const before = idx > -1 ? inputValue.slice(0, idx) : inputValue;
    const afterAt = idx > -1 ? inputValue.slice(idx + 1) : "";
    const spaceIdx = afterAt.search(/\s/);
    const after = spaceIdx === -1 ? "" : afterAt.slice(spaceIdx);
    setInputValue(`${before}${after}`.trim());
    setAttachedFiles((prev) => [...prev, file]);
    resetMenu(); inputRef.current?.focus();
  }
  function removeAttached(idx: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeAttachedImage(idx: number) {
    setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function processImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIdx = dataUrl.indexOf(",");
      if (commaIdx === -1) return;
      const base64 = dataUrl.slice(commaIdx + 1);
      const header = dataUrl.slice(0, commaIdx);
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
      setAttachedImages((prev) => [...prev, { data: base64, mediaType, preview: dataUrl }]);
    };
    reader.readAsDataURL(file);
  }


  function handleDrop(e: React.DragEvent) {
    const files = e.dataTransfer.files;
    const imageFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) imageFiles.push(files[i]);
    }
    if (!imageFiles.length) return;
    e.preventDefault();
    for (const file of imageFiles) {
      processImageFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    // Check if any dragged item is an image
    const types = e.dataTransfer.types;
    if (types.includes("Files") || types.some((t) => t.startsWith("image/"))) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleImageAttach() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.multiple = true;
    input.onchange = () => {
      const files = input.files;
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        processImageFile(files[i]);
      }
    };
    input.click();
  }

  const filteredModels = useMemo(() => {
    let models = ALL_MODELS.filter((m) => m.provider === selectedBrand);
    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase();
      models = models.filter((m) => m.name.toLowerCase().includes(q));
    }
    return models;
  }, [selectedBrand, modelSearch]);

  const currentModel = conversation?.model ?? aiSettings.model;
  const currentModelDef = ALL_MODELS.find((m) => m.id === currentModel);
  const currentProvider = conversation?.provider ?? currentModelDef?.provider ?? aiSettings.provider;
  const currentModelLabel = currentModelDef?.name ?? modelLabel(aiSettings.provider, currentModel);
  const imagesSupported = modelSupportsImages(currentProvider, currentModel);

  const chatBody = (
    <>
      <div ref={logRef} className="chat-log" style={{ padding: compact ? 14 : 24 }}>
        {isNewChat && !compact && (
          <div className="chat-welcome-claude">
            <h2>Your Academic Assistant</h2>
            <p className="muted" style={{ marginBottom: 8 }}>
              I can see your timetable, tasks, exams, notes and synced Moodle files — and I can act on them for you.
            </p>
            <p className="muted" style={{ fontSize: "0.78rem", marginBottom: 18 }}>
              Type <code style={{ background: "var(--surface)", padding: "0 5px", borderRadius: 4 }}>/</code> to browse skills,
              or <code style={{ background: "var(--surface)", padding: "0 5px", borderRadius: 4 }}>@</code> to attach a Moodle file.
            </p>
            <div className="chat-suggestion-grid">
              {slashCommands.slice(0, 6).map((cmd) => (
                <button key={cmd.id} className="chat-suggestion" onClick={() => insertCommand(cmd)}>
                  <span className="row" style={{ gap: 8, marginBottom: 4 }}>
                    {cmd.icon} <strong style={{ fontSize: "0.86rem" }}>{cmd.label}</strong>
                  </span>
                  <span className="muted" style={{ fontSize: "0.78rem" }}>{cmd.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`msg-claude ${m.role}`}>
            {m.role === "assistant" ? (
              <div className="msg-avatar"><Bot size={14} /></div>
            ) : (
              <div className="msg-avatar">
                <Avatar profile={userProfile} size={26} alt="You" />
              </div>
            )}
            <div className="msg-body">
              {m.images && m.images.length > 0 && (
                <div className="msg-images">
                  {m.images.map((img, i) => (
                    <img key={i} src={`data:${img.mediaType};base64,${img.data}`} alt={`Attached ${i + 1}`} className="msg-image-thumb" />
                  ))}
                </div>
              )}
              <MarkdownContent content={m.content} />
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg-claude assistant">
            <div className="msg-avatar"><Bot size={14} /></div>
            <div className="msg-body">
              <span className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>Thinking</span>
                <span className="dot-flash" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        {/* Slash menu */}
        {slashOpen && slashFlat.length > 0 && (
          <div className="slash-menu" ref={menuRef}>
            {Array.from(slashGrouped.entries()).map(([group, cmds]) => (
              <div key={group}>
                <div className="slash-group-label">{group}</div>
                {cmds.map((cmd, mi) => {
                  const flatIdx = slashFlat.indexOf(cmd);
                  return (
                    <button key={cmd.id}
                      className={`slash-item ${flatIdx === highlightIdx ? "highlight" : ""}`}
                      onMouseEnter={() => setHighlightIdx(flatIdx)}
                      onClick={() => insertCommand(cmd)}>
                      {cmd.icon}
                      <span style={{ flex: 1 }}>
                        <strong>{cmd.id}</strong>
                        <span className="muted" style={{ marginLeft: 8 }}>{cmd.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* @mention file menu */}
        {atOpen && (
          <div className="slash-menu chat-file-picker">
            <div className="chat-file-picker-subjects">
              {fileGroups.map((group) => (
                <button
                  key={group.id}
                  className={`chat-file-picker-subject ${selectedFileGroup?.id === group.id ? "active" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedFileGroupId(group.id); setHighlightIdx(0); }}
                >
                  <span className="swatch" style={{ width: 8, height: 8, borderRadius: "50%", background: group.color, display: "inline-block" }} />
                  <span>
                    <strong>{group.label}</strong>
                    <small>{group.files.length} files</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="chat-file-picker-files">
              {fileFlat.length ? fileFlat.map((file, index) => (
                <button
                  key={moodleFileKey(file)}
                  className={`slash-item ${index === highlightIdx ? "highlight" : ""}`}
                  onMouseEnter={() => setHighlightIdx(index)}
                  onClick={() => insertFile(file)}
                >
                  <Paperclip size={13} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                    <strong>{file.filename}</strong>
                    <span className="muted" style={{ marginLeft: 8, fontSize: "0.78rem" }}>
                      {file.installed ? "Synced" : "Moodle"} · {file.courseName}
                    </span>
                  </span>
                </button>
              )) : (
                <div className="muted" style={{ padding: "8px 12px", fontSize: "0.8rem" }}>No matching files</div>
              )}
            </div>
          </div>
        )}

        <form className="chat-composer" onSubmit={handleSubmit}>
          {/* File attachment chips */}
          {attachedFiles.length > 0 && (
            <div className="attached-chips">
              {attachedFiles.map((f, i) => (
                <span key={moodleFileKey(f)} className="file-chip">
                  <Paperclip size={11} />
                  <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                  <span className="file-chip-source">{f.installed ? "Synced" : "Moodle"}</span>
                  <button type="button" className="file-chip-x" onClick={() => removeAttached(i)}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          {/* Image previews */}
          {attachedImages.length > 0 && (
            <>
              <div className="attached-chips">
                {attachedImages.map((img, i) => (
                  <span key={i} className="file-chip">
                    <img src={img.preview} alt="Attached" style={{ width: 16, height: 16, borderRadius: 3, objectFit: "cover" }} />
                    <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.75rem" }}>Image {i + 1}</span>
                    <button type="button" className="file-chip-x" onClick={() => removeAttachedImage(i)}><X size={10} /></button>
                  </span>
                ))}
              </div>
              {!imagesSupported && (
                <div className="chat-image-warning">
                  <ImagePlus size={12} />
                  <span>{currentModelLabel} cannot see images. Change the model to one that supports vision (e.g. GPT-4o, Claude Sonnet).</span>
                </div>
              )}
            </>
          )}
          <textarea ref={inputRef} className="chat-textarea" placeholder={placeholder}
            disabled={loading} value={inputValue} rows={1}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { resetMenu(); return; }
              if (e.key === "Enter" && !e.shiftKey && !slashOpen && !atOpen) {
                e.preventDefault(); handleSubmit(e); return;
              }
              if (slashOpen || atOpen) {
                const maxIdx = slashOpen ? menuLength - 1 : fileLength - 1;
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((p) => Math.min(p + 1, Math.max(0, maxIdx))); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((p) => Math.max(p - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault();
                  if (slashOpen) { const cmd = slashFlat[highlightIdx]; if (cmd) insertCommand(cmd); }
                  else if (atOpen) { const file = fileFlat[highlightIdx]; if (file) insertFile(file); }
                }
              }
            }}
          />
          <div className="chat-composer-footer">
            <div className="chat-model-picker" ref={modelDropdownRef}>
              <button type="button" className="chat-model-btn" onClick={() => { setModelOpen(!modelOpen); setSelectedBrand(currentProvider); setModelSearch(""); }}>
                <Cpu size={12} /><span>{currentModelLabel}</span><ChevronDown size={12} />
              </button>
              {modelOpen && (
                <div className="chat-model-dropdown model-dropdown-brand">
                  <div className="model-dropdown-search">
                    <Search size={12} className="muted" />
                    <input
                      autoFocus
                      placeholder="Search models…"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setModelOpen(false); }
                      }}
                    />
                  </div>
                  <div className="model-dropdown-body">
                    <div className="model-brand-sidebar">
                      {BRANDS.map((brand) => {
                        const isActive = selectedBrand === brand.id;
                        return (
                          <button
                            key={brand.id}
                            className={`model-brand-btn ${isActive ? "active" : ""}`}
                            onClick={() => { setSelectedBrand(brand.id); setModelSearch(""); }}
                            style={{ color: isActive ? brand.color : "var(--muted)" }}
                          >
                            {brand.icon}
                          </button>
                        );
                      })}
                    </div>
                    <div className="model-list-panel">
                      <div className="model-list-header">
                        <span style={{ fontWeight: 600, fontSize: "0.84rem" }}>
                          {BRANDS.find((b) => b.id === selectedBrand)?.label}
                        </span>
                        <span className="muted" style={{ fontSize: "0.72rem" }}>
                          {filteredModels.length} model{filteredModels.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="model-list">
                        {filteredModels.length === 0 && (
                          <div className="muted" style={{ padding: "10px 12px", fontSize: "0.8rem" }}>No models found</div>
                        )}
                        {filteredModels.map((m) => {
                          const active = currentModel === m.id;
                          return (
                            <button key={`${m.provider}-${m.id}`} className={`model-option ${active ? "active" : ""}`}
                              onClick={() => {
                                setAISettings({ ...aiSettings, provider: m.provider as AISettings["provider"], model: m.id });
                                if (conversation) setConversationModel?.(conversation.id, m.id, m.provider as AISettings["provider"]);
                                setModelOpen(false);
                              }}>
                              <div className="model-option-left">
                                {active && <Star size={12} style={{ color: "var(--accent)" }} />}
                                <span className="model-option-name">{m.name}</span>
                              </div>
                              <div className="model-option-right">
                                {m.tag && <span className="model-option-tag">{m.tag}</span>}
                                <span className="model-option-provider">{m.providerLabel}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="chat-composer-actions">
              <button type="button" className="chat-image-btn" aria-label="Attach image" onClick={handleImageAttach} title="Attach image (or paste from clipboard)">
                <ImagePlus size={15} />
              </button>
              <button className="chat-send-btn" aria-label="Send" disabled={loading || (!inputValue.trim() && attachedFiles.length === 0 && attachedImages.length === 0)}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );

  if (compact) return <div className="chat-shell">{chatBody}</div>;

  /* ─── Drag-and-drop helpers ─── */
  function handleConvDragStart(e: React.DragEvent, convId: string) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", convId);
    setDraggingConvId(convId);
  }
  function handleConvDragEnd() {
    setDraggingConvId(null);
    setDragOverTarget(null);
  }
  function handleFolderDragOver(e: React.DragEvent, targetId: string) {
    if (!draggingConvId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(targetId);
  }
  function handleFolderDragLeave(e: React.DragEvent, targetId: string) {
    // Only clear if we're actually leaving this target (not entering a child)
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    if (dragOverTarget === targetId) setDragOverTarget(null);
  }
  function handleFolderDrop(e: React.DragEvent, folderId: string | undefined) {
    e.preventDefault();
    const convId = e.dataTransfer.getData("text/plain") || draggingConvId;
    if (convId && moveConversationToFolder) {
      moveConversationToFolder(convId, folderId);
      // Auto-expand folder on drop
      if (folderId) {
        setCollapsedFolders((prev) => { const next = new Set(prev); next.delete(folderId); return next; });
      }
    }
    setDraggingConvId(null);
    setDragOverTarget(null);
  }

  /** Create a new conversation directly inside a folder */
  function createConversationInFolder(folderId: string) {
    const id = createConversation();
    if (moveConversationToFolder) moveConversationToFolder(id, folderId);
    setInputValue("");
    setAttachedFiles([]);
    // Make sure the folder is expanded
    setCollapsedFolders((prev) => { const next = new Set(prev); next.delete(folderId); return next; });
  }

  /** Render a single conversation row */
  function renderConvRow(conv: Conversation) {
    const isDragging = draggingConvId === conv.id;
    return (
      <div key={conv.id}
        className={`chat-conversation-row ${conv.id === activeConversationId ? "active" : ""} ${isDragging ? "dragging" : ""}`}
        draggable={!!moveConversationToFolder}
        onDragStart={(e) => handleConvDragStart(e, conv.id)}
        onDragEnd={handleConvDragEnd}
      >
        {editingId === conv.id ? (
          <input autoFocus className="input" style={{ padding: "4px 8px", fontSize: "0.82rem", height: 28 }}
            value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => { renameConversation(conv.id, editTitle); setEditingId(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { renameConversation(conv.id, editTitle); setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
          />
        ) : (
          <button className="chat-conversation-btn" onClick={() => setActiveConversationId(conv.id)}>
            <MessageSquare size={13} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{conv.title}</span>
            <span className="muted" style={{ fontSize: "0.7rem", flexShrink: 0 }}>{formatDate(conv.updatedAt)}</span>
          </button>
        )}
        <div className="chat-conversation-actions">
          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => { setEditingId(conv.id); setEditTitle(conv.title); }} title="Rename"><Pencil size={11} /></button>
          {moveConversationToFolder && chatFolders.length > 0 && (
            <button className="icon-btn" style={{ width: 24, height: 24, position: "relative" }}
              onClick={() => setConvMenuId(convMenuId === conv.id ? null : conv.id)} title="Move to folder">
              <Folder size={11} />
            </button>
          )}
          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => deleteConversation(conv.id)} title="Delete"><Trash2 size={11} /></button>
        </div>
        {/* Move-to-folder dropdown */}
        {convMenuId === conv.id && moveConversationToFolder && (
          <div ref={convMenuRef} className="chat-folder-menu" style={{ top: "100%", right: 0 }}>
            <button className="chat-folder-menu-item" onClick={() => { moveConversationToFolder(conv.id, undefined); setConvMenuId(null); }}>
              <MessageSquare size={12} /> Unfiled
            </button>
            {chatFolders.map((f) => (
              <button key={f.id} className={`chat-folder-menu-item ${conv.folderId === f.id ? "active" : ""}`}
                onClick={() => { moveConversationToFolder(conv.id, f.id); setConvMenuId(null); }}>
                <Folder size={12} /> {f.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chat-hero-claude">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-top">
          <button className="chat-new-btn" onClick={() => { setActiveConversationId(null); setInputValue(""); setAttachedFiles([]); }}>
            <Plus size={14} /> New chat
          </button>
          {createChatFolder && (
            <button className="icon-btn chat-new-folder-btn" title="New folder"
              onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}>
              <FolderPlus size={14} />
            </button>
          )}
        </div>
        <div className="chat-search">
          <Search size={12} className="muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search conversations…" />
        </div>
        <div className="chat-conversation-list">
          {/* New folder inline input */}
          {creatingFolder && createChatFolder && (
            <div className="chat-folder-create">
              <FolderPlus size={13} className="muted" />
              <input autoFocus className="input" style={{ padding: "3px 6px", fontSize: "0.82rem", height: 26, flex: 1 }}
                placeholder="Folder name…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => { if (newFolderName.trim()) createChatFolder(newFolderName.trim()); setCreatingFolder(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { if (newFolderName.trim()) createChatFolder(newFolderName.trim()); setCreatingFolder(false); }
                  if (e.key === "Escape") setCreatingFolder(false);
                }}
              />
            </div>
          )}

          {/* Folders */}
          {chatFolders.map((folder) => {
            const folderConvs = folderedConvs.get(folder.id) ?? [];
            const isCollapsed = collapsedFolders.has(folder.id);
            const isDragOver = dragOverTarget === folder.id;
            // In search mode, only show folder if it has matching convs
            if (searchQuery.trim() && folderConvs.length === 0) return null;
            return (
              <div key={folder.id}
                className={`chat-folder-group ${isDragOver ? "drag-over" : ""}`}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={(e) => handleFolderDragLeave(e, folder.id)}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
              >
                <div className="chat-folder-header">
                  <button className="chat-folder-toggle" onClick={() => toggleFolderCollapse(folder.id)}>
                    <ChevronRightIcon size={12} className={`chat-folder-chevron ${isCollapsed ? "" : "open"}`} />
                    {isCollapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
                    {editingFolderId === folder.id ? (
                      <input autoFocus className="input" style={{ padding: "2px 6px", fontSize: "0.8rem", height: 22, flex: 1 }}
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => { if (renameChatFolder && editFolderName.trim()) renameChatFolder(folder.id, editFolderName.trim()); setEditingFolderId(null); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { if (renameChatFolder && editFolderName.trim()) renameChatFolder(folder.id, editFolderName.trim()); setEditingFolderId(null); }
                          if (e.key === "Escape") setEditingFolderId(null);
                        }}
                      />
                    ) : (
                      <span className="chat-folder-name">{folder.name}</span>
                    )}
                    <span className="chat-folder-count">{folderConvs.length}</span>
                  </button>
                  {/* New chat in this folder */}
                  {moveConversationToFolder && (
                    <button className="icon-btn chat-folder-new-chat" style={{ width: 22, height: 22 }}
                      onClick={(e) => { e.stopPropagation(); createConversationInFolder(folder.id); }}
                      title="New chat in folder">
                      <Plus size={12} />
                    </button>
                  )}
                  <button className="icon-btn chat-folder-more" style={{ width: 22, height: 22 }}
                    onClick={(e) => { e.stopPropagation(); setFolderMenuId(folderMenuId === folder.id ? null : folder.id); }}
                    title="Folder options">
                    <MoreHorizontal size={12} />
                  </button>
                  {/* Folder context menu */}
                  {folderMenuId === folder.id && (
                    <div ref={folderMenuRef} className="chat-folder-menu">
                      <button className="chat-folder-menu-item" onClick={() => { createConversationInFolder(folder.id); setFolderMenuId(null); }}>
                        <Plus size={12} /> New chat here
                      </button>
                      <button className="chat-folder-menu-item" onClick={() => { setEditingFolderId(folder.id); setEditFolderName(folder.name); setFolderMenuId(null); }}>
                        <Pencil size={12} /> Rename
                      </button>
                      {deleteChatFolder && (
                        <button className="chat-folder-menu-item danger" onClick={() => { deleteChatFolder(folder.id); setFolderMenuId(null); }}>
                          <Trash2 size={12} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="chat-folder-children">
                    {folderConvs.map(renderConvRow)}
                    {folderConvs.length === 0 && (
                      <div className="muted" style={{ padding: "6px 12px 6px 32px", fontSize: "0.76rem" }}>
                        {draggingConvId ? "Drop here" : "Empty"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unfiled conversations — also a drop target to remove from folder */}
          {(unfiledConvs.length > 0 || draggingConvId) && chatFolders.length > 0 && (
            <div
              className={`chat-unfiled-zone ${dragOverTarget === "__unfiled__" ? "drag-over" : ""}`}
              onDragOver={(e) => handleFolderDragOver(e, "__unfiled__")}
              onDragLeave={(e) => handleFolderDragLeave(e, "__unfiled__")}
              onDrop={(e) => handleFolderDrop(e, undefined)}
            >
              {unfiledConvs.length > 0 && (
                <div className="chat-unfiled-label">Chats</div>
              )}
              {unfiledConvs.map(renderConvRow)}
            </div>
          )}

          {/* If no folders exist, render unfiled directly */}
          {chatFolders.length === 0 && unfiledConvs.map(renderConvRow)}

          {conversationList.length === 0 && !creatingFolder && (
            <div className="muted" style={{ padding: 20, textAlign: "center", fontSize: "0.82rem" }}>{searchQuery ? "No matches" : "No conversations yet"}</div>
          )}
        </div>
      </aside>
      <div className="chat-main">{chatBody}</div>
    </div>
  );
}
