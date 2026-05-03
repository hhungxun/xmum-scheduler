# XMUM Scheduler

A native desktop application for XMUM students to manage their academic calendar, course materials, assignments, exams, and knowledge base with AI-powered assistance.

## Features

- **Academic Calendar** — Semester-aware scheduling with week labels and event tracking
- **Knowledge Base** — Local-first note-taking with Markdown support, folders, and wikilinks
- **Moodle Sync** — Automatically download course files from XMUM Moodle
- **Assignment & Exam Tracker** — Track deadlines, weights, and grades
- **AI Chat Assistant** — Pluggable AI support (OpenAI, Anthropic, Claude Code, Codex CLI, Opencode)
- **Timetable Import** — Parse XMUM HTML timetables into recurring calendar events
- **Cross-Platform** — Native apps for Linux, macOS, and Windows

## Installation

Download the latest release for your platform from the [Releases](https://github.com/YOUR_USERNAME/xmum-scheduler/releases) page.

### Linux

- **AppImage**: Download `.AppImage`, make it executable (`chmod +x XMUM_Scheduler_*.AppImage`), and run it.
- **deb**: Download `.deb` and install with `sudo dpkg -i xmum-scheduler_*.deb`.
- **rpm**: Download `.rpm` and install with `sudo rpm -i xmum-scheduler-*.rpm`.

### macOS

Download `.dmg`, open it, and drag **XMUM Scheduler** to your Applications folder.

### Windows

Download `.msi` or `.exe` installer and run it.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://v2.tauri.app/reference/cli/)

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/xmum-scheduler.git
cd xmum-scheduler

# Install frontend dependencies
npm install

# Install Tauri CLI (if not already installed)
cargo install tauri-cli --locked
```

### Run in Development Mode

```bash
# Start the Tauri dev server (frontend + Rust backend with hot reload)
npm run tauri:dev
```

### Build for Production

```bash
# Build for the current platform
npm run tauri:build

# Build for specific platforms (requires appropriate targets/toolchains)
npm run tauri:build:linux
npm run tauri:build:macos
npm run tauri:build:windows
```

Build artifacts will be in `src-tauri/target/release/bundle/`.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Desktop Shell**: Tauri 2 + Rust
- **Styling**: Custom CSS
- **Rich Text Editor**: Milkdown
- **Calendar**: Toast UI Calendar
- **AI Integration**: OpenAI, Anthropic, CLI adapters

## Data Storage

All user data is stored locally on your device:

- **App state**: Browser `localStorage` (managed by the frontend)
- **Knowledge base notes**: `{data_dir}/xmum-scheduler/knowledge/`
- **Moodle files**: `{data_dir}/xmum-scheduler/moodle/`
- **Uploads**: `{data_dir}/xmum-scheduler/uploads/`

On Linux: `~/.local/share/xmum-scheduler/`  
On macOS: `~/Library/Application Support/xmum-scheduler/`  
On Windows: `%APPDATA%\xmum-scheduler\`

## License

MIT
