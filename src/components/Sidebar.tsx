import { ReactNode } from "react";
import {
  BookOpen,
  Calendar as CalendarIcon,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Cloud,
  GraduationCap,
  Home,
} from "lucide-react";
import type { Page, UserProfile } from "../types";
import { Avatar } from "./Avatar";

export function Sidebar({
  page,
  nav,
  semester,
  moodleConnected,
  collapsed,
  setCollapsed,
  userProfile,
}: {
  page: Page;
  nav: (p: Page) => void;
  semester: string;
  moodleConnected: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  userProfile: UserProfile;
}) {
  const name = userProfile.displayName || "Student";
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <div className="brand-mark">OS</div>
        {!collapsed && (
          <div className="brand-text">
            <strong>XMUM OS</strong>
            <span className="tag" style={{ fontSize: "0.65rem", marginTop: 3 }}>{semester}</span>
          </div>
        )}
      </div>

      <button
        className="collapse-btn icon-btn"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <NavItem icon={<Home size={16} />} label="Dashboard" active={page === "dashboard"} onClick={() => nav("dashboard")} collapsed={collapsed} />
      <NavItem icon={<CalendarIcon size={16} />} label="Calendar" active={page === "calendar"} onClick={() => nav("calendar")} collapsed={collapsed} />
      <NavItem icon={<BookOpen size={16} />} label="Knowledge" active={page === "knowledge"} onClick={() => nav("knowledge")} collapsed={collapsed} />
      <NavItem icon={<CheckSquare size={16} />} label="Assignments" active={page === "assignments"} onClick={() => nav("assignments")} collapsed={collapsed} />
      <NavItem icon={<GraduationCap size={16} />} label="Exams" active={page === "exams"} onClick={() => nav("exams")} collapsed={collapsed} />
      <NavItem icon={<Cloud size={16} />} label="Moodle" active={page === "moodle"} onClick={() => nav("moodle")} collapsed={collapsed} suffix={moodleConnected && !collapsed ? <span className="tag">on</span> : null} />

      <div className="sidebar-footer">
        <div className="sidebar-profile" onClick={() => nav("settings")}>
          <Avatar profile={userProfile} size={28} alt={name} />
          {!collapsed && <span className="sidebar-profile-name">{name}</span>}
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active, onClick, suffix, collapsed }: { icon: ReactNode; label: string; active: boolean; onClick: () => void; suffix?: ReactNode; collapsed?: boolean }) {
  return (
    <button className={`nav ${active ? "active" : ""}`} onClick={onClick} title={label}>
      {icon}
      {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
      {!collapsed && suffix}
    </button>
  );
}
