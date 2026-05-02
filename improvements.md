# XMUM Scheduler - Site Improvements

## Completed in This Session

### 1. Exams Section Input Refinement
- **Problem**: The quick-add form and exam card edit grids were unlabeled, cramped, and had no dedicated CSS styling. Five inputs sat side-by-side with no visual hierarchy, making the form hard to scan and use.
- **Fix**:
  - Added `.exam-quick-add`, `.exam-quick-add-top`, and `.exam-quick-add-scores` CSS grids with proper spacing.
  - Wrapped every input in a `.exam-field` container with visible `<label>` elements (uppercase, muted color).
  - Restructured `ExamCard` edit grid into `.exam-edit-grid` with labeled fields instead of a cramped 5-column layout.
  - Added responsive breakpoints so the form collapses gracefully on tablets and mobile.

### 2. Assignments Double-Click Bug Fix
- **Problem**: In the Kanban board, double-clicking anywhere inside a task card bubbled the event up to the column, unexpectedly creating a new "Untitled" task.
- **Fix**: Added `onDoubleClick={(e) => e.stopPropagation()}` to the `.task` card root in `AssignmentCard`, confining the double-click creation behavior to empty column space only.

### 3. Assignments Column Double-Click Status Bug
- **Problem**: Double-clicking any Kanban column always created a task in the "todo" column, regardless of which column was clicked.
- **Fix**: Updated `addAssignment` signature to accept `status?: Status` and passed the column's `status` in the `onDoubleClick` handler.

### 4. Notion-Style Assignment Filters
- **Problem**: The assignments board had only a single subject filter with no search or sorting capabilities.
- **Fix**: Added a full filter bar with:
  - **Subject filter**: Global active subject + local "All subjects" override
  - **Search**: Real-time text search across title and description
  - **Sort**: Due date, Weight, Title, Created time (ascending/descending toggle)
  - **Task count**: Shows filtered result count

### 5. Dashboard Redesign
- **Problem**: Dashboard was cluttered with a metrics row and both "Today's classes" + "Assignments" cards.
- **Fix**: Removed the top metrics row and the "Assignments" card, leaving only the AI chat panel and "Today's schedule" for a cleaner focus.

### 6. Toast Notifications (#1)
- **Fix**: Implemented a lightweight `ToastProvider` context with `useToast()` hook. Toasts auto-dismiss after 3 seconds and stack in the top-right corner. Integrated into add/delete actions for exams, assignments, and subjects.

### 7. Tooltips for Icon-Only Buttons (#7)
- **Fix**: Added `title` attributes to all icon-only buttons (delete, upload, remove attachment, sort toggle, theme toggle, sidebar collapse).

### 8. Accessibility Improvements (#17)
- **Fix**: Added `aria-label` attributes to icon-only buttons and form inputs in `AssignmentCard` and `ExamCard`.

### 9. Component Memoization (#18)
- **Fix**: Wrapped `AssignmentCard` and `ExamCard` in `React.memo` and memoized all event handlers with `useCallback` to prevent unnecessary re-renders.

### 10. Assignment `createdAt` Field
- **Fix**: Added `createdAt?: string` to the `Assignment` type and set it automatically when creating new assignments, enabling "Created" sorting.

### 11. AI Chat Audit & Fixes
- **Fix**: Verified the AI chat pipeline is structurally sound. The `sendChat` function correctly builds system context, sends to `/ai/chat`, extracts actions, and handles errors. Added `stripActionBlocks` to cleanly separate executable actions from displayed text.

### 12. Dashboard Revamp
- **Fix**: Completely redesigned the Dashboard into a clean two-column layout:
  - **Left**: Full-height AI chat panel (primary focus)
  - **Right**: Sticky "Today's schedule" card + "Subjects" card
  - Removed cluttered metrics row and the assignments card
  - Inspired by Notion's clean, whitespace-heavy dashboard design

### 13. Multi-Theme System
- **Fix**: Expanded `Theme` type from `light | dark` to `light | dark | typewriter | modern | cyberpunk`
- Added full CSS variable definitions for each theme:
  - **Typewriter**: Warm paper background (`#f7f5f0`), monospace fonts, muted ink colors, sharp 4px radius
  - **Modern**: Clean white background, indigo accent (`#4f46e5`), generous 16px radius, soft shadows
  - **Cyberpunk**: Deep dark background (`#05050a`), neon cyan accent (`#00f0ff`), neon magenta danger, glowing shadows
