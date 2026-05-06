import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, FileCode, FileText, Folder, FolderPlus,
  PanelLeftClose, PanelLeftOpen, Plus, Trash2, X, ChevronRight, ChevronLeft,
  Search, MoreHorizontal, Pencil, StickyNote, BookOpen, Calendar, Sparkles,
  LayoutList, Grid3X3, Paperclip
} from "lucide-react";
import type { Subject, Note, Theme, Conversation, AISettings, UserProfile, ExamRecord, ExamKind, MoodleFile, ChatImage } from "../types";
import { MilkdownEditor, type MilkdownEditorHandle } from "../MilkdownEditor";
import { SubjectFileEditor } from "../components/SubjectFileEditor";
import { ChatPanel } from "../components/ChatPanel";
import { ALL_NOTES_FOLDER, UNFILED_FOLDER, MY_SPACE_CODE, formatFileSize, localAssetHref, moodleFileKey } from "../lib/utils";
import { apiOrigin, openMoodleFile } from "../lib/api";
import katex from "katex";
import "katex/dist/katex.min.css";

function renderMarkdownPreview(content: string) {
  const parts: { type: "text" | "inlineMath" | "displayMath"; value: string }[] = [];
  const displayRegex = /\$\$([\s\S]*?)\$\$/g;
  let m: RegExpExecArray | null; let last = 0;
  while ((m = displayRegex.exec(content)) !== null) {
    if (m.index > last) parts.push({ type: "text", value: content.slice(last, m.index) });
    parts.push({ type: "displayMath", value: m[1] }); last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ type: "text", value: content.slice(last) });
  const out: typeof parts = [];
  for (const p of parts) {
    if (p.type !== "text") { out.push(p); continue; }
    const ire = /\$([^\$\n]+?)\$/g; let ilast = 0;
    while ((m = ire.exec(p.value)) !== null) {
      if (m.index > ilast) out.push({ type: "text", value: p.value.slice(ilast, m.index) });
      out.push({ type: "inlineMath", value: m[1] }); ilast = m.index + m[0].length;
    }
    if (ilast < p.value.length) out.push({ type: "text", value: p.value.slice(ilast) });
  }
  return out.map((n, i) => {
    if (n.type === "text") return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{n.value}</span>;
    try { const h = katex.renderToString(n.value, { throwOnError: false, displayMode: n.type === "displayMath" }); return <span key={i} dangerouslySetInnerHTML={{ __html: h }} />; }
    catch { return <code key={i} className="muted">${n.value}$</code>; }
  });
}

type ContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  type: "note" | "folder";
  id: string;
};

type LinkPickerState = {
  open: boolean;
  type: "note" | "moodle";
  mode: "source" | "rich";
  query: string;
  start: number;
  end: number;
  x: number;
  y: number;
};

