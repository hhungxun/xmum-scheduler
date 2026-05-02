# Student Scheduler + Knowledge Management App — Implementation Plan

## Context

Cross-platform desktop app (Windows / Mac / Linux) for university students. Combines a semester-aware calendar with a local-first knowledge management system. Moodle sync brings course files in automatically. Pluggable AI chat adds intelligence on top of notes. Built for solo-to-small-team development with TypeScript frontend skills.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Desktop shell | **Tauri 2** + Rust | ~10–20 MB binary vs Electron's ~150 MB; native OS APIs; memory-safe backend |
| Frontend | **React 19** + TypeScript + Vite 6 | Mature ecosystem, fast HMR, first-class Tauri support |
| State | **Zustand 5** + **TanStack Query 5** | Zustand for UI/local state; TQ for async command cache + invalidation |
| Database | **SQLite** via `tauri-plugin-sql` (rusqlite) | Local, relational, offline-first |
| File I/O | Rust commands + `tauri-plugin-fs` | Sandboxed, secure, cross-platform paths |
| Markdown editor | **CodeMirror 6** | Extensible; supports custom syntax trees, widget decorations for LaTeX |
| LaTeX | **KaTeX** (npm) | Pure JS, no server, fast render |
| Note linking | Custom CM6 extension + SQL backlink index | Full control over `[[wikilink]]` tokenizer + hover preview |
| Styling | **Tailwind CSS 4** + **shadcn/ui** (Radix primitives) | Accessible components, Tailwind-compatible |
| Calendar UI | **FullCalendar 6** (React adapter) | Free tier sufficient; rrule plugin handles recurrence display |
| HTTP (Moodle) | `reqwest` crate (Rust) | Async, TLS, streaming downloads |
| Notifications | `tauri-plugin-notification` | Native OS notifications on all 3 platforms |
| Keychain | `tauri-plugin-keystore` | Secure credential storage for Moodle token + AI keys |
| Icons | **Lucide React** | Tree-shakeable, consistent |
| Command palette | **cmdk** | Fast fuzzy command palette |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Calendar │  │Knowledge │  │   AI Chat Panel   │  │
│  │  Module  │  │  Module  │  │                   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│         Zustand Store  +  TanStack Query              │
│              Tauri invoke() / listen()                │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (JSON)
┌──────────────────────▼──────────────────────────────┐
│               Rust Backend (src-tauri)               │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ DB Layer │  │ Moodle Sync  │  │  AI Adapter   │  │
│  │(rusqlite)│  │ (tokio task) │  │  (streaming)  │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────────┐                      │
│  │File Cmds │  │ Notif Sched  │                      │
│  └──────────┘  └──────────────┘                      │
└─────────────────────────────────────────────────────┘
         │                     │
   ┌─────▼──────┐     ┌────────▼─────────┐
   │ SQLite DB  │     │ Local Filesystem  │
   │ (metadata) │     │ {sem}/{subj}/     │
   └────────────┘     └──────────────────┘
