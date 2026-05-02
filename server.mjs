import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 8787);
const MOODLE_ORIGIN = "https://l.xmu.edu.my";
const ACADEMIC_CALENDAR_URL = "https://www.xmu.edu.my/admissions/academic-calendar";

// Resolve app root relative to executable/script so packaged binaries work
const APP_ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = join(APP_ROOT, "data");
const KNOWLEDGE_DIR = join(DATA_ROOT, "knowledge");
const MOODLE_DIR = join(DATA_ROOT, "moodle");
const UPLOADS_DIR = join(DATA_ROOT, "uploads");

const academicOptions = [
  {
    id: "foundation-apr-2026-s1",
    track: "foundation",
    label: "Foundation Students",
    intake: "April 2026 Intake",
    semester: "Semester 1",
    startDate: "2026-04-01",
    endDate: "2026-07-31",
    sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-12/Academic%20Calendar%20%28April%202026%20Intake%29.jpg",
  },
  {
    id: "foundation-dec-2025-s2",
    track: "foundation",
    label: "Foundation Students",
    intake: "December 2025 Intake",
    semester: "Semester 2",
    startDate: "2026-04-01",
    endDate: "2026-07-31",
    sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-11/Academic%20Calendar%20%28December%202025%20Intake%29%20v2.jpg",
  },
  {
    id: "foundation-aug-2025-s3",
    track: "foundation",
    label: "Foundation Students",
    intake: "August 2025 Intake",
    semester: "Semester 3",
    startDate: "2026-04-01",
    endDate: "2026-07-31",
    sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-11/Academic%20Calendar%20%28August%202025%20Intake%29%20v2.jpg",
  },
  {
    id: "ug-feb-2026",
    track: "undergraduate",
    label: "Undergraduate Students",
    semester: "February Semester",
    startDate: "2026-02-20",
    endDate: "2026-04-03",
    sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg",
  },
  {
    id: "ug-apr-2026",
    track: "undergraduate",
    label: "Undergraduate Students",
    semester: "April Semester",
    startDate: "2026-04-03",
    endDate: "2026-07-31",
    sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg",
  },
  {
    id: "ug-sep-2026",
    track: "undergraduate",
    label: "Undergraduate Students",
    semester: "September Semester",
    startDate: "2026-09-25",
    endDate: "2027-01-21",
    sourceUrl: "https://www.xmu.edu.my/sites/default/files/2025-08/2026-Undergraduate-Academic-Calendar.jpg",
  },
];

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendFile(res, status, file, type = "application/octet-stream") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(file);
}

function contentTypeFor(pathname) {
  const ext = extname(pathname).toLowerCase();
  if (ext === ".html") return "text/html";
  if (ext === ".js") return "text/javascript";
  if (ext === ".css") return "text/css";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function safeJoin(base, ...parts) {
  const baseResolved = resolve(base);
  const target = resolve(base, ...parts);
  if (target !== baseResolved && !target.startsWith(`${baseResolved}/`)) {
    throw new Error("Invalid file path.");
  }
  return target;
}

function slug(value, fallback = "item") {
  const cleaned = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96);
  return cleaned || fallback;
}

function noteFrontmatter(entries) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`${key}: ${JSON.stringify(String(value))}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

async function moodleCall(token, wsfunction, params = {}) {
  const body = new URLSearchParams({
    wstoken: token,
    moodlewsrestformat: "json",
    wsfunction,
  });
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => body.append(`${key}[${index}]`, String(entry)));
    } else {
      body.append(key, String(value));
    }
  }
  const response = await fetch(`${MOODLE_ORIGIN}/webservice/rest/server.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json();
  if (!response.ok || payload?.exception) {
    throw new Error(payload?.message ?? `Moodle ${wsfunction} failed`);
  }
  return payload;
}

function flattenFiles(course, contents) {
  const files = [];
  for (const section of contents) {
    for (const module of section.modules ?? []) {
      for (const content of module.contents ?? []) {
        if (content.type === "file" && content.filename) {
          files.push({
            courseId: course.id,
            courseName: course.fullname,
            section: section.name ?? "",
            moduleName: module.name ?? "",
            filename: content.filename,
            fileurl: content.fileurl
              ? `${content.fileurl}${content.fileurl.includes("?") ? "&" : "?"}token=${course.token}`
              : "",
            filesize: content.filesize,
            timemodified: content.timemodified,
            moduleName: module.name ?? "",
          });
        }
      }
    }
  }
  return files;
}

