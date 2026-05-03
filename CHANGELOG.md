# Changelog

## [1.0.0] — 2026-05-03

### Major Changes

- **Native Desktop Application**: The app has been completely refactored from a browser-based local server application into a full native desktop application using **Tauri 2**.
- **No More Browser Required**: The app now launches as a standalone desktop application. Users no longer need to start a server manually or open a browser.
- **Cross-Platform Builds**: Added automated build configuration for Linux (AppImage, deb, rpm), macOS (dmg, app bundle), and Windows (msi, exe).

### Technical Migration

- Replaced the Node.js HTTP server (`server.mjs`) with Rust Tauri commands for all backend functionality.
- Replaced `fetch`-based API calls with Tauri `invoke` for seamless frontend-backend communication.
- Embedded the backend services (Moodle sync, knowledge sync, AI chat, file management) directly into the native app.
- Updated Vite configuration for Tauri integration.
- Added proper desktop app metadata: app name, icon, version, window title, and application menu.

### Features Preserved

All existing functionality from the browser version has been preserved:

- Academic calendar with semester-aware scheduling
- Knowledge base with Markdown notes, folders, and course info
- Moodle login, course catalog, and file synchronization
- Assignment and exam tracking
- AI chat with OpenAI, Anthropic, Claude Code, Codex CLI, and Opencode providers
- Timetable HTML import
- Local file uploads and management

### Data Compatibility

- Existing user data stored in browser `localStorage` will continue to work (the frontend storage mechanism is unchanged).
- Knowledge base notes, Moodle downloads, and uploads are now stored in the OS-standard application data directory.

## [1.0.0-alpha.1] — Previous Release

- Initial browser-based local server application.
- React + Vite frontend with custom Node.js backend.
- Required manual server startup and browser access.
