import { FormEvent, useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  Send, Bot, Sparkles, Calendar, FileText, BookOpen,
  Trash2, Plus, Search, MessageSquare, ChevronDown, Pencil, Cpu, Paperclip, X,
} from "lucide-react";
import type { Conversation, AISettings, ChatMessage, MoodleFile, UserProfile } from "../types";
import { moodleFileKey } from "../lib/utils";
import { Avatar } from "./Avatar";

/* ─── slash commands with groups ─── */
const slashCommands = [
  { id: "/plan", label: "Plan my week", group: "AI Skills", icon: <Calendar size={13} />, prompt: "Analyze my upcoming assignments, exams, and calendar events for this week. Create a realistic study plan and suggest any calendar events I should add." },
  { id: "/schedule-study", label: "Schedule study sessions", group: "AI Skills", icon: <Calendar size={13} />, prompt: "Based on my exam dates and assignment deadlines, suggest and create study session calendar events. Spread them reasonably across available days." },
  { id: "/summarize-note", label: "Summarize current note", group: "AI Skills", icon: <BookOpen size={13} />, prompt: "Summarize the current note I'm viewing. Highlight key concepts, formulas, and any action items." },
  { id: "/create-assignment", label: "Create assignment", group: "Assignment", icon: <FileText size={13} />, prompt: "I want to create a new assignment. Ask me for the subject, title, due date, and weight, then create it using an action block." },
  { id: "/create-exam", label: "Create exam", group: "Assignment", icon: <Sparkles size={13} />, prompt: "I want to create a new exam or quiz. Ask me for the subject, title, type, date, and weight, then create it using an action block." },
];

const modelOptions: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    { value: "claude-3-opus-latest", label: "Claude 3 Opus" },
  ],
  "claude-code": [{ value: "claude", label: "Claude Code" }],
  "codex-cli": [{ value: "codex", label: "Codex CLI" }],
  opencode: [{ value: "opencode", label: "OpenCode" }],
};