export function KnowledgePage({
  subjects, activeSubject, activeNote, activeSubjectId, setActiveSubjectId, setActiveNoteId,
  activeFolderId, setActiveFolderId, createNote, createFolder, deleteFolder, moveNote,
  deleteNote, updateNote, renameNote, saveCourseInfo, deleteSubject, syncStatus, theme,
  conversation, conversations, sendChat, loadingConversationId,
  aiSettings, setAISettings, activeConversationId, setConversationModel, setActiveConversationId,
  createConversation, deleteConversation, renameConversation,
  userProfile, exams, addExam, updateExam, deleteExam,
  ensureNotesChatFolder, moveConversationToFolder, moodleFiles,
}: {
  subjects: Subject[]; activeSubject?: Subject; activeNote?: Note;
  activeSubjectId: string; setActiveSubjectId: (id: string) => void;
  setActiveNoteId: (id: string) => void; activeFolderId: string;
  setActiveFolderId: (id: string) => void; createNote: (folderId?: string) => void;
  createFolder: (name?: string) => void; deleteFolder: (id: string) => void;
  moveNote: (noteId: string, folderId: string) => void; deleteNote: (noteId?: string) => void;
  updateNote: (content: string) => void; renameNote: (title: string) => void;
  saveCourseInfo: (info: string) => void; deleteSubject: (id: string) => void;
  syncStatus: string; theme: Theme;
  conversation: Conversation | null; conversations: Record<string, Conversation>;
  sendChat: (text: string, displayText?: string, fileIds?: string[], contextPrefix?: string, targetConversationId?: string, images?: ChatImage[]) => void;
  loadingConversationId: string | null; aiSettings: AISettings;
  setAISettings: (v: AISettings) => void; activeConversationId: string | null;
  setConversationModel: (id: string, model: string, provider: AISettings["provider"]) => void;
  setActiveConversationId: (id: string | null) => void;
  createConversation: (firstUserText?: string) => string;
  deleteConversation: (id: string) => void; renameConversation: (id: string, title: string) => void;
  userProfile?: UserProfile;
  exams: ExamRecord[];
  addExam: (input: { title: string; subjectId: string; kind: ExamKind; date: string; weight: number; score: number; maxScore: number; notes: string; relatedFileIds: string[] }) => void;
  updateExam: (id: string, patch: Partial<ExamRecord>) => void;
  deleteExam: (id: string) => void;
  ensureNotesChatFolder: () => string;
  moveConversationToFolder: (convId: string, folderId: string | undefined) => void;
  moodleFiles: MoodleFile[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [editorMode, setEditorMode] = useState<"rich" | "source">("rich");
  const [showCourseInfo, setShowCourseInfo] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0, type: "note", id: "" });
  const [noteViewMode, setNoteViewMode] = useState<"list" | "grid">("list");
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameNoteInput, setRenameNoteInput] = useState("");
  const [linkPicker, setLinkPicker] = useState<LinkPickerState>({ open: false, type: "note", mode: "source", query: "", start: 0, end: 0, x: 18, y: 18 });
  const [linkPickerIndex, setLinkPickerIndex] = useState(0);
  const [selectedMoodlePickerGroupId, setSelectedMoodlePickerGroupId] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const milkdownRef = useRef<MilkdownEditorHandle>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sourceWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu((p) => ({ ...p, open: false }));
      }
    }
    if (contextMenu.open) { document.addEventListener("mousedown", onClick); return () => document.removeEventListener("mousedown", onClick); }
  }, [contextMenu.open]);

  // per-note conversation
  const noteConv = useMemo(() => {
    if (!activeNote) return null;
    const noteTitle = `Chat: ${activeNote.title}`;
    return Object.values(conversations).find((c) => c.title === noteTitle) ?? null;
  }, [conversations, activeNote]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase(); if (!q) return [];
    return subjects.flatMap((s) =>
      s.notes.filter((n) => `${n.title}\n${n.content}`.toLowerCase().includes(q))
        .map((note) => ({ subject: s, note }))
    ).slice(0, 24);
  }, [searchQuery, subjects]);

  const noteLinkOptions = useMemo(() => {
    const q = linkPicker.query.trim().toLowerCase();
    return subjects.flatMap((subject) => subject.notes.map((note) => ({ subject, note })))
      .filter(({ note, subject }) => {
        if (!q) return true;
        return note.title.toLowerCase().includes(q) || subject.code.toLowerCase().includes(q) || subject.name.toLowerCase().includes(q);
      })
      .slice(0, 10);
  }, [subjects, linkPicker.query]);

  const moodleLinkOptions = useMemo(() => {
    const q = linkPicker.query.trim().toLowerCase();
    return moodleFiles
      .filter((file) => {
        if (!q) return true;
        return file.filename.toLowerCase().includes(q)
          || file.courseName.toLowerCase().includes(q)
          || (file.section ?? "").toLowerCase().includes(q)
          || (file.moduleName ?? "").toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [moodleFiles, linkPicker.query]);

  const moodlePickerGroups = useMemo(() => {
    const q = linkPicker.query.trim().toLowerCase();
    const groups: { id: string; label: string; sublabel: string; color?: string; files: MoodleFile[] }[] = [];
    const groupedKeys = new Set<string>();
    for (const subject of subjects) {
      const files = moodleFiles.filter((file) => {
        const subjectMatch = file.courseName.toUpperCase().includes(subject.code.toUpperCase())
          || file.courseName.toLowerCase().includes(subject.name.toLowerCase());
        const queryMatch = !q
          || file.filename.toLowerCase().includes(q)
          || file.courseName.toLowerCase().includes(q)
          || (file.section ?? "").toLowerCase().includes(q)
          || (file.moduleName ?? "").toLowerCase().includes(q);
        return subjectMatch && queryMatch;
      });
      if (files.length) {
        files.forEach((file) => groupedKeys.add(moodleFileKey(file)));
        groups.push({ id: subject.id, label: subject.code, sublabel: subject.name, color: subject.color, files: files.slice(0, 24) });
      }
    }
    const otherFiles = moodleFiles
      .filter((file) => !groupedKeys.has(moodleFileKey(file)))
      .filter((file) => !q
        || file.filename.toLowerCase().includes(q)
        || file.courseName.toLowerCase().includes(q)
        || (file.section ?? "").toLowerCase().includes(q)
        || (file.moduleName ?? "").toLowerCase().includes(q))
      .slice(0, 24);
    if (otherFiles.length) groups.push({ id: "__other__", label: "Other", sublabel: "Unmatched Moodle files", files: otherFiles });
    return groups;
  }, [subjects, moodleFiles, linkPicker.query]);

  const selectedMoodlePickerGroup = moodlePickerGroups.find((group) => group.id === selectedMoodlePickerGroupId) ?? moodlePickerGroups[0];
  const moodlePickerFiles = selectedMoodlePickerGroup?.files ?? [];
  const linkPickerOptionCount = linkPicker.type === "note" ? noteLinkOptions.length : moodlePickerFiles.length;

  useEffect(() => {
    setLinkPickerIndex(0);
  }, [linkPicker.open, linkPicker.type, linkPicker.query]);

  useEffect(() => {
    if (linkPicker.type !== "moodle" || !linkPicker.open) return;
    if (!moodlePickerGroups.length) {
      setSelectedMoodlePickerGroupId("");
      return;
    }
    if (!moodlePickerGroups.some((group) => group.id === selectedMoodlePickerGroupId)) {
      setSelectedMoodlePickerGroupId(moodlePickerGroups[0].id);
    }
  }, [linkPicker.type, linkPicker.open, moodlePickerGroups, selectedMoodlePickerGroupId]);

  if (!subjects.length) {
    return (
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <div className="empty" style={{ border: 0, background: "transparent" }}>
          <BookOpen size={48} strokeWidth={1.2} style={{ color: "var(--muted)", marginBottom: 16 }} />
          <strong style={{ display: "block", color: "var(--text)", marginBottom: 6, fontSize: "1.1rem" }}>No subjects yet</strong>
          <p style={{ color: "var(--muted)", maxWidth: 320, margin: "0 auto 16px" }}>
            Import a timetable in Settings, or pick subjects from Moodle to start taking notes.
          </p>
        </div>
      </div>
    );
  }

  const folders = activeSubject?.folders ?? [];
  const mySpaceSubject = subjects.find((subject) => subject.code === MY_SPACE_CODE);
  const isMySpace = activeSubject?.code === MY_SPACE_CODE;
  const isOverviewNote = (note?: Note) => !!note && note.title.toLowerCase().endsWith("overview");
  const visibleNotes = activeSubject?.notes.filter((note) => {
    if (activeFolderId === ALL_NOTES_FOLDER) return true;
    if (activeFolderId === UNFILED_FOLDER) return !note.folderId;
    return note.folderId === activeFolderId;
  }) ?? [];

  function openSearchResult(subject: Subject, note: Note) {
    setActiveSubjectId(subject.id); setActiveFolderId(note.folderId ?? UNFILED_FOLDER); setActiveNoteId(note.id);
  }

  function chooseFolder(folderId: string) {
    if (!activeSubject) return;
    setActiveFolderId(folderId);
    const nextNote = activeSubject.notes.find((note) => {
      if (folderId === ALL_NOTES_FOLDER) return true;
      if (folderId === UNFILED_FOLDER) return !note.folderId;
      return note.folderId === folderId;
    });
    setActiveNoteId(nextNote?.id ?? "");
  }

  function submitNewFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder(name);
    setNewFolderName("");
    setCreatingFolder(false);
  }

  function handleCreateNote(folderId?: string) {
    setEditorMode("rich");
    createNote(folderId);
  }

  function ensureNoteConversation() {
    if (!activeNote) return;
    if (noteConv) {
      setActiveConversationId(noteConv.id);
      return noteConv.id;
    } else {
      const id = createConversation();
      renameConversation(id, `Chat: ${activeNote.title}`);
      // Assign to the "Notes" chat folder
      const notesFolderId = ensureNotesChatFolder();
      moveConversationToFolder(id, notesFolderId);
      setActiveConversationId(id);
      return id;
    }
  }

  function openNoteAI() {
    if (!activeNote) return;
    ensureNoteConversation();
    setAiOpen(true);
  }

  function sendNoteChat(text: string, displayText?: string, fileIds?: string[]) {
    const conversationId = ensureNoteConversation();
    if (!conversationId) return;
    const ctx = activeNote
      ? `Note context (hidden from user):\nTitle: ${activeNote.title}\nContent:\n${activeNote.content.slice(0, 3000)}`
      : "";
    sendChat(text, displayText ?? text, fileIds, ctx, conversationId);
  }

  function normalizeWikiTitle(value: string) {
    return value
      .split("|")[0]
      .split("#")[0]
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function openWikiLink(rawTitle: string) {
    const wanted = normalizeWikiTitle(rawTitle);
    if (!wanted) return;
    const currentSubjectMatch = activeSubject?.notes.find((n) => normalizeWikiTitle(n.title) === wanted);
    if (currentSubjectMatch) {
      setActiveFolderId(currentSubjectMatch.folderId ?? UNFILED_FOLDER);
      setActiveNoteId(currentSubjectMatch.id);
      return;
    }
    for (const subject of subjects) {
      const target = subject.notes.find((n) => normalizeWikiTitle(n.title) === wanted);
      if (target) {
        setActiveSubjectId(subject.id);
        setActiveFolderId(target.folderId ?? UNFILED_FOLDER);
        setActiveNoteId(target.id);
        return;
      }
    }
  }

  function escapeMarkdownLabel(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/]/g, "\\]");
  }

  function escapeMarkdownUrl(value: string) {
    return value.replace(/\)/g, "%29").replace(/\(/g, "%28");
  }

  function moodleHref(file: MoodleFile) {
    return localAssetHref(file.localUrl ?? file.fileurl ?? (file.localPath ? `file://${file.localPath}` : ""), apiOrigin());
  }

  function getCaretPickerPosition(textarea: HTMLTextAreaElement, cursor: number) {
    const wrap = sourceWrapRef.current;
    if (!wrap) return { x: 18, y: 18 };
    const style = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const properties = [
      "boxSizing", "width", "height", "fontFamily", "fontSize", "fontWeight", "fontStyle",
      "letterSpacing", "textTransform", "wordSpacing", "lineHeight", "paddingTop", "paddingRight",
      "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth",
      "borderLeftWidth", "whiteSpace", "wordBreak", "overflowWrap", "tabSize",
    ] as const;
    properties.forEach((property) => {
      mirror.style[property] = style[property];
    });
    const textareaRect = textarea.getBoundingClientRect();
    mirror.style.position = "fixed";
    mirror.style.visibility = "hidden";
    mirror.style.left = `${textareaRect.left}px`;
    mirror.style.top = `${textareaRect.top}px`;
    mirror.style.overflow = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.wordWrap = "break-word";
    mirror.textContent = textarea.value.slice(0, cursor);
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const markerRect = marker.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    document.body.removeChild(mirror);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    const pickerWidth = 420;
    const x = Math.min(
      Math.max(markerRect.left - wrapRect.left - textarea.scrollLeft, 10),
      Math.max(wrap.clientWidth - pickerWidth - 10, 10),
    );
    const y = Math.min(
      Math.max(markerRect.top - wrapRect.top - textarea.scrollTop + lineHeight + 6, 10),
      Math.max(wrap.clientHeight - 330, 10),
    );
    return { x, y };
  }

  function detectLinkTrigger(value: string, cursor: number) {
    const textarea = sourceTextareaRef.current;
    const position = textarea ? getCaretPickerPosition(textarea, cursor) : { x: 18, y: 18 };
    const before = value.slice(0, cursor);
    const wiki = before.match(/\[\[([^\]\n]*)$/);
    if (wiki) {
      const query = wiki[1] ?? "";
      setLinkPicker({ open: true, type: "note", mode: "source", query, start: cursor - query.length - 2, end: cursor, ...position });
      return;
    }
    const moodle = before.match(/(?:^|\s)@([^\s@]*)$/);
    if (moodle) {
      const query = moodle[1] ?? "";
      setLinkPicker({ open: true, type: "moodle", mode: "source", query, start: cursor - query.length - 1, end: cursor, ...position });
      return;
    }
    if (linkPicker.open) setLinkPicker((prev) => ({ ...prev, open: false }));
  }

  function handleSourceChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    updateNote(next);
    detectLinkTrigger(next, e.target.selectionStart);
  }

  function insertTextIntoActiveNote(inserted: string) {
    if (!activeNote) return;
    const current = sourceTextareaRef.current?.value ?? activeNote.content;
    const before = current.slice(0, linkPicker.start);
    const after = current.slice(linkPicker.end);
    const next = `${before}${inserted}${after}`;
    const cursor = before.length + inserted.length;
    updateNote(next);
    setLinkPicker((prev) => ({ ...prev, open: false }));
    window.setTimeout(() => {
      const el = sourceTextareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    }, 0);
  }

  function insertNoteLink(note: Note) {
    if (linkPicker.mode === "rich") {
      milkdownRef.current?.replaceTriggerWithLink(note.title, `xmum-note://${encodeURIComponent(note.title)}`);
      setLinkPicker((prev) => ({ ...prev, open: false }));
      return;
    }
    insertTextIntoActiveNote(`[[${note.title}]]`);
  }

  function insertMoodleLink(file: MoodleFile) {
    const href = moodleHref(file);
    if (!href) return;
    if (linkPicker.mode === "rich") {
      milkdownRef.current?.replaceTriggerWithLink(file.filename, `xmum-moodle://${encodeURIComponent(moodleFileKey(file))}`);
      setLinkPicker((prev) => ({ ...prev, open: false }));
      return;
    }
    insertTextIntoActiveNote(`[${escapeMarkdownLabel(file.filename)}](${escapeMarkdownUrl(href)})`);
  }

  function chooseLinkPickerOption(index = linkPickerIndex) {
    if (!linkPicker.open || linkPickerOptionCount === 0) return;
    const safeIndex = Math.max(0, Math.min(index, linkPickerOptionCount - 1));
    if (linkPicker.type === "note") {
      const target = noteLinkOptions[safeIndex]?.note;
      if (target) insertNoteLink(target);
      return;
    }
    const target = moodlePickerFiles[safeIndex];
    if (target) insertMoodleLink(target);
  }

  function handleLinkPickerKeyDown(event: { key: string; preventDefault: () => void; stopPropagation: () => void }) {
    if (!linkPicker.open) return false;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      setLinkPickerIndex((idx) => Math.min(idx + 1, Math.max(0, linkPickerOptionCount - 1)));
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setLinkPickerIndex((idx) => Math.max(idx - 1, 0));
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      chooseLinkPickerOption();
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setLinkPicker((prev) => ({ ...prev, open: false }));
      return true;
    }
    return false;
  }

  function openLinkedMoodleFile(key: string) {
    const file = moodleFiles.find((candidate) => moodleFileKey(candidate) === key);
    if (file) {
      void openMoodleFile(file);
    }
  }

  const handleNoteContextMenu = useCallback((e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, type: "note", id: noteId });
  }, []);

  const sideWidth = sideCollapsed ? 58 : 280;
  const totalNotes = activeSubject?.notes.length ?? 0;
  const activeFolderLabel = activeFolderId === ALL_NOTES_FOLDER
    ? "All notes"
    : activeFolderId === UNFILED_FOLDER
      ? "Unfiled"
      : folders.find((folder) => folder.id === activeFolderId)?.name ?? "All notes";
  const activeNoteWordCount = activeNote?.content.trim()
    ? activeNote.content.trim().split(/\s+/).length
    : 0;
  const activePickerNoteId = linkPicker.type === "note" ? noteLinkOptions[linkPickerIndex]?.note.id : "";
  const activePickerMoodleKey = linkPicker.type === "moodle" && moodlePickerFiles[linkPickerIndex]
    ? moodleFileKey(moodlePickerFiles[linkPickerIndex])
    : "";

  const linkPickerNode = linkPicker.open ? (
    <div
      className={`k-link-picker ${linkPicker.mode === "rich" ? "fixed" : ""}`}
      style={{ left: linkPicker.x, top: linkPicker.y }}
    >
      <div className="k-link-picker-head">
        {linkPicker.type === "note" ? <StickyNote size={13} /> : <Paperclip size={13} />}
        <span>{linkPicker.type === "note" ? "Existing notes" : "Moodle files"}</span>
      </div>
      {linkPicker.type === "note" ? (
        <div className="k-link-picker-list">
          {noteLinkOptions.length ? noteLinkOptions.map(({ subject, note }) => (
            <button key={note.id} className={`k-link-picker-item ${activePickerNoteId === note.id ? "active" : ""}`} onMouseDown={(e) => { e.preventDefault(); insertNoteLink(note); }}>
              <StickyNote size={14} />
              <span>
                <strong>{note.title}</strong>
                <small>{subject.code} · {subject.name}</small>
              </span>
            </button>
          )) : <div className="k-link-picker-empty">No matching notes</div>}
        </div>
      ) : (
        <div className="k-file-picker-body">
          <div className="k-file-picker-subjects">
            {moodlePickerGroups.map((group) => (
              <button
                key={group.id}
                className={`k-file-picker-subject ${selectedMoodlePickerGroup?.id === group.id ? "active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); setSelectedMoodlePickerGroupId(group.id); setLinkPickerIndex(0); }}
              >
                <span className="k-subject-dot" style={{ background: group.color ?? "var(--muted)" }} />
                <span>
                  <strong>{group.label}</strong>
                  <small>{group.files.length} files</small>
                </span>
              </button>
            ))}
          </div>
          <div className="k-link-picker-list">
            {moodlePickerFiles.length ? moodlePickerFiles.map((file, index) => (
              <button
                key={moodleFileKey(file)}
                className={`k-link-picker-item ${activePickerMoodleKey === moodleFileKey(file) ? "active" : ""}`}
                onMouseEnter={() => setLinkPickerIndex(index)}
                onMouseDown={(e) => { e.preventDefault(); insertMoodleLink(file); }}
              >
                <Paperclip size={14} />
                <span>
                  <strong>{file.filename}</strong>
                  <small>{file.installed ? "Synced" : "Moodle"} · {file.courseName}{file.filesize ? ` · ${formatFileSize(file.filesize)}` : ""}</small>
                </span>
              </button>
            )) : <div className="k-link-picker-empty">No matching files</div>}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="knowledge-shell" style={{ gridTemplateColumns: `${sideWidth}px minmax(0, 1fr)` }}>
      <aside className={`k-side ${sideCollapsed ? "collapsed" : ""}`} style={{ width: sideWidth }}>
        <div className="k-side-top">
          {!sideCollapsed && (
            <div className="k-side-title">
              <strong>Knowledge</strong>
              <span>{subjects.length} subjects</span>
            </div>
          )}
          <button
            className="k-icon-button"
            onClick={() => setSideCollapsed(!sideCollapsed)}
            title={sideCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sideCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <div className="k-subject-list">
          {subjects.map((s) => (
            <button
              key={s.id}
              className={`k-subject ${s.id === activeSubjectId ? "active" : ""}`}
              onClick={() => {
                setActiveSubjectId(s.id);
                setActiveNoteId(s.notes[0]?.id ?? "");
                setActiveFolderId(ALL_NOTES_FOLDER);
                setCreatingFolder(false);
                setNewFolderName("");
              }}
              title={`${s.code} ${s.name}`}
            >
              <span className="k-subject-dot" style={{ background: s.color }} />
              {!sideCollapsed && (
                <span className="k-subject-copy">
                  <strong>{s.code}</strong>
                  <small>{s.name}</small>
                </span>
              )}
              {!sideCollapsed && <span className="k-subject-count">{s.notes.length}</span>}
            </button>
          ))}
        </div>

        {activeSubject && !sideCollapsed && isMySpace && (
          <div className="k-folder-list k-folder-list-sidebar">
            <div className="k-side-section k-folder-section-head">
              <span>Folders</span>
              <button className="k-icon-button small" onClick={() => setCreatingFolder(true)} title="Add folder">
                <FolderPlus size={13} />
              </button>
            </div>
            <button className={`k-folder ${activeFolderId === ALL_NOTES_FOLDER ? "active" : ""}`} onClick={() => chooseFolder(ALL_NOTES_FOLDER)}>
              <BookOpen size={14} />
              <span>All notes</span>
              <b>{activeSubject.notes.length}</b>
            </button>
            <button className={`k-folder ${activeFolderId === UNFILED_FOLDER ? "active" : ""}`} onClick={() => chooseFolder(UNFILED_FOLDER)}>
              <Folder size={14} />
              <span>Unfiled</span>
              <b>{activeSubject.notes.filter((note) => !note.folderId).length}</b>
            </button>
            {folders.map((folder) => (
              <div key={folder.id} className={`k-folder folder-row ${activeFolderId === folder.id ? "active" : ""}`}>
                <button className="folder-main" onClick={() => chooseFolder(folder.id)}>
                  <Folder size={14} />
                  <span>{folder.name}</span>
                  <b>{activeSubject.notes.filter((note) => note.folderId === folder.id).length}</b>
                </button>
                <button className="folder-delete" onClick={() => deleteFolder(folder.id)} title="Delete folder">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {creatingFolder && (
              <div className="k-folder k-folder-input">
                <Folder size={14} />
                <input
                  autoFocus
                  className="input"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => { if (!newFolderName.trim()) setCreatingFolder(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewFolder();
                    if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                  }}
                  placeholder="Folder name"
                />
              </div>
            )}
          </div>
        )}

        {activeSubject && !sideCollapsed && !isMySpace && (
          <div className="k-folder-list k-folder-list-sidebar">
            <div className="k-side-section k-folder-section-head">
              <span>My Space</span>
              <button className="k-icon-button small" onClick={() => setCreatingFolder(true)} title="Add personal folder">
                <FolderPlus size={13} />
              </button>
            </div>
            <button
              className="k-folder"
              onClick={() => {
                if (!mySpaceSubject) return;
                setActiveSubjectId(mySpaceSubject.id);
                setActiveFolderId(ALL_NOTES_FOLDER);
                setActiveNoteId(mySpaceSubject.notes[0]?.id ?? "");
              }}
            >
              <Folder size={14} />
              <span>Personal folders</span>
              <b>{mySpaceSubject?.folders?.length ?? 0}</b>
            </button>
            {creatingFolder && (
              <div className="k-folder k-folder-input">
                <Folder size={14} />
                <input
                  autoFocus
                  className="input"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => { if (!newFolderName.trim()) setCreatingFolder(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitNewFolder();
                    if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                  }}
                  placeholder="Folder name"
                />
              </div>
            )}
          </div>
        )}

        {activeSubject && !sideCollapsed && (
          <>
            <div className="k-search">
              <Search size={14} className="k-search-icon" />
              <input
                className="input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search every note"
              />
              {searchQuery.trim() && (
                <button className="k-search-clear" onClick={() => setSearchQuery("")} title="Clear search">
                  <X size={13} />
                </button>
              )}
              {searchQuery.trim() && (
                <div className="search-results">
                  {searchResults.map(({ subject, note }) => (
                    <button key={`${subject.id}-${note.id}`} className="search-result" onClick={() => openSearchResult(subject, note)}>
                      <strong>{note.title}</strong><small>{subject.code}</small>
                    </button>
                  ))}
                  {!searchResults.length && <div className="empty compact">No matches</div>}
                </div>
              )}
            </div>

            <div className="k-subject-summary">
              <div>
                <strong>{activeSubject.code}</strong>
                <span>{activeSubject.name}</span>
              </div>
              <div className="k-summary-grid">
                <span><b>{totalNotes}</b> notes</span>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Context menu */}
      {contextMenu.open && (
        <div ref={contextMenuRef} className="k-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button className="k-context-item" onClick={() => { setActiveNoteId(contextMenu.id); setContextMenu((p) => ({ ...p, open: false })); }}>Open</button>
          <button className="k-context-item danger" onClick={() => { deleteNote(contextMenu.id); setContextMenu((p) => ({ ...p, open: false })); }}>
            <Trash2 size={12} /> Delete note
          </button>
        </div>
      )}

      <div className={`k-main ${!aiOpen ? "no-ai" : ""}`}>
        <section className="k-notes-panel">
          <div className="k-notes-head">
            <div>
              <span className="k-eyebrow">{activeSubject?.code ?? "Subject"}</span>
              <h2>{activeFolderLabel}</h2>
              <p>{visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}</p>
            </div>
            <div className="k-note-actions">
              <button className="k-icon-button" onClick={() => setNoteViewMode(noteViewMode === "list" ? "grid" : "list")} title={noteViewMode === "list" ? "Grid view" : "List view"}>
                {noteViewMode === "list" ? <Grid3X3 size={15} /> : <LayoutList size={15} />}
              </button>
              <button className="k-icon-button primary" onClick={() => handleCreateNote(activeFolderId)} title="New note">
                <Plus size={15} />
              </button>
            </div>
          </div>

          <div className={`k-note-list ${noteViewMode === "grid" ? "k-notes-grid" : ""}`}>
            {visibleNotes.map((n) => (
              <article
                key={n.id}
                className={`k-note-card ${n.id === activeNote?.id ? "active" : ""}`}
                onClick={() => setActiveNoteId(n.id)}
                onContextMenu={(e) => handleNoteContextMenu(e, n.id)}
              >
                <div className="k-note-card-icon"><StickyNote size={15} /></div>
                <div className="k-note-card-body">
                  {renamingNoteId === n.id ? (
                    <input
                      autoFocus
                      className="input"
                      value={renameNoteInput}
                      onChange={(e) => setRenameNoteInput(e.target.value)}
                      onBlur={() => { renameNote(renameNoteInput); setRenamingNoteId(null); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { renameNote(renameNoteInput); setRenamingNoteId(null); }
                        if (e.key === "Escape") setRenamingNoteId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="k-note-card-title">{n.title}</span>
                  )}
                  <span className="k-note-card-meta">
                    <Calendar size={12} /> {new Date(n.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="k-note-card-menu"
                  onClick={(e) => { e.stopPropagation(); setRenamingNoteId(n.id); setRenameNoteInput(n.title); }}
                  title="Rename note"
                >
                  <Pencil size={12} />
                </button>
              </article>
            ))}
            {!visibleNotes.length && (
              <div className="empty compact">
                <BookOpen size={22} className="muted" style={{ marginBottom: 8 }} />
                <div>No notes in this folder</div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => handleCreateNote(activeFolderId)}>
                  <Plus size={12} /> Create a note
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="k-editor">
          {/* Editor header */}
          {activeSubject && (
            <div className="k-editor-header">
              <div className="k-editor-subject-info">
                <span className="k-editor-subject-dot" style={{ background: activeSubject.color }} />
                <div className="k-editor-subject-text">
                  <strong>{activeSubject.code}</strong>
                  <small>{activeSubject.name}</small>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {activeNote && !isOverviewNote(activeNote) && (<>
                  <div className="k-mode-toggle">
                    <button className={editorMode === "rich" ? "active" : ""} onClick={() => setEditorMode("rich")} title="Rich text"><FileText size={14} /></button>
                    <button className={editorMode === "source" ? "active" : ""} onClick={() => setEditorMode("source")} title="Markdown source"><FileCode size={14} /></button>
                  </div>
                  <select className="select note-folder-select" value={activeNote.folderId ?? ""} onChange={(e) => moveNote(activeNote.id, e.target.value)}>
                    <option value="">Unfiled</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </>)}
                {!activeNote && (
                  <button className={`btn btn-sm ${showCourseInfo ? "btn-primary" : ""}`} onClick={() => setShowCourseInfo(!showCourseInfo)}>Course Info</button>
                )}
              </div>
            </div>
          )}

          {/* Note title bar */}
          {activeNote && !isOverviewNote(activeNote) && (
            <div className="k-titlebar">
              <StickyNote size={17} />
              <input
                className="k-title-input"
                value={activeNote.title}
                onChange={(e) => renameNote(e.target.value)}
                placeholder="Note title…"
              />
              <span className="k-pill">{activeNoteWordCount} words</span>
              <button className="k-icon-button" onClick={openNoteAI} title="Ask AI about this note">
                <Sparkles size={15} />
              </button>
            </div>
          )}

          <div className="k-editor-body">
            {activeSubject && !activeNote && showCourseInfo ? (
              <div className="k-course-info">
                <div className="k-course-info-head">
                  <div>
                    <span className="k-eyebrow">Course profile</span>
                    <h2>{activeSubject.code}</h2>
                    <p>{activeSubject.name}</p>
                  </div>
                  <button className="btn btn-ghost btn-danger" onClick={() => deleteSubject(activeSubject.id)}>
                    <Trash2 size={14} /> Delete subject
                  </button>
                </div>
                <textarea
                  className="textarea"
                  value={activeSubject.courseInfo}
                  onChange={(e) => saveCourseInfo(e.target.value)}
                  placeholder="Course outcomes, lecturer notes, assessment details, and useful links..."
                />
              </div>
            ) : activeNote && isOverviewNote(activeNote) ? (
              <SubjectFileEditor
                subject={activeSubject!}
                markdown={activeNote.content}
                exams={exams}
                onChangeMarkdown={updateNote}
                onAddExam={addExam}
                onUpdateExam={updateExam}
                onDeleteExam={deleteExam}
              />
            ) : activeNote && editorMode === "rich" ? (
              <>
                <MilkdownEditor
                  ref={milkdownRef}
                  key={activeNote.id}
                  value={activeNote.content}
                  onChange={updateNote}
                  theme={theme}
                  onOpenWikiLink={openWikiLink}
                  onOpenMoodleLink={openLinkedMoodleFile}
                  onLinkPickerKeyDown={handleLinkPickerKeyDown}
                  onLinkTrigger={(trigger) => {
                    if (!trigger) {
                      setLinkPicker((prev) => ({ ...prev, open: false }));
                      return;
                    }
                    const pickerWidth = 420;
                    const x = Math.min(Math.max(trigger.rect.left, 10), Math.max(window.innerWidth - pickerWidth - 10, 10));
                    const y = Math.min(Math.max(trigger.rect.bottom + 6, 10), Math.max(window.innerHeight - 330, 10));
                    setLinkPicker({ open: true, type: trigger.type, mode: "rich", query: trigger.query, start: 0, end: 0, x, y });
                  }}
                />
                {linkPicker.mode === "rich" && linkPickerNode}
              </>
            ) : activeNote && editorMode === "source" ? (
              <div className="k-source-wrap" ref={sourceWrapRef}>
                <textarea
                  ref={sourceTextareaRef}
                  key={`src-${activeNote.id}`}
                  className="textarea"
                  style={{ flex: 1, borderRadius: 0, border: 0, fontFamily: "var(--font-ui)", lineHeight: 1.7, padding: 18, width: "100%", resize: "none", overflowY: "auto", minHeight: 0 }}
                  value={activeNote.content}
                  onChange={handleSourceChange}
                  onKeyDown={(e) => {
                    handleLinkPickerKeyDown(e);
                  }}
                  onClick={(e) => detectLinkTrigger(e.currentTarget.value, e.currentTarget.selectionStart)}
                  onKeyUp={(e) => detectLinkTrigger(e.currentTarget.value, e.currentTarget.selectionStart)}
                  placeholder="Write markdown here..."
                />
                {linkPicker.mode === "source" && linkPickerNode}
              </div>
            ) : (
              <div className="empty" style={{ flex: 1, border: 0, background: "transparent", display: "flex", flexDirection: "column", gap: 12 }}>
                <StickyNote size={40} strokeWidth={1.2} style={{ color: "var(--muted)" }} />
                <strong style={{ color: "var(--text)" }}>Select a note to start writing</strong>
                <p className="muted" style={{ maxWidth: 320 }}>
                  Create a new note from the sidebar, or pick an existing one to edit.
                </p>
                <button className="btn btn-primary" onClick={() => handleCreateNote(activeFolderId)}>
                  <Plus size={14} /> New note
                </button>
              </div>
            )}
          </div>
          {activeNote && syncStatus && (
            <div className="k-meta">
              <span className="muted sync-status">{syncStatus}</span>
            </div>
          )}
        </div>

        {/* AI toggle arrow */}
        {activeNote && (
          <button
            className="k-ai-toggle"
            onClick={() => aiOpen ? setAiOpen(false) : openNoteAI()}
            title={aiOpen ? "Close AI chat" : "Ask AI"}
          >
            {aiOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!aiOpen && <Bot size={14} />}
          </button>
        )}

        {aiOpen && (
          <div className="k-ai-panel">
            <div className="k-ai-head">
              <div className="row" style={{ gap: 8 }}><Bot size={14} /><span>Chat: {activeNote?.title}</span></div>
              <button className="k-icon-button small" onClick={() => setAiOpen(false)} title="Close AI"><X size={14} /></button>
            </div>
            <ChatPanel
              compact conversation={noteConv} conversations={conversations}
              onSend={sendNoteChat}
              loading={loadingConversationId !== null && activeConversationId === loadingConversationId}
              aiSettings={aiSettings} setAISettings={setAISettings}
              setConversationModel={setConversationModel}
              activeConversationId={activeConversationId} setActiveConversationId={setActiveConversationId}
              createConversation={() => { const id = createConversation(); renameConversation(id, `Chat: ${activeNote?.title ?? "Note"}`); const nfId = ensureNotesChatFolder(); moveConversationToFolder(id, nfId); return id; }}
              deleteConversation={deleteConversation} renameConversation={renameConversation}
              placeholder={`Ask about ${activeNote?.title ?? "this note"}…`}
              userProfile={userProfile}
              subjects={subjects}
            />
          </div>
        )}
      </div>
    </div>
  );
}