```

**Write flow**: User action → optimistic Zustand update → `invoke('cmd', payload)` → Rust validates + writes SQLite → emits Tauri event → TQ invalidates cache → re-render.

**Background**: Rust `tokio::spawn` tasks handle Moodle polling + notification scheduling independently of the UI thread.

---

## Project Directory Structure

```
xmum-scheduler/
├── src/
│   ├── modules/
│   │   ├── calendar/
│   │   │   ├── CalendarView.tsx
│   │   │   ├── EventModal.tsx
│   │   │   ├── SemesterSetup.tsx
│   │   │   ├── TimetableImport.tsx
│   │   │   └── hooks/  (useEvents.ts, useSemester.ts)
│   │   ├── knowledge/
│   │   │   ├── SubjectSidebar.tsx
│   │   │   ├── NoteEditor.tsx
│   │   │   ├── BacklinksPanel.tsx
│   │   │   ├── AssignmentTracker.tsx
│   │   │   ├── CourseInfoPanel.tsx
│   │   │   ├── MoodlePanel.tsx
│   │   │   └── hooks/  (useNotes.ts, useAssignments.ts, useMoodle.ts)
│   │   └── ai/
│   │       ├── AIChatPanel.tsx
│   │       ├── AIProviderSettings.tsx
│   │       └── hooks/useAI.ts
│   ├── components/ui/         # shadcn/ui generated
│   ├── store/                 # Zustand slices
│   ├── lib/
│   │   ├── tauri.ts           # typed invoke wrappers
│   │   ├── editor/
│   │   │   ├── extensions.ts  # assembles all CM6 extensions
│   │   │   ├── wikiLinks.ts   # [[link]] tokenizer + hover
│   │   │   └── latexWidget.ts # KaTeX widget decoration
│   │   └── queryClient.ts
│   └── types/  (db.ts, moodle.ts)
│
├── src-tauri/src/
│   ├── commands/
│   │   ├── calendar.rs        # event/semester CRUD
│   │   ├── knowledge.rs       # note/subject/assignment CRUD
│   │   ├── moodle.rs          # auth + manual sync trigger
│   │   ├── ai.rs              # streaming chat proxy
│   │   ├── files.rs           # fs read/write/watch
│   │   └── timetable.rs       # HTML parse (scraper crate)
│   ├── services/
│   │   ├── notification.rs    # tokio notification scheduler
│   │   ├── moodle_sync.rs     # background poll task
│   │   └── ai_adapter.rs      # trait + provider impls
│   ├── db/
│   │   ├── migrations.rs      # embedded SQL migrations
│   │   └── connection.rs      # connection pool
│   └── models/  (event.rs, semester.rs, subject.rs, note.rs, assignment.rs)
│
└── data/                      # user data root (resolved via app_data_dir())
    └── {semester}/
        └── {subject}/
            ├── notes/          # .md files
            └── files/          # Moodle downloads