function modelLabel(provider: string, model: string): string {
  return modelOptions[provider]?.find((m) => m.value === model)?.label ?? model;
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
  placeholder = "How can I help you today?", compact = false,
  userProfile,
}: {
  conversation: Conversation | null;
  conversations: Record<string, Conversation>;
  onSend: (text: string, displayText?: string, fileIds?: string[]) => void;
  loading?: boolean;
  aiSettings: AISettings;
  setAISettings: (v: AISettings) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createConversation: (firstUserText?: string) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  moodleFiles?: MoodleFile[];
  placeholder?: string;
  compact?: boolean;
  userProfile?: UserProfile;
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
  const [attachedFiles, setAttachedFiles] = useState<MoodleFile[]>([]);

  const msgs = visibleMessages(conversation);
  const isNewChat = !conversation || msgs.length === 0;

  const conversationList = useMemo(() => {
    const list = Object.values(conversations).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [msgs, loading]);
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [inputValue]);

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
    if (!atOpen) return [];
    const q = atQuery(inputValue).toLowerCase();
    if (!q) return moodleFiles.slice(0, 12);
    return moodleFiles.filter((f) => f.filename.toLowerCase().includes(q)).slice(0, 12);
  }, [atOpen, inputValue, moodleFiles]);

  function atQuery(val: string): string {
    const idx = val.lastIndexOf("@");
    if (idx === -1) return "";
    const after = val.slice(idx + 1);
    const space = after.search(/\s/);
    return space === -1 ? after : after.slice(0, space);
  }

  // flatten items for arrow-key nav
  const slashFlat = slashOpen ? slashMatches : [];
  const menuItems = slashOpen ? slashFlat : filteredFiles;
  const menuLength = menuItems.length;

  function resetMenu() { setHighlightIdx(0); setSlashOpen(false); setAtOpen(false); }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || loading) return;

    const command = slashOpen ? slashFlat[highlightIdx] ?? null : null;
    if (command && slashOpen) {
      const rest = text.slice(command.id.length).trim();
      const prompt = `${command.prompt}${rest ? "\n" + rest : ""}`;
      onSend(prompt, text, attachedFiles.map((f) => moodleFileKey(f)));
    } else {
      onSend(text, undefined, attachedFiles.map((f) => moodleFileKey(f)));
    }
    setInputValue(""); setAttachedFiles([]); resetMenu();
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

  const currentModelLabel = modelLabel(aiSettings.provider, conversation?.model ?? aiSettings.model);

  const chatBody = (
    <>
      <div ref={logRef} className="chat-log" style={{ padding: compact ? 14 : 24 }}>
        {isNewChat && !compact && (
          <div className="chat-welcome-claude">
            <h2>Your Academic Assistant</h2>
            <p className="muted">Ask about your schedule, notes, assignments, and exams.</p>
            <div className="chat-suggestion-grid">
              {slashCommands.slice(0, 4).map((cmd) => (
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
            <div className="msg-body"><MarkdownContent content={m.content} /></div>
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
        {atOpen && filteredFiles.length > 0 && (
          <div className="slash-menu" style={{ maxWidth: 420 }}>
            {filteredFiles.map((file, fi) => (
              <button key={moodleFileKey(file)}
                className={`slash-item ${fi === highlightIdx ? "highlight" : ""}`}
                onMouseEnter={() => setHighlightIdx(fi)}
                onClick={() => insertFile(file)}>
                <Paperclip size={13} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                  <strong>{file.filename}</strong>
                  <span className="muted" style={{ marginLeft: 8, fontSize: "0.78rem" }}>
                    {file.installed ? "Synced" : "Moodle"} · {file.courseName}
                  </span>
                </span>
              </button>
            ))}
            {filteredFiles.length === 0 && atOpen && (
              <div className="muted" style={{ padding: "8px 12px", fontSize: "0.8rem" }}>No matching files</div>
            )}
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
          <textarea ref={inputRef} className="chat-textarea" placeholder={placeholder}
            disabled={loading} value={inputValue} rows={1}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { resetMenu(); return; }
              if (e.key === "Enter" && !e.shiftKey && !slashOpen && !atOpen) {
                e.preventDefault(); handleSubmit(e); return;
              }
              if (slashOpen || atOpen) {
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((p) => Math.min(p + 1, menuLength - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((p) => Math.max(p - 1, 0)); }
                else if (e.key === "Enter") { e.preventDefault();
                  if (slashOpen) { const cmd = slashFlat[highlightIdx]; if (cmd) insertCommand(cmd); }
                  else if (atOpen) { const file = filteredFiles[highlightIdx]; if (file) insertFile(file); }
                }
              }
            }}
          />
          <div className="chat-composer-footer">
            <div className="chat-model-picker">
              <button type="button" className="chat-model-btn" onClick={() => setModelOpen(!modelOpen)}>
                <Cpu size={12} /><span>{currentModelLabel}</span><ChevronDown size={12} />
              </button>
              {modelOpen && (
                <div className="chat-model-dropdown">
                  {modelOptions[aiSettings.provider]?.map((m) => (
                    <button key={m.value} className={`chat-model-option ${(conversation?.model ?? aiSettings.model) === m.value ? "active" : ""}`}
                      onClick={() => { setAISettings({ ...aiSettings, model: m.value }); setModelOpen(false); }}>
                      {m.label}
                    </button>
                  )) ?? <div className="muted" style={{ padding: "8px 12px", fontSize: "0.8rem" }}>No models</div>}
                </div>
              )}
            </div>
            <button className="chat-send-btn" aria-label="Send" disabled={loading || (!inputValue.trim() && attachedFiles.length === 0)}>
              <Send size={15} />
            </button>
          </div>
        </form>
      </div>
    </>
  );

  if (compact) return <div className="chat-shell">{chatBody}</div>;

  return (
    <div className="chat-hero-claude">
      <aside className="chat-sidebar">
        <button className="chat-new-btn" onClick={() => { setActiveConversationId(null); setInputValue(""); setAttachedFiles([]); }}>
          <Plus size={14} /> New chat
        </button>
        <div className="chat-search">
          <Search size={12} className="muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search conversations…" />
        </div>
        <div className="chat-conversation-list">
          {conversationList.map((conv) => (
            <div key={conv.id} className={`chat-conversation-row ${conv.id === activeConversationId ? "active" : ""}`}>
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
                <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => deleteConversation(conv.id)} title="Delete"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
          {conversationList.length === 0 && (
            <div className="muted" style={{ padding: 20, textAlign: "center", fontSize: "0.82rem" }}>{searchQuery ? "No matches" : "No conversations yet"}</div>
          )}
        </div>
      </aside>
      <div className="chat-main">{chatBody}</div>
    </div>
  );
}