async function installMoodleFile(file) {
  if (!file.fileurl) {
    return { ...file, installed: false, syncError: "No Moodle download URL." };
  }

  const relParts = [
    slug(`${file.courseName}-${file.courseId}`, `course-${file.courseId}`),
    slug(file.section || "General", "General"),
    slug(file.moduleName || "Files", "Files"),
    slug(file.filename, "file"),
  ];
  const relPath = relParts.join("/");
  const absolutePath = safeJoin(MOODLE_DIR, ...relParts);

  try {
    const response = await fetch(file.fileurl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return {
      ...file,
      installed: true,
      localPath: relPath,
      localUrl: `/api/moodle/file?path=${encodeURIComponent(relPath)}`,
      filesize: file.filesize || body.byteLength,
    };
  } catch (error) {
    return {
      ...file,
      installed: false,
      localPath: relPath,
      syncError: error.message ?? "Download failed.",
    };
  }
}

async function callOpenAI({ apiKey, model, system, messages }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...messages,
      ],
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error?.message ?? `OpenAI ${res.status}`);
  return payload.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic({ apiKey, model, system, messages }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-3-5-haiku-latest",
      max_tokens: 1024,
      ...(system ? { system } : {}),
      messages,
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error?.message ?? `Anthropic ${res.status}`);
  return payload.content?.map((part) => part.text ?? "").join("\n") ?? "";
}

function callCli({ provider, cliCommand, system, messages }) {
  return new Promise((resolve, reject) => {
    // Auto-detect common command names when not explicitly configured
    if (!cliCommand) {
      cliCommand =
        provider === "claude-code"
          ? "claude"
          : provider === "codex-cli"
            ? "codex"
            : provider === "opencode"
              ? "opencode"
              : null;
    }
    if (!cliCommand) return reject(new Error("CLI command not configured."));

    // Build a formatted prompt that includes system context and conversation history
    const lines = [];
    if (system) lines.push(`System:\n${system}`);
    for (const msg of messages) {
      const label =
        msg.role === "user"
          ? "User"
          : msg.role === "assistant"
            ? "Assistant"
            : "System";
      lines.push(`${label}:\n${msg.content}`);
    }
    const prompt = lines.join("\n\n");

    const tokens = cliCommand.trim().split(/\s+/);
    const cmd = tokens[0];
    const baseArgs = tokens.slice(1);

    let args;

    if (provider === "claude-code") {
      // Claude Code requires -p (or --print) to run in non-interactive prompt mode.
      // Pass the prompt via stdin to avoid command-line length limits.
      args = [...baseArgs, "-p"];
    } else if (provider === "codex-cli") {
      // Codex exec reads the prompt from stdin when "-" is used;
      // --skip-git-repo-check avoids the "trusted directory" prompt in non-TTY environments.
      args = [...baseArgs, "exec", "--skip-git-repo-check", "-"];
    } else if (provider === "opencode") {
      // opencode run accepts input via stdin.
      args = [...baseArgs, "run"];
    } else {
      // Generic fallback: pass prompt via stdin
      args = [...baseArgs];
    }

    let proc;
    try {
      proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], timeout: 120000, cwd: process.cwd() });
    } catch (err) {
      return reject(
        new Error(
          `Failed to spawn "${cmd}". Is it installed and available in your PATH? (${err.message})`
        )
      );
    }

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      proc.kill();
      reject(new Error(`CLI command "${cmd}" timed out after 120 seconds.`));
    }, 120000);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Failed to run "${cmd}". Is it installed and available in your PATH? (${err.message})`
        )
      );
    });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (killed) return;
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const errParts = [];
        if (stdout.trim()) errParts.push(stdout.trim());
        if (stderr.trim()) errParts.push(stderr.trim());
        reject(
          new Error(
            errParts.join("\n---\n") ||
              `"${cmd}" exited with code ${code}. Try running it manually in your terminal to verify it works.`
          )
        );
      }
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

async function handleAIChat(req, res) {
  try {
    const { provider, apiKey, cliCommand, model, system, messages } = await readJson(req);
    if (!provider) return sendJson(res, 400, { error: "Provider required." });
    if (!Array.isArray(messages) || !messages.length) return sendJson(res, 400, { error: "messages required." });
    let reply = "";
    if (provider === "openai") {
      if (!apiKey) return sendJson(res, 400, { error: "OpenAI API key required." });
      reply = await callOpenAI({ apiKey, model, system, messages });
    } else if (provider === "anthropic") {
      if (!apiKey) return sendJson(res, 400, { error: "Anthropic API key required." });
      reply = await callAnthropic({ apiKey, model, system, messages });
    } else if (provider === "claude-code" || provider === "codex-cli" || provider === "opencode") {
      reply = await callCli({ provider, cliCommand, system, messages });
    } else {
      return sendJson(res, 400, { error: `Unknown provider: ${provider}` });
    }
    sendJson(res, 200, { reply });
  } catch (err) {
    sendJson(res, 500, { error: err.message ?? "AI request failed." });
  }
}

async function handleAcademicCalendar(res) {
  try {
    const response = await fetch(ACADEMIC_CALENDAR_URL);
    const html = await response.text();
    const discovered = Array.from(
      html.matchAll(/href="([^"]+(?:Academic|Undergraduate)[^"]+\.(?:jpg|png|pdf))"/gi),
    ).map((match) => new URL(match[1].replaceAll("&amp;", "&"), ACADEMIC_CALENDAR_URL).toString());
    sendJson(res, 200, { sourcePage: ACADEMIC_CALENDAR_URL, discovered, options: academicOptions });
  } catch (error) {
    sendJson(res, 200, {
      sourcePage: ACADEMIC_CALENDAR_URL,
      discovered: [],
      options: academicOptions,
      warning: error.message,
    });
  }
}

async function handleMoodleLogin(req, res) {
  const { username, password } = await readJson(req);
  if (!username || !password) {
    sendJson(res, 400, { error: "Username and password are required." });
    return;
  }
  const body = new URLSearchParams({ username, password, service: "moodle_mobile_app" });
  const response = await fetch(`${MOODLE_ORIGIN}/login/token.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json();
  if (!response.ok || payload.error || !payload.token) {
    sendJson(res, 401, { error: payload.error ?? "Moodle login failed." });
    return;
  }
  const siteInfo = await moodleCall(payload.token, "core_webservice_get_site_info");
  sendJson(res, 200, {
    token: payload.token,
    userid: siteInfo.userid,
    username: siteInfo.username ?? username,
    fullname: siteInfo.fullname ?? siteInfo.firstname ?? username,
  });
}