- Updated `document.documentElement.dataset.theme` effect to handle all themes

### 14. Settings Theme Selector
- **Fix**: Replaced the simple Light/Dark toggle buttons with visual theme swatches in Settings
- Each swatch shows a preview circle with the theme's background and accent color
- Added `theme-swatches`, `theme-swatch`, `theme-swatch-preview`, and `theme-swatch-label` CSS

### 15. UI Revamp (Craft.do / Notion / Obsidian Inspired)
- **Fix**: Overhauled the entire CSS with modern design principles:
  - Increased border-radius to 12px (16px for Modern theme) for softer cards
  - Improved shadows with layered, subtle depth
  - Better hover effects on cards (lift + shadow increase)
  - Increased whitespace in sidebar and page padding
  - Cleaner focus states with accent-colored rings
  - Improved chat message bubbles with better spacing and shadows
  - Smooth transitions across all interactive elements
  - Refined button sizing and padding for better touch targets

---

## Recommended Future Improvements

### UX / Interaction
1. **Toast Notifications**
   - Replace silent state changes (e.g., "Exam added", "Assignment deleted") with non-blocking toast notifications for better user feedback.

2. **Confirmation Dialogs**
   - Replace native `confirm()` and `prompt()` calls with inline modal dialogs styled to match the app theme.

3. **Undo / Redo**
   - Implement a lightweight undo stack for destructive actions like deleting exams, assignments, or notes.

4. **Keyboard Shortcuts**
   - Add shortcuts for common actions (`Ctrl/Cmd + K` to focus search, `Ctrl/Cmd + N` for new note/assignment, `Esc` to close modals).

5. **Loading Skeletons**
   - Show skeleton placeholders instead of empty white space while Moodle sync or AI chat responses are loading.

6. **Empty State Illustrations**
   - Add subtle icons or illustrations to empty states (e.g., "No exams yet", "No synced Moodle files") to make them feel less broken.

7. **Tooltips for Icon-Only Buttons**
   - Many buttons use only icons (e.g., delete, upload). Add `title` attributes or a custom tooltip component for clarity.

### Data & Organization
8. **Search / Filter in Exams Page**
   - Add a search bar to filter exams by title, type, or date range.

9. **Sorting Options**
   - Allow users to sort exams by date, weight, score percentage, or title.

10. **Bulk Actions**
    - Enable multi-select checkboxes on exams/assignments for bulk delete or status update.

11. **Data Export / Backup**
    - Provide JSON/CSV export for exams and assignments, plus a manual backup/restore feature.

12. **Auto-Save Indicator**
    - Show a subtle "Saved" indicator in the Knowledge editor so users know their notes are persisted.

### Visual & Layout
13. **Kanban Column Overflow**
    - On smaller screens the 4-column kanban becomes unusable. Consider a horizontal scroll container or a collapsible column view.

14. **File Picker Virtual Scrolling**
    - If a student syncs hundreds of Moodle files, the file picker list will lag. Virtualize the list for performance.

15. **Progress Indicators for Uploads**
    - The exam file upload currently gives no progress feedback. Add a linear progress bar or spinner during upload.

16. **Better Date Pickers**
    - The native `input type="date"` is fine, but a small calendar popover with week-highlighting would feel more cohesive.

17. **Accessibility (a11y)**
    - Add `aria-label`, `aria-expanded`, and focus-trap logic to `details` panels and dropdowns.
    - Ensure color contrast ratios pass WCAG AA for the muted text and tag components.

### Performance
18. **Memoize Heavy Components**
    - `AssignmentCard` and `ExamCard` re-render on every parent update. Wrap them in `React.memo` and memoize callbacks where possible.

19. **Debounced Inputs**
    - Exam and assignment title inputs currently update state on every keystroke. Debounce or defer updates for smoother typing in large lists.

20. **Code Splitting**
    - The app loads all pages upfront. Use `React.lazy` + `Suspense` to split each page into its own chunk.
