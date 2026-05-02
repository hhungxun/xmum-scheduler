import { useMemo, useState, useRef } from "react";
import {
  Bot, Eye, FileCode, FileText, Folder, FolderPlus, Link2,
  PanelLeftClose, PanelLeftOpen, Plus, Trash2, X,
} from "lucide-react";
import type { Subject, Note, Theme, Conversation, AISettings, UserProfile } from "../types";
import { MilkdownEditor } from "../MilkdownEditor";
import { ChatPanel } from "../components/ChatPanel";
import { backlinks, ALL_NOTES_FOLDER, UNFILED_FOLDER } from "../lib/utils";
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

export function KnowledgePage({
  subjects, activeSubject, activeNote, activeSubjectId, setActiveSubjectId, setActiveNoteId,
  activeFolderId, setActiveFolderId, createNote, createFolder, deleteFolder, moveNote,
  deleteNote, updateNote, renameNote, saveCourseInfo, deleteSubject, syncStatus, theme,
  conversation, conversations, sendChat, loadingConversationId,
  aiSettings, setAISettings, activeConversationId, setActiveConversationId,
  createConversation, deleteConversation, renameConversation,
  userProfile,
}: {
  subjects: Subject[]; activeSubject?: Subject; activeNote?: Note;
  activeSubjectId: string; setActiveSubjectId: (id: string) => void;
  setActiveNoteId: (id: string) => void; activeFolderId: string;
  setActiveFolderId: (id: string) => void; createNote: (folderId?: string) => void;
  createFolder: () => void; deleteFolder: (id: string) => void;
  moveNote: (noteId: string, folderId: string) => void; deleteNote: (noteId?: string) => void;
  updateNote: (content: string) => void; renameNote: (title: string) => void;
  saveCourseInfo: (info: string) => void; deleteSubject: (id: string) => void;
  syncStatus: string; theme: Theme;
  conversation: Conversation | null; conversations: Record<string, Conversation>;
  sendChat: (text: string, displayText?: string, fileIds?: string[]) => void;
  loadingConversationId: string | null; aiSettings: AISettings;
  setAISettings: (v: AISettings) => void; activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createConversation: (firstUserText?: string) => string;
  deleteConversation: (id: string) => void; renameConversation: (id: string, title: string) => void;
  userProfile?: UserProfile;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [editorMode, setEditorMode] = useState<"rich" | "source" | "preview">("rich");
  const [showCourseInfo, setShowCourseInfo] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // per-note conversation: find the one whose title matches the note
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

  if (!subjects.length) {
    return <div className="card"><div className="empty">
      <strong style={{ display: "block", color: "var(--text)", marginBottom: 6 }}>No subjects yet</strong>
      Import a timetable in <em>Settings</em>, or pick subjects from <em>Moodle</em>.
    </div></div>;
  }

  const linked = activeNote ? backlinks(activeNote.content) : [];
  const folders = activeSubject?.folders ?? [];
  const visibleNotes = activeSubject?.notes.filter((note) => {
    if (activeFolderId === ALL_NOTES_FOLDER) return true;
    if (activeFolderId === UNFILED_FOLDER) return !note.folderId;
    return note.folderId === activeFolderId;
  }) ?? [];

  function chooseFolder(folderId: string) {
    if (!activeSubject) return;
    setActiveFolderId(folderId);
    const n = activeSubject.notes.find((note) => {
      if (folderId === ALL_NOTES_FOLDER) return true;
      if (folderId === UNFILED_FOLDER) return !note.folderId;
      return note.folderId === folderId;
    });
    if (n) setActiveNoteId(n.id);
  }

  function openSearchResult(subject: Subject, note: Note) {
    setActiveSubjectId(subject.id); setActiveFolderId(note.folderId ?? UNFILED_FOLDER); setActiveNoteId(note.id);
  }

  function openNoteAI() {
    if (!activeNote) return;
    if (noteConv) {
      setActiveConversationId(noteConv.id);
    } else {
      const id = createConversation();
      renameConversation(id, `Chat: ${activeNote.title}`);
      setActiveConversationId(id);
    }
    setAiOpen(true);
  }

  function sendNoteChat(text: string, displayText?: string, fileIds?: string[]) {
    const ctx = activeNote
      ? `Note context (hidden from user):\nTitle: ${activeNote.title}\nContent:\n${activeNote.content.slice(0, 3000)}`
      : "";
    sendChat(`${ctx}\n\nUser message: ${text}`, displayText ?? text, fileIds);
  }

  const sideWidth = sideCollapsed ? 44 : 240;

  return (
    <div className="knowledge-shell" style={{ gridTemplateColumns: `${sideWidth}px minmax(0, 1fr)` }}>
      <div className="k-side" style={{ width: sideWidth, transition: "width 0.2s ease" }}>
        <div className="k-side-section" style={{ padding: sideCollapsed ? "14px 8px 6px" : undefined }}>
          {!sideCollapsed && <span>Subjects</span>}
          <button className="btn btn-ghost" style={{ height: 24, padding: "0 4px", marginLeft: "auto" }}
            onClick={() => setSideCollapsed(!sideCollapsed)}
            title={sideCollapsed ? "Expand" : "Collapse"}>
            {sideCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>
        <div className="k-list">
          {subjects.map((s) => (
            <button key={s.id} className={`k-item ${s.id === activeSubjectId ? "active" : ""}`}
              onClick={() => { setActiveSubjectId(s.id); setActiveNoteId(s.notes[0]?.id ?? ""); setActiveFolderId(ALL_NOTES_FOLDER); }}>
              <span className="swatch" style={{ background: s.color }} />
              {!sideCollapsed && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong>{s.code}</strong><span className="muted" style={{ marginLeft: 6, fontSize: "0.78rem" }}>{s.name}</span>
              </span>}
            </button>
          ))}
        </div>
        {activeSubject && !sideCollapsed && (<>
          <div className="k-search">
            <input className="input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes…" />
            {searchQuery.trim() && (<div className="search-results">
              {searchResults.map(({ subject, note }) => (
                <button key={`${subject.id}-${note.id}`} className="search-result" onClick={() => openSearchResult(subject, note)}>
                  <strong>{note.title}</strong><small>{subject.code}</small>
                </button>
              ))}
              {!searchResults.length && <div className="empty compact">No matches</div>}
            </div>)}
          </div>
          <div className="k-side-section"><span>Folders</span>
            <button className="btn btn-ghost" style={{ height: 26, padding: "0 8px" }} onClick={createFolder}><FolderPlus size={12} /></button>
          </div>
          <div className="k-list">
            <button className={`k-item ${activeFolderId === ALL_NOTES_FOLDER ? "active" : ""}`} onClick={() => chooseFolder(ALL_NOTES_FOLDER)}>
              <Folder size={14} /><span style={{ flex: 1 }}>All notes</span><span className="tag">{activeSubject.notes.length}</span>
            </button>
            <button className={`k-item ${activeFolderId === UNFILED_FOLDER ? "active" : ""}`} onClick={() => chooseFolder(UNFILED_FOLDER)}>
              <Folder size={14} /><span style={{ flex: 1 }}>Unfiled</span><span className="tag">{activeSubject.notes.filter((n) => !n.folderId).length}</span>
            </button>
            {folders.map((f) => (
              <div key={f.id} className={`k-item folder-row ${activeFolderId === f.id ? "active" : ""}`}>
                <button className="folder-main" onClick={() => chooseFolder(f.id)}>
                  <Folder size={14} /><span>{f.name}</span><span className="tag">{activeSubject.notes.filter((n) => n.folderId === f.id).length}</span>
                </button>
                <button className="folder-delete" onClick={() => deleteFolder(f.id)}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <div className="k-side-section"><span>Notes</span>
            <button className="btn btn-ghost" style={{ height: 26, padding: "0 8px" }} onClick={() => createNote(activeFolderId)}><Plus size={12} /></button>
          </div>
          <div className="k-list">
            {visibleNotes.map((n) => (
              <button key={n.id} className={`k-item ${n.id === activeNote?.id ? "active" : ""}`} onClick={() => setActiveNoteId(n.id)}>
                <FileText size={14} /><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
              </button>
            ))}
            {!visibleNotes.length && <div className="empty compact">No notes in this folder</div>}
          </div>
        </>)}
      </div>

      <div className={`k-main ${!aiOpen ? "no-ai" : ""}`}>
        <div className="k-editor">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--line)", gap: 10, flexWrap: "wrap" }}>
            <input className="k-title-input" value={activeNote?.title ?? activeSubject?.name ?? ""}
              onChange={(e) => renameNote(e.target.value)} readOnly={!activeNote} />
            <div className="row">
              {activeNote && (<>
                <button className={`btn ${editorMode === "rich" ? "btn-primary" : ""}`} onClick={() => setEditorMode("rich")}><FileText size={14} /></button>
                <button className={`btn ${editorMode === "source" ? "btn-primary" : ""}`} onClick={() => setEditorMode("source")}><FileCode size={14} /></button>
                <button className={`btn ${editorMode === "preview" ? "btn-primary" : ""}`} onClick={() => setEditorMode("preview")}><Eye size={14} /></button>
              </>)}
              {activeSubject && (
                <button className={`btn ${showCourseInfo ? "btn-primary" : ""}`} onClick={() => { setShowCourseInfo(!showCourseInfo); if (aiOpen) setAiOpen(false); }}>
                  Info
                </button>
              )}
              {activeNote && (
                <select className="select note-folder-select" value={activeNote.folderId ?? ""} onChange={(e) => moveNote(activeNote.id, e.target.value)}>
                  <option value="">Unfiled</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
              {activeNote && <button className="btn btn-ghost btn-danger" onClick={() => deleteNote()}><Trash2 size={14} /></button>}
              {!activeNote && activeSubject && <button className="btn btn-ghost btn-danger" onClick={() => deleteSubject(activeSubject.id)}><Trash2 size={14} /></button>}
              {activeNote && (
                <button className={`btn ${aiOpen ? "btn-primary" : ""}`} onClick={() => { aiOpen ? setAiOpen(false) : openNoteAI(); }}>
                  <Bot size={14} /> Ask AI
                </button>
              )}
            </div>
          </div>
          <div className="k-editor-body">
            {showCourseInfo && activeSubject ? (
              <MilkdownEditor key={`info-${activeSubject.id}`} value={activeSubject.courseInfo} onChange={saveCourseInfo} theme={theme} />
            ) : activeNote && editorMode === "rich" ? (
              <MilkdownEditor key={activeNote.id} value={activeNote.content} onChange={updateNote} theme={theme} />
            ) : activeNote && editorMode === "source" ? (
              <textarea key={`src-${activeNote.id}`} className="textarea" style={{ flex: 1, borderRadius: 0, border: 0, fontFamily: "var(--font-ui)", lineHeight: 1.7, padding: 18 }}
                value={activeNote.content} onChange={(e) => updateNote(e.target.value)} placeholder="Write markdown here..." />
            ) : activeNote && editorMode === "preview" ? (
              <div ref={previewRef} key={`prev-${activeNote.id}`} style={{ flex: 1, overflowY: "auto", padding: 18, fontSize: "0.95rem", lineHeight: 1.7 }}>
                {renderMarkdownPreview(activeNote.content)}
              </div>
            ) : (
              <div className="empty" style={{ flex: 1 }}>Select a note to edit</div>
            )}
          </div>
          {activeNote && (
            <div className="k-meta">
              <Link2 size={12} /><span>Backlinks:</span>
              {linked.length ? linked.map((l) => <span className="k-pill" key={l}>[[{l}]]</span>) : <span className="muted">None</span>}
              {syncStatus && <span className="muted sync-status">{syncStatus}</span>}
            </div>
          )}
        </div>
        {aiOpen && (
          <div className="k-notes" style={{ borderLeft: "1px solid var(--line)" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="row" style={{ gap: 8 }}><Bot size={14} /><span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Chat: {activeNote?.title}</span></div>
              <button className="btn btn-ghost" style={{ height: 24, padding: "0 8px" }} onClick={() => setAiOpen(false)}><X size={14} /></button>
            </div>
            <ChatPanel
              compact conversation={noteConv} conversations={conversations}
              onSend={sendNoteChat}
              loading={loadingConversationId !== null && activeConversationId === loadingConversationId}
              aiSettings={aiSettings} setAISettings={setAISettings}
              activeConversationId={activeConversationId} setActiveConversationId={setActiveConversationId}
              createConversation={() => { const id = createConversation(); renameConversation(id, `Chat: ${activeNote?.title ?? "Note"}`); return id; }}
              deleteConversation={deleteConversation} renameConversation={renameConversation}
              placeholder={`Ask about ${activeNote?.title ?? "this note"}…`}
              userProfile={userProfile}
            />
          </div>
        )}
      </div>
    </div>
  );
}
