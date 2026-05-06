import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ChevronDown, ChevronRight, ChevronUp, Folder, KeyRound, LogOut, RefreshCw, Trash2,
  Search, List, Columns, ArrowUpDown, X,
} from "lucide-react";
import type { MoodleState, Subject, MoodleFile, MoodleSyncedCourse } from "../types";
import { formatFileSize, moodleFileKey, localAssetHref } from "../lib/utils";
import { openMoodleFile } from "../lib/api";
import { Field } from "../components/Field";

export function MoodlePage({
  moodle, setMoodle, moodlePassword, setMoodlePassword, moodleLogin, moodleLogout,
  toggleMoodleCourse, applyMoodleSelection, syncMoodleFiles, subjects,
}: {
  moodle: MoodleState;
  setMoodle: (m: MoodleState) => void;
  moodlePassword: string;
  setMoodlePassword: (v: string) => void;
  moodleLogin: (e: React.FormEvent<HTMLFormElement>) => void;
  moodleLogout: () => void;
  toggleMoodleCourse: (id: number) => void;
  applyMoodleSelection: () => void;
  syncMoodleFiles: () => void;
  subjects: Subject[];
}) {
  const [pickerOpen, setPickerOpen] = useState(!moodle.selectedCourseIds.length && !moodle.files.length);
  const [searchQuery, setSearchQuery] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size" | "subject">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewCompact, setViewCompact] = useState(false);

  const filteredFiles = useMemo(() => {
    let list = moodle.files;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((f) => f.filename.toLowerCase().includes(q) || f.courseName.toLowerCase().includes(q) || (f.section ?? "").toLowerCase().includes(q));
    }
    if (fileTypeFilter !== "all") {
      list = list.filter((f) => {
        const ext = f.filename.split(".").pop()?.toLowerCase() ?? "";
        const isPdf = ext === "pdf";
        const isDoc = ["doc", "docx"].includes(ext);
        const isSheet = ["xls", "xlsx", "csv"].includes(ext);
        const isSlide = ["ppt", "pptx"].includes(ext);
        const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
        const isHtml = ["html", "htm", "xml"].includes(ext);
        switch (fileTypeFilter) {
          case "pdf": return isPdf;
          case "doc": return isDoc;
          case "sheet": return isSheet;
          case "slide": return isSlide;
          case "image": return isImage;
          case "html": return isHtml;
          case "other": return !isPdf && !isDoc && !isSheet && !isSlide && !isImage && !isHtml;
          default: return true;
        }
      });
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name": cmp = a.filename.localeCompare(b.filename); break;
        case "size": cmp = (a.filesize ?? 0) - (b.filesize ?? 0); break;
        case "date": cmp = (a.timemodified ?? 0) - (b.timemodified ?? 0); break;
        case "subject": cmp = a.courseName.localeCompare(b.courseName); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [moodle.files, searchQuery, fileTypeFilter, sortBy, sortDir]);

  // Filter the courses tree to only show courses with matching files
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim() && fileTypeFilter === "all") return moodle.courses;
    const matchingIds = new Set(filteredFiles.map((f) => f.courseId));
    return moodle.courses.filter((c) => matchingIds.has(c.id));
  }, [moodle.courses, filteredFiles, searchQuery, fileTypeFilter]);

  if (!moodle.connected) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Sign in to l.xmu.edu.my</h2>
          <KeyRound size={16} className="muted" />
        </div>
        <form className="grid" style={{ gap: 10 }} onSubmit={moodleLogin}>
          <Field label="Username">
            <input className="input" placeholder="Campus ID" value={moodle.username} onChange={(e) => setMoodle({ ...moodle, username: e.target.value })} />
          </Field>
          <Field label="Password">
            <input className="input" type="password" placeholder="Moodle password" value={moodlePassword} onChange={(e) => setMoodlePassword(e.target.value)} />
          </Field>
          <button className="btn btn-primary" disabled={moodle.loading}>
            {moodle.loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {moodle.error && <div className="alert warn">{moodle.error}</div>}
      </div>
    );
  }

  const selected = new Set(moodle.selectedCourseIds);
  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: "0.8rem" }}>Connected as {moodle.siteUser || moodle.username}</span>
          <div className="row">
            <button className="btn" onClick={() => setPickerOpen(!pickerOpen)}>
              {pickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Subjects
            </button>
            <button className="btn" onClick={applyMoodleSelection} disabled={!moodle.selectedCourseIds.length}>
              Link {moodle.selectedCourseIds.length || ""} as subjects
            </button>
            <button className="btn btn-primary" onClick={syncMoodleFiles} disabled={moodle.loading || !moodle.selectedCourseIds.length}>
              <RefreshCw size={14} /> {moodle.loading ? "Syncing…" : "Sync files"}
            </button>
            <button className="btn btn-ghost" onClick={moodleLogout} aria-label="Sign out"><LogOut size={14} /></button>
          </div>
        </div>

        {pickerOpen ? (
          <div className="course-list">
            {moodle.catalog.length === 0 && <div className="empty">No enrolled courses found.</div>}
            {moodle.catalog.map((c) => {
              const linkedSubject = subjects.find((s) => s.moodleCourseId === c.id);
              return (
                <label key={c.id} className="course-row checkbox" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleMoodleCourse(c.id)} />
                  <div>
                    <strong>{c.fullname}</strong>
                    <small>{c.shortname ?? `Course ${c.id}`}{linkedSubject ? ` · linked to ${linkedSubject.code}` : ""}</small>
                  </div>
                  <span className="tag">{c.id}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="selected-subjects">
            {moodle.selectedCourseIds.map((courseId) => {
              const course = moodle.catalog.find((c) => c.id === courseId);
              return course ? <span key={courseId} className="tag">{course.shortname ?? course.fullname}</span> : null;
            })}
            {!moodle.selectedCourseIds.length && <span className="muted">No selected subjects</span>}
          </div>
        )}

        {moodle.lastSync && <p className="muted" style={{ fontSize: "0.78rem", marginTop: 12 }}>Last sync: {moodle.lastSync}</p>}
        {moodle.error && <div className="alert warn">{moodle.error}</div>}
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>{filteredFiles.length} of {moodle.files.length} files</h2>
          <div className="row" style={{ gap: 4 }}>
            <button className={`btn ${!viewCompact ? "btn-primary" : ""}`} onClick={() => setViewCompact(false)} title="List view"><List size={14} /></button>
            <button className={`btn ${viewCompact ? "btn-primary" : ""}`} onClick={() => setViewCompact(true)} title="Compact view"><Columns size={14} /></button>
          </div>
        </div>

        {/* Search and filter bar */}
        <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <div className="row" style={{ position: "relative", flex: "1 1 200px" }}>
            <Search size={14} style={{ position: "absolute", left: 8, color: "var(--muted)", pointerEvents: "none" }} />
            <input className="input" style={{ paddingLeft: 28, width: "100%" }} placeholder="Search files…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button className="btn btn-ghost" style={{ position: "absolute", right: 2, padding: 4 }} onClick={() => setSearchQuery("")}><X size={12} /></button>}
          </div>
          <select className="select" value={fileTypeFilter} onChange={(e) => setFileTypeFilter(e.target.value)} style={{ fontSize: "0.82rem" }}>
            <option value="all">All types</option>
            <option value="pdf">PDF</option>
            <option value="doc">Documents</option>
            <option value="sheet">Spreadsheets</option>
            <option value="slide">Slides</option>
            <option value="image">Images</option>
            <option value="html">HTML</option>
            <option value="other">Other</option>
          </select>
          <div className="row" style={{ gap: 4 }}>
            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "date" | "size" | "subject")} style={{ fontSize: "0.82rem" }}>
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="size">Size</option>
              <option value="subject">Subject</option>
            </select>
            <button className="btn" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")} title={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`}>
              <ArrowUpDown size={13} />
            </button>
          </div>
        </div>

        {moodle.files.length ? (
          <div className="moodle-tree">
            {filteredCourses.map((course) => (
              <MoodleCourseTree key={course.id} course={course} compact={viewCompact} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>No Moodle files synced yet.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={syncMoodleFiles}>Sync Moodle files</button>
          </div>
        )}
        {moodle.files.length > 0 && filteredFiles.length === 0 && !moodle.loading && (
          <div className="empty">No files match your search.</div>
        )}
      </div>
    </div>
  );
}

function MoodleCourseTree({ course, compact }: { course: MoodleSyncedCourse; compact?: boolean }) {
  const [courseOpen, setCourseOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const bySection = course.files.reduce<Record<string, MoodleFile[]>>((acc, file) => {
    const key = file.section || "General";
    acc[key] = [...(acc[key] ?? []), file];
    return acc;
  }, {});

  return (
    <div className="tree-course">
      <button className="tree-folder course tree-toggle" onClick={() => setCourseOpen(!courseOpen)}>
        {courseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={15} />
        <strong>{course.fullname}</strong>
        <span className="tag">{course.files.length}</span>
      </button>
      {courseOpen && Object.entries(bySection).map(([section, sectionFiles]) => {
        const byModule = sectionFiles.reduce<Record<string, MoodleFile[]>>((acc, file) => {
          const key = file.moduleName || "Files";
          acc[key] = [...(acc[key] ?? []), file];
          return acc;
        }, {});
        const sectionOpen = openSections[section] ?? false;
        return (
          <div className="tree-branch" key={section}>
            <button className="tree-folder tree-toggle" onClick={() => setOpenSections({ ...openSections, [section]: !sectionOpen })}>
              {sectionOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Folder size={14} />
              <span>{section}</span>
              <span className="tag">{sectionFiles.length}</span>
            </button>
            {sectionOpen && Object.entries(byModule).map(([moduleName, moduleFiles]) => {
              const moduleKey = `${section}-${moduleName}`;
              const moduleOpen = openModules[moduleKey] ?? false;
              return (
                <div className="tree-branch nested" key={moduleKey}>
                  <button className="tree-folder tree-toggle" onClick={() => setOpenModules({ ...openModules, [moduleKey]: !moduleOpen })}>
                    {moduleOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Folder size={13} />
                    <span>{moduleName}</span>
                    <span className="tag">{moduleFiles.length}</span>
                  </button>
                  {moduleOpen && moduleFiles.map((file) => (
                    <a
                      key={moodleFileKey(file)}
                      className={`tree-file ${file.installed ? "installed" : "failed"} ${compact ? "compact" : ""}`}
                      href={localAssetHref(file.localUrl ?? file.fileurl)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => openMoodleFile(file, e)}
                    >
                      <Trash2 size={14} style={{ opacity: 0 }} />
                      <span>
                        <strong>{file.filename}</strong>
                        <small>
                          {file.installed ? "Installed locally" : `Not installed${file.syncError ? `: ${file.syncError}` : ""}`}
                          {file.localPath ? ` · ${file.localPath}` : ""}
                        </small>
                      </span>
                      <small className="muted">{formatFileSize(file.filesize)}</small>
                    </a>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
