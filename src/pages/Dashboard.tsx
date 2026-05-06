import { Calendar as CalendarIcon, ChevronRight, Clock, Sparkles, BookOpen } from "lucide-react";
import type { CalendarEvent, Subject, Page, Conversation, AISettings, Assignment, MoodleFile, UserProfile, ChatFolder, ChatImage } from "../types";
import { ChatPanel } from "../components/ChatPanel";
import { Avatar } from "../components/Avatar";
import { MY_SPACE_CODE } from "../lib/utils";

export function Dashboard({
  today, todayEvents, subjects, conversation, conversations,
  sendChat, loadingConversationId, aiSettings, setAISettings,
  activeConversationId, setConversationModel, setActiveConversationId,
  createConversation, deleteConversation, renameConversation,
  moodleFiles, userProfile, setUserProfile, assignments, todaysTasks, upcomingEvents, activeSubject,
  go,
  chatFolders, createChatFolder, renameChatFolder, deleteChatFolder, moveConversationToFolder,
}: {
  today: Date;
  todayEvents: CalendarEvent[];
  subjects: Subject[];
  conversation: Conversation | null;
  conversations: Record<string, Conversation>;
  sendChat: (text: string, displayText?: string, fileIds?: string[], contextPrefix?: string, targetConversationId?: string, images?: ChatImage[]) => void;
  loadingConversationId: string | null;
  aiSettings: AISettings;
  setAISettings: (v: AISettings) => void;
  setConversationModel: (id: string, model: string, provider: AISettings["provider"]) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createConversation: (firstUserText?: string) => string;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  moodleFiles: MoodleFile[];
  userProfile: UserProfile;
  setUserProfile: (v: UserProfile) => void;
  assignments: Assignment[];
  todaysTasks: Assignment[];
  upcomingEvents: CalendarEvent[];
  activeSubject?: Subject;
  go: (p: Page) => void;
  chatFolders: ChatFolder[];
  createChatFolder: (name: string) => string;
  renameChatFolder: (id: string, name: string) => void;
  deleteChatFolder: (id: string) => void;
  moveConversationToFolder: (convId: string, folderId: string | undefined) => void;
}) {
  const dateText = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const loading = loadingConversationId !== null && activeConversationId === loadingConversationId;
  const userName = userProfile.displayName || "Student";
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const nextClass = todayEvents[0] ?? null;
  const nextDeadline = assignments.filter((a) => !!a.due).sort((a, b) => a.due.localeCompare(b.due))[0] ?? null;

  return (
    <div className="dashboard-simple">
      <div className="dashboard-chat">
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", height: "100%" }}>
          <ChatPanel
            conversation={conversation}
            conversations={conversations}
            onSend={sendChat}
            loading={loading}
            aiSettings={aiSettings}
            setAISettings={setAISettings}
            setConversationModel={setConversationModel}
            activeConversationId={activeConversationId}
            setActiveConversationId={setActiveConversationId}
            createConversation={createConversation}
            deleteConversation={deleteConversation}
            renameConversation={renameConversation}
            moodleFiles={moodleFiles}
            userProfile={userProfile}
            subjects={subjects}
            chatFolders={chatFolders}
            createChatFolder={createChatFolder}
            renameChatFolder={renameChatFolder}
            deleteChatFolder={deleteChatFolder}
            moveConversationToFolder={moveConversationToFolder}
          />
        </div>
      </div>

      <div className="dashboard-today">
        {/* Welcome header */}
        <div className="dash-welcome">
          <Avatar profile={userProfile} size={40} alt={userName} />
          <div>
            <h2 className="dash-greeting">{greeting}, {userName}</h2>
            <p className="dash-summary">{dateText}</p>
          </div>
        </div>

        {/* Compact academic summary */}
        {(nextClass || nextDeadline) && (
          <div className="card today-card" style={{ padding: "10px 12px" }}>
            <div className="today-events">
              {nextClass && (
                <div className="today-event-row">
                  <Clock size={14} className="muted" />
                  <div className="today-event-info">
                    <span className="today-event-title">Next class</span>
                    <span className="today-event-meta">{nextClass.code} · {nextClass.start}–{nextClass.end} · {nextClass.venue}</span>
                  </div>
                </div>
              )}
              {nextDeadline && (
                <div className="today-event-row">
                  <CalendarIcon size={14} className="muted" />
                  <div className="today-event-info">
                    <span className="today-event-title">Next deadline</span>
                    <span className="today-event-meta">{nextDeadline.title} · Due {nextDeadline.due}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Today's tasks */}
        <div className="card today-card">
          <div className="today-card-header">
            <h2>Today&apos;s tasks</h2>
            <button className="btn btn-ghost" style={{ fontSize: "0.82rem", padding: "4px 8px" }} onClick={() => go("assignments")}>
              Tasks <ChevronRight size={12} />
            </button>
          </div>
          {todaysTasks.length > 0 ? (
            <div className="today-events">
              {todaysTasks.slice(0, 4).map((a) => {
                const subj = subjects.find((s) => s.id === a.subjectId);
                return (
                  <div key={a.id} className="today-event-row">
                    <span className="agenda-dot" style={{ background: subj?.color ?? "#888" }} />
                    <div className="today-event-info">
                      <span className="today-event-title">{a.title}</span>
                      <span className="today-event-meta">{subj?.code ?? "—"} · Due {a.due} · {a.weight}%</span>
                    </div>
                  </div>
                );
              })}
              {todaysTasks.length > 4 && (
                <button className="btn btn-ghost" style={{ fontSize: "0.78rem", padding: "4px 8px" }} onClick={() => go("assignments")}>
                  +{todaysTasks.length - 4} more tasks
                </button>
              )}
            </div>
          ) : (
            <div className="today-empty-soft">
              <Sparkles size={18} style={{ opacity: 0.3 }} />
              <span>No tasks due today</span>
            </div>
          )}
        </div>

        {/* Upcoming events */}
        <div className="card today-card">
          <div className="today-card-header">
            <h2>Upcoming events</h2>
            <button className="btn btn-ghost" style={{ fontSize: "0.82rem", padding: "4px 8px" }} onClick={() => go("calendar")}>
              Calendar <ChevronRight size={12} />
            </button>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="today-events">
              {upcomingEvents.slice(0, 4).map((e) => (
                <div key={e.id} className="today-event-row">
                  <span className="agenda-dot" style={{ background: e.color }} />
                  <div className="today-event-info">
                    <span className="today-event-title">{e.code} · {e.name}</span>
                    <span className="today-event-meta">{e.date} · {e.start}–{e.end} · {e.venue}</span>
                  </div>
                </div>
              ))}
              {upcomingEvents.length > 4 && (
                <button className="btn btn-ghost" style={{ fontSize: "0.78rem", padding: "4px 8px" }} onClick={() => go("calendar")}>
                  +{upcomingEvents.length - 4} more events
                </button>
              )}
            </div>
          ) : (
            <div className="today-empty-soft">
              <Clock size={18} style={{ opacity: 0.3 }} />
              <span>No upcoming events</span>
            </div>
          )}
        </div>

        {/* Subjects */}
        <div className="card today-card">
          <div className="today-card-header">
            <h2>Subjects</h2>
          </div>
          <div className="dash-subjects">
            {subjects.filter((s) => s.code !== MY_SPACE_CODE).slice(0, 6).map((s) => {
              const nextDeadline = assignments.filter((a) => !!a.due && a.subjectId === s.id).sort((a, b) => a.due.localeCompare(b.due))[0];
              return (
                <button key={s.id} className="dash-subject-card" onClick={() => go("knowledge")}>
                  <span className="dash-subject-dot" style={{ background: s.color }} />
                  <div className="dash-subject-info">
                    <div className="dash-subject-topline">
                      <strong title={s.code}>{s.code}</strong>
                      <span className="dash-subject-tag" style={{ color: s.color, background: `${s.color}15`, borderColor: `${s.color}40` }}>{s.code}</span>
                    </div>
                    <span className="dash-subject-name" title={s.name}>{s.name}</span>
                    <span className="dash-subject-meta" title={s.lecturer}>{nextDeadline ? `Due ${nextDeadline.due}` : s.lecturer}</span>
                  </div>
                </button>
              );
            })}
            {!subjects.length && (
              <div className="today-empty-soft">
                <BookOpen size={18} style={{ opacity: 0.3 }} />
                <span>No subjects yet</span>
              </div>
            )}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 10, alignSelf: "flex-start", fontSize: "0.82rem" }} onClick={() => go("settings")}>
            Import timetable <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