```

---

## Module Specs

### Calendar Module

**IPC commands**:
```
get_semesters() -> Vec<Semester>
create_semester(payload) -> Semester
get_events(semester_id, start, end) -> Vec<Event>
create_event(payload) -> Event
update_event(id, payload) -> Event
delete_event(id)
import_timetable(html_content, semester_id) -> Vec<ParsedClass>  // preview
confirm_timetable_import(semester_id, classes) -> Vec<Event>
```

**Notification scheduler**: On every event write, Rust rebuilds a sorted min-heap of `(fire_at, event_id)`. A dedicated `tokio` task sleeps until the next entry fires, then calls `tauri_plugin_notification::notify()`.

**Week labels**: `week_labels` table stores `(semester_id, week_number, label, color_hex)`. CalendarView reads these and applies background color to each week row in FullCalendar.

---

### Knowledge Module

**Note storage**: Body stored as `.md` file on disk (Obsidian-compatible). SQLite stores only metadata (`id`, `title`, `subject_id`, `file_path`, `word_count`, timestamps) + backlink index. Notes survive DB corruption.

**Backlink indexing**: On every `save_note`, Rust:
1. Deletes all `backlinks` rows for `source_note_id`.
2. Regex-scans content for `\[\[([^\]]+)\]\]`.
3. Re-inserts one row per found link.

Query: `SELECT * FROM backlinks WHERE target_note_title = ?` → join notes for sidebar display.

**IPC commands**:
```
get_subjects(semester_id) -> Vec<Subject>
create_subject(payload) -> Subject
get_notes(subject_id) -> Vec<NoteMetadata>
get_note_content(note_id) -> String
save_note(note_id, content)
get_backlinks(note_title) -> Vec<NoteRef>
get_assignments(subject_id) -> Vec<Assignment>
create_assignment(payload) -> Assignment
update_assignment(id, payload) -> Assignment
```

---

### Timetable HTML Parser

Uses Rust `scraper` crate (CSS selector engine over html5ever). Runs in backend to keep DOM work off UI thread.

**Algorithm**:
1. Find main timetable `<table>` (largest or `[class*="timetable"]`).
2. Extract day headers from `<th>` row → map column index → `day_of_week` (Mon=1 … Sat=6).
3. For each `<td>`: extract `rowspan` for duration; parse subject code, section, venue.
4. Map row index → start time (first row = 0800, each row = 30 min, or parse time text from header).
5. Return `Vec<ParsedClass>` to frontend for preview.
6. On confirm: insert `Event` + `RecurrenceRule(WEEKLY, until=semester_end)` per class.

Handle `rowspan` cells (back-to-back sessions). Split subject codes like `CSC2103-01` at `-`. Fallback: if parse fails, emit `timetable:parse_error` and open manual entry form pre-filled with what was extracted.

---

### Moodle Sync

**Auth**: `POST /login/token.php?username=&password=&service=moodle_mobile_app` → token stored in OS keychain. Refresh on 401.

**Sync loop** (default 30 min interval, `tokio::time::interval`):
1. `core_enrol_get_users_courses` → enrolled courses.
2. `core_course_get_contents` per course → file list.
3. Compare `timemodified` vs `moodle_files.timemodified` in SQLite.
4. Download only new/changed files via `reqwest` streaming → write to `{sem}/{subj}/files/`.
5. Write to `moodle_sync_log`.
6. Emit `moodle:file_downloaded` and `moodle:sync_complete` events → frontend updates badge.

User manually maps Moodle course names to app subjects (fuzzy-match suggestions in UI).

---

### AI Adapter

**Trait + impls** in `ai_adapter.rs`:
```rust
trait AIProvider: Send + Sync {
    async fn chat_stream(&self, messages: Vec<ChatMessage>, tx: Channel<String>) -> Result<()>;
}
// Impls: AnthropicProvider, OpenAIProvider, CLIProvider
```

`CLIProvider` spawns subprocess (`claude -p "..."`, `codex`, `opencode`), streams stdout line-by-line. API providers use `reqwest` SSE. Tauri `Channel` forwards chunks to React frontend as they arrive.

**Provider detection order**: Stored Anthropic key → stored OpenAI key → probe PATH for `claude`/`codex`/`opencode` → show "configure provider" prompt.

**Context injection**: Current note content (truncated ~8k tokens) + subject course info + upcoming deadlines prepended as system message.

---

## SQLite Schema (Core Tables)

```sql
-- Semester & Calendar
CREATE TABLE semesters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,       -- "202601"
    start_date TEXT NOT NULL,        -- ISO 8601
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE week_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    label TEXT NOT NULL,             -- "Study Week" | "Exam Week" | "Break"
    color_hex TEXT NOT NULL DEFAULT '#94a3b8'
);

CREATE TABLE recurrence_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frequency TEXT NOT NULL,         -- 'WEEKLY' | 'DAILY' | 'MONTHLY'
    interval_ INTEGER NOT NULL DEFAULT 1,
    days_of_week TEXT,               -- JSON: [1,3,5]
    until_date TEXT,
    count INTEGER
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semester_id INTEGER REFERENCES semesters(id) ON DELETE SET NULL,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL DEFAULT 'custom',  -- 'class'|'exam'|'assignment'|'custom'
    start_datetime TEXT NOT NULL,
    end_datetime TEXT NOT NULL,
    location TEXT,
    color_hex TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_rule_id INTEGER REFERENCES recurrence_rules(id) ON DELETE SET NULL,
    notify_before_mins INTEGER NOT NULL DEFAULT 15,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Knowledge Base