async function handleMoodleCourses(req, res) {
  const { token } = await readJson(req);
  if (!token) {
    sendJson(res, 400, { error: "Login token is required." });
    return;
  }
  const siteInfo = await moodleCall(token, "core_webservice_get_site_info");
  const enrolled = await moodleCall(token, "core_enrol_get_users_courses", {
    userid: siteInfo.userid,
  });
  const courses = enrolled.map((course) => ({
    id: course.id,
    fullname: course.fullname,
    shortname: course.shortname,
    categoryid: course.category,
    startdate: course.startdate,
    enddate: course.enddate,
  }));
  sendJson(res, 200, { courses });
}

async function handleMoodleSync(req, res) {
  const { token, courseIds } = await readJson(req);
  if (!token) {
    sendJson(res, 400, { error: "Login token is required." });
    return;
  }
  const siteInfo = await moodleCall(token, "core_webservice_get_site_info");
  const enrolled = await moodleCall(token, "core_enrol_get_users_courses", {
    userid: siteInfo.userid,
  });
  const wanted = new Set((courseIds ?? []).map((id) => Number(id)));
  const filtered = wanted.size ? enrolled.filter((course) => wanted.has(course.id)) : enrolled;

  const courses = [];
  const files = [];
  const errors = [];

  for (const course of filtered) {
    try {
      const contents = await moodleCall(token, "core_course_get_contents", {
        courseid: course.id,
      });
      const courseFiles = flattenFiles({ ...course, token }, contents);
      const installedFiles = [];
      for (const file of courseFiles) {
        installedFiles.push(await installMoodleFile(file));
      }
      courses.push({
        id: course.id,
        fullname: course.fullname,
        shortname: course.shortname,
        files: installedFiles,
      });
      files.push(...installedFiles);
    } catch (error) {
      errors.push({ id: course.id, fullname: course.fullname, error: error.message });
    }
  }

  sendJson(res, 200, { courses, files, errors });
}

