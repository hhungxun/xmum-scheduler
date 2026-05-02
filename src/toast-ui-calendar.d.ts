declare module "@toast-ui/calendar" {
  export type ToastDate = Date | string | number | { toDate?: () => Date; valueOf?: () => number };
  export type ViewType = "month" | "week" | "day";
  export type EventCategory = "milestone" | "task" | "allday" | "time";

  export interface EventObject {
    id?: string;
    calendarId?: string;
    title?: string;
    body?: string;
    isAllday?: boolean;
    start?: ToastDate;
    end?: ToastDate;
    location?: string;
    category?: EventCategory;
    state?: "Busy" | "Free";
    isReadOnly?: boolean;
    color?: string;
    backgroundColor?: string;
    dragBackgroundColor?: string;
    borderColor?: string;
    raw?: unknown;
  }

  export interface EventObjectWithDefaultValues extends EventObject {
    id: string;
    calendarId: string;
    title: string;
    start: ToastDate;
    end: ToastDate;
    raw?: unknown;
  }

  export interface UpdatedEventInfo {
    event: EventObjectWithDefaultValues;
    changes: EventObject;
  }

  export type ExternalEventTypes = {
    beforeCreateEvent: (event: EventObject) => void;
    beforeUpdateEvent: (updatedEventInfo: UpdatedEventInfo) => void;
    beforeDeleteEvent: (event: EventObjectWithDefaultValues) => void;
    [eventName: string]: (...args: unknown[]) => void;
  };

  export interface CalendarInfo {
    id: string;
    name: string;
    color?: string;
    backgroundColor?: string;
    dragBackgroundColor?: string;
    borderColor?: string;
  }

  export interface Options {
    defaultView?: ViewType;
    usageStatistics?: boolean;
    useFormPopup?: boolean;
    useDetailPopup?: boolean;
    gridSelection?: boolean | { enableClick?: boolean; enableDblClick?: boolean };
    calendars?: CalendarInfo[];
    week?: {
      startDayOfWeek?: number;
      dayNames?: [string, string, string, string, string, string, string] | [];
      hourStart?: number;
      hourEnd?: number;
      taskView?: boolean | Array<"milestone" | "task">;
      eventView?: boolean | Array<"allday" | "time">;
      showTimezoneCollapseButton?: boolean;
      timezonesCollapsed?: boolean;
    };
    month?: {
      startDayOfWeek?: number;
      visibleEventCount?: number;
    };
    template?: {
      time?: (event: EventObject) => string;
      allday?: (event: EventObject) => string;
    };
  }

  export default class Calendar {
    constructor(container: string | Element, options?: Options);
    createEvents(events: EventObject[]): void;
    updateEvent(eventId: string, calendarId: string, changes: EventObject): void;
    deleteEvent(eventId: string, calendarId: string): void;
    clear(): void;
    clearGridSelections(): void;
    destroy(): void;
    render(): this;
    scrollToNow(scrollBehavior?: ScrollBehavior): void;
    setCalendars(calendars: CalendarInfo[]): void;
    setDate(date: ToastDate): void;
    on<EventName extends keyof ExternalEventTypes>(eventName: EventName, handler: ExternalEventTypes[EventName]): this;
    off<EventName extends keyof ExternalEventTypes>(eventName?: EventName, handler?: ExternalEventTypes[EventName]): this;
  }
}
