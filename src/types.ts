export type Page = "dashboard" | "calendar" | "knowledge" | "assignments" | "exams" | "moodle" | "settings";
export type Theme = "light" | "dark" | "typewriter" | "modern" | "cyberpunk";
export type Status = "todo" | "progress" | "submitted" | "graded";
export type StudentTrack = "undergraduate" | "foundation";
export type AIProvider = "openai" | "anthropic" | "claude-code" | "codex-cli" | "opencode";

export type ParsedClass = {
  id: string;
  code: string;
  name: string;
  lecturer: string;
  venue: string;
  dayIndex: number; // 0=Mon … 6=Sun
  start: string;    // "HH:MM"
  end: string;
  weeks: string;
};

export type CalendarEvent = ParsedClass & {
  subjectId?: string;
  type: "class" | "custom" | "assignment" | "exam";
  color: string;
  date?: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  folderId?: string;
};

export type NoteFolder = {
  id: string;
  name: string;
  createdAt: string;
};

export type Subject = {
  id: string;
  code: string;
  name: string;
  lecturer: string;
  color: string;
  courseInfo: string;
  notes: Note[];
  folders?: NoteFolder[];
  moodleCourseId?: number;
};

export type Priority = "low" | "medium" | "high";

export type Assignment = {
  id: string;
  subjectId: string;
  title: string;
  due: string;
  weight: number;
  status: Status;
  priority?: Priority;
  description: string;
  relatedFileIds?: string[];
  createdAt?: string;
};

export type ExamKind = "quiz" | "midterm" | "final" | "lab" | "other";

export type LocalFileRef = {
  id: string;
  name: string;
  mime: string;
  size: number;
  localPath: string;
  localUrl: string;
};

export type ExamRecord = {
  id: string;
  subjectId: string;
  title: string;
  kind: ExamKind;
  date: string;
  weight: number;
  score: number;
  maxScore: number;
  notes: string;
  relatedFileIds?: string[];
  attachments: LocalFileRef[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  messages: ChatMessage[];
};

export type AcademicOption = {
  id: string;
  track: StudentTrack;
  label: string;
  intake?: string;
  semester: string;
  startDate: string;
  endDate: string;
  sourceUrl: string;
};

export type MoodleCourseLite = {
  id: number;
  fullname: string;
  shortname?: string;
  startdate?: number;
  enddate?: number;
};

export type MoodleFile = {
  courseId: number;
  courseName: string;
  filename: string;
  fileurl?: string;
  localPath?: string;
  localUrl?: string;
  installed?: boolean;
  syncError?: string;
  timemodified?: number;
  filesize?: number;
  section?: string;
  moduleName?: string;
};

export type MoodleSyncedCourse = {
  id: number;
  fullname: string;
  shortname?: string;
  files: MoodleFile[];
};

export type MoodleState = {
  username: string;
  token: string;
  siteUser: string;
  connected: boolean;
  loading: boolean;
  lastSync: string;
  catalog: MoodleCourseLite[];
  selectedCourseIds: number[];
  courses: MoodleSyncedCourse[];
  files: MoodleFile[];
  error: string;
};

export type AISettings = {
  provider: AIProvider;
  apiKey: string;
  cliCommand: string;
  model: string;
};

export type SemesterData = {
  subjects: Subject[];
  events: CalendarEvent[];
  assignments: Assignment[];
  exams: ExamRecord[];
  activeSubjectId: string;
  activeNoteId: string;
  activeFolderId: string;
};

export type AvatarPreset = {
  seed: string;
};

export type UserProfile = {
  displayName: string;
  avatarUrl?: string;
  avatarPreset?: AvatarPreset;
  onboardingComplete: boolean;
};