async function handleKnowledgeSync(req, res) {
  const { subjects } = await readJson(req);
  if (!Array.isArray(subjects)) {
    sendJson(res, 400, { error: "subjects must be an array." });
    return;
  }

  await rm(KNOWLEDGE_DIR, { recursive: true, force: true });
  await mkdir(KNOWLEDGE_DIR, { recursive: true });

  let noteCount = 0;
  let subjectCount = 0;

  for (const subject of subjects) {
    const subjectName = subject?.name ?? "Subject";
    const subjectCode = subject?.code ?? "subject";
    const subjectId = subject?.id ?? slug(subjectCode);
    const subjectDir = safeJoin(KNOWLEDGE_DIR, slug(`${subjectCode}-${subjectId}`, "subject"));
    await mkdir(subjectDir, { recursive: true });
    subjectCount += 1;

    if (typeof subject.courseInfo === "string") {
      await writeFile(
        safeJoin(subjectDir, "_course-info.md"),
        `${noteFrontmatter({ id: subjectId, type: "course-info", subject: subjectName })}${subject.courseInfo}`,
        "utf8",
      );
    }

    const folders = new Map(
      (Array.isArray(subject.folders) ? subject.folders : []).map((folder) => [
        folder.id,
        folder.name,
      ]),
    );

    for (const note of Array.isArray(subject.notes) ? subject.notes : []) {
      const folderName = folders.get(note.folderId) ?? "Unfiled";
      const folderDir = safeJoin(subjectDir, slug(folderName, "Unfiled"));
      await mkdir(folderDir, { recursive: true });
      const fileName = `${slug(note.title, "Untitled")}-${slug(note.id, "note")}.md`;
      const markdown = `${noteFrontmatter({
        id: note.id,
        title: note.title,
        subject: subjectName,
        folder: folderName,
        updatedAt: note.updatedAt,
      })}${note.content ?? ""}`;
      await writeFile(safeJoin(folderDir, fileName), markdown, "utf8");
      noteCount += 1;
    }
  }

  sendJson(res, 200, {
    subjectCount,
    noteCount,
    root: KNOWLEDGE_DIR,
  });
}

async function handleUploadJson(req, res) {
  const { scope = "general", filename, mime = "application/octet-stream", dataUrl } = await readJson(req);
  if (!filename || !dataUrl || typeof dataUrl !== "string") {
    sendJson(res, 400, { error: "filename and dataUrl are required." });
    return;
  }
  const encoded = dataUrl.includes(",") ? dataUrl.split(",").pop() : dataUrl;
  const buffer = Buffer.from(encoded, "base64");
  const safeScope = slug(scope, "general");
  const fileName = `${Date.now()}-${slug(filename, "upload")}`;
  const relPath = `${safeScope}/${fileName}`;
  const absolutePath = safeJoin(UPLOADS_DIR, safeScope, fileName);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  sendJson(res, 200, {
    id: `${safeScope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: filename,
    mime,
    size: buffer.byteLength,
    localPath: relPath,
    localUrl: `/api/local-file?path=${encodeURIComponent(relPath)}`,
  });
}

async function handleManagedFile(req, res, baseDir) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const relPath = url.searchParams.get("path");
  if (!relPath) {
    sendJson(res, 400, { error: "path is required." });
    return;
  }
  const absolutePath = safeJoin(baseDir, relPath);
  try {
    const file = await readFile(absolutePath);
    sendFile(res, 200, file, contentTypeFor(absolutePath));
  } catch {
    sendJson(res, 404, { error: "File not found." });
  }
}

async function serveStatic(req, res) {
  const pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const distDir = join(APP_ROOT, "dist");
  const safePath = normalize(join(distDir, requested));
  if (!safePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const file = await readFile(safePath);
    sendFile(res, 200, file, contentTypeFor(safePath));
  } catch {
    const fallback = await readFile(join(distDir, "index.html"));
    sendFile(res, 200, fallback, "text/html");
  }
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === "/api/academic-calendar" && req.method === "GET") {
      await handleAcademicCalendar(res);
      return;
    }
    if (url.pathname === "/api/moodle/login" && req.method === "POST") {
      await handleMoodleLogin(req, res);
      return;
    }
    if (url.pathname === "/api/moodle/courses" && req.method === "POST") {
      await handleMoodleCourses(req, res);
      return;
    }
    if (url.pathname === "/api/moodle/sync" && req.method === "POST") {
      await handleMoodleSync(req, res);
      return;
    }
    if (url.pathname === "/api/moodle/file" && req.method === "GET") {
      await handleManagedFile(req, res, MOODLE_DIR);
      return;
    }
    if (url.pathname === "/api/knowledge/sync" && req.method === "POST") {
      await handleKnowledgeSync(req, res);
      return;
    }
    if (url.pathname === "/api/files/upload" && req.method === "POST") {
      await handleUploadJson(req, res);
      return;
    }
    if (url.pathname === "/api/local-file" && req.method === "GET") {
      await handleManagedFile(req, res, UPLOADS_DIR);
      return;
    }
    if (url.pathname === "/api/ai/chat" && req.method === "POST") {
      await handleAIChat(req, res);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "Unknown API route." });
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message ?? "Unexpected server error." });
  }
})
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} already in use. Another server.mjs running? Stop it or set API_PORT to a free port.`);
      process.exit(1);
    }
    throw err;
  })
  .listen(PORT, () => {
    console.log(`XMUM Scheduler API listening on http://localhost:${PORT}`);
  });