CREATE TABLE subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    code TEXT NOT NULL,              -- "CSC2103"
    name TEXT NOT NULL,
    section TEXT,
    lecturer_name TEXT,
    credit_hours INTEGER,
    color_hex TEXT NOT NULL DEFAULT '#6366f1',
    folder_path TEXT NOT NULL,       -- absolute path on disk
    grading_scheme TEXT,             -- JSON: {"assignments":30,"midterm":30,"final":40}
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,  -- absolute path to .md file on disk
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE backlinks (
    source_note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_note_title TEXT NOT NULL,
    PRIMARY KEY (source_note_id, target_note_title)
);
CREATE INDEX idx_backlinks_target ON backlinks(target_note_title);

CREATE TABLE assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_datetime TEXT,
    weight_percent REAL,
    status TEXT NOT NULL DEFAULT 'todo',  -- 'todo'|'in_progress'|'submitted'|'graded'
    grade_received REAL,
    is_project INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assignment_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Moodle
CREATE TABLE moodle_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    base_url TEXT NOT NULL,
    username TEXT NOT NULL,          -- token stored in OS keychain keyed by id
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE moodle_course_mappings (
    moodle_course_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    moodle_course_name TEXT,
    PRIMARY KEY (moodle_course_id, subject_id)
);

CREATE TABLE moodle_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    fileurl TEXT NOT NULL UNIQUE,
    local_path TEXT,
    timemodified INTEGER NOT NULL,
    file_size INTEGER,
    downloaded_at TEXT
);

CREATE TABLE moodle_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    files_found INTEGER NOT NULL DEFAULT 0,
    files_downloaded INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

-- AI
CREATE TABLE ai_chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
    title TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,              -- 'user'|'assistant'|'system'
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- Keys: data_root, theme, default_notify_mins, ai_provider,
--       moodle_poll_interval_mins, active_semester_id
```

---

## Key Dependencies

### Rust (`Cargo.toml`)
```toml
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-fs = "2"
tauri-plugin-notification = "2"
tauri-plugin-keystore = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["stream", "json", "cookies"] }
scraper = "0.21"
regex = "1"
chrono = { version = "0.4", features = ["serde"] }
rusqlite = { version = "0.31", features = ["bundled"] }
```

### Frontend (`package.json`)
```json
"@tauri-apps/api": "^2",
"react": "^19", "react-dom": "^19",
"zustand": "^5",
"@tanstack/react-query": "^5",
"@fullcalendar/react": "^6",
"@fullcalendar/daygrid": "^6",
"@fullcalendar/timegrid": "^6",
"@fullcalendar/rrule": "^6",
"@codemirror/view": "^6",
"@codemirror/state": "^6",
"@codemirror/lang-markdown": "^6",
"katex": "^0.16",
"react-markdown": "^9",
"tailwindcss": "^4",
"cmdk": "^1",
"lucide-react": "^0.400"
```

---

## Implementation Phases

### Phase 1 — Foundation + Calendar MVP (Weeks 1–3)
1. `cargo create-tauri-app` (React + TS + Vite template)
2. Tailwind + shadcn/ui + Zustand + TQ setup
3. SQLite connection + migration runner in Rust
4. `Semester` CRUD + SemesterSetup UI
5. `Event` CRUD commands
6. FullCalendar integration + `get_events` wired
7. `EventModal` (create / edit / delete)
8. Weekly recurrence expansion on read
9. Notification scheduler (basic: fire on app launch for upcoming events)
10. Week label background coloring on calendar

**Milestone**: Create semester, add events, see calendar, receive OS notifications.

---

### Phase 2 — Timetable Import (Week 4)
1. `import_timetable` Rust command (`scraper` crate)
2. `TimetableImport.tsx` — file drop zone, parse preview table, confirm/cancel
3. Handle XMUM HTML structure (rowspan, subject code splitting)
4. Map slots → `Event` + `RecurrenceRule(WEEKLY, until=sem_end)`
5. Edge cases: public holidays, mid-semester schedule shifts

**Milestone**: Drop HTML file → preview parsed classes → confirm → appear on calendar as recurring events.

---

### Phase 3 — Knowledge Base Core (Weeks 5–7)
1. `Subject` CRUD + `SubjectSidebar.tsx`
2. Filesystem commands (`create_subject_folder`, `save_note`, `get_note_content`)
3. CodeMirror 6 editor with:
   - Markdown syntax highlighting
   - KaTeX widget decoration for `$...$` / `$$...$$` (source shown on cursor focus)
   - `[[wikilink]]` tokenizer + hover tooltip + click handler
4. Debounced note save (500 ms)
5. Backlink indexer in Rust (regex scan on save → update `backlinks` table)
6. `BacklinksPanel.tsx`
7. `AssignmentTracker.tsx` (kanban: To Do / In Progress / Done / Graded)
8. `CourseInfoPanel.tsx` (editable grading scheme, lecturer)
9. Link assignments → calendar events (foreign key + calendar badge)

**Milestone**: Full note-taking, assignment tracking, backlinks, course info per subject.

---

### Phase 4 — Moodle Integration (Weeks 8–9)
1. Moodle auth command + credential storage (`tauri-plugin-keystore`)
2. Course content fetcher in Rust
3. Streaming file downloader with progress events
4. `moodle_sync` background tokio task (30 min interval)
5. `MoodlePanel.tsx` — connect form, sync status, file list, manual trigger
6. Course-to-subject mapping UI (fuzzy-match suggestions)
7. New file badge on subject in sidebar

**Milestone**: Connect Moodle → files auto-appear in subject folders.

---

### Phase 5 — AI Integration (Week 10)
1. `ai_adapter.rs` — `AnthropicProvider`, `OpenAIProvider`, `CLIProvider` impls
2. Tauri `Channel`-based streaming command
3. `AIChatPanel.tsx` with streaming message display
4. `AIProviderSettings.tsx`
5. Context injection (current note + subject info + upcoming deadlines as system message)
6. "Ask AI about this note" toolbar button in editor

**Milestone**: AI chat working with ≥1 provider, context-aware.

---

### Phase 6 — Polish + Distribution (Weeks 11–12)
1. Full dark / light / system theme
2. Command palette (`cmdk`) with keyboard shortcuts
3. Virtual scroll for large note lists; lazy-load calendar months
4. Error boundaries + user-friendly error messages
5. GitHub Actions CI: lint, typecheck, `cargo test`, Tauri build matrix (Win/Mac/Linux)
6. Tauri updater setup
7. Code signing config for Windows (`.exe`) and Mac (`.dmg`)

---

## Critical Files (by implementation order)

1. `src-tauri/src/db/migrations.rs` — entire schema embedded here; must be correct before anything else runs
2. `src-tauri/src/commands/calendar.rs` — core data layer all modules depend on
3. `src-tauri/src/commands/timetable.rs` — highest-complexity Rust file (scraper crate)
4. `src/lib/editor/extensions.ts` — assembles all CM6 extensions; most complex frontend file
5. `src-tauri/src/services/moodle_sync.rs` — requires careful deduplication + error handling
6. `src-tauri/src/services/ai_adapter.rs` — trait-based; add providers without touching commands layer

---

## Verification Plan

| Phase | Test |
|---|---|
| 1 | Create semester → add event → calendar shows it → OS notification fires at correct time |
| 2 | Drop real XMUM HTML file → verify parsed subject codes, times, days → confirm → check recurring events on calendar |
| 3 | Create note with `$E=mc^2$` → KaTeX renders inline. Add `[[note2]]` → backlinks appear in note2. Create assignment → badge appears on calendar date |
| 4 | Connect test Moodle instance → trigger sync → verify file appears in correct subject folder on disk and in UI |
| 5 | Open note → AI panel → ask question → streaming response appears with note context visible in first message |
| 6 | Build on all 3 OS targets via CI → app opens, no white screen, notifications work on each OS |
