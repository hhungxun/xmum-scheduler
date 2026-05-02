// Browser-side Google Calendar integration via Google Identity Services + Calendar API v3.
// User provides OAuth Client ID (Settings page); we request scope calendar.events.

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: (overrides?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

export type GoogleEvent = {
  summary: string;
  description?: string;
  location?: string;
  startISO: string;
  endISO: string;
  recurrenceUntil?: string; // ISO date for UNTIL clause
  weekdayBYDAY?: string;    // "MO" "TU" etc
  colorId?: string;         // GCal color id 1–11
};

export function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (document.querySelector(`script[src="${GIS_SRC}"]`)) {
    return new Promise((resolve, reject) => {
      const tries = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(tries);
          resolve();
        }
      }, 80);
      setTimeout(() => { clearInterval(tries); reject(new Error("GIS load timeout")); }, 8000);
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

export async function requestAccessToken(clientId: string): Promise<string> {
  await loadGisScript();
  if (!window.google?.accounts?.oauth2) throw new Error("Google Identity not available");
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: (response) => {
        if (response.error) reject(new Error(response.error));
        else if (!response.access_token) reject(new Error("No access token"));
        else resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export async function insertEvent(token: string, calendarId: string, event: GoogleEvent) {
  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: { dateTime: event.startISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    end: { dateTime: event.endISO, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  };
  if (event.colorId) body.colorId = event.colorId;
  if (event.recurrenceUntil && event.weekdayBYDAY) {
    const until = event.recurrenceUntil.replace(/[-:]/g, "").replace(/\.\d+/, "");
    body.recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${event.weekdayBYDAY};UNTIL=${until}`];
  }
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    },
  );
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error?.message ?? `GCal ${res.status}`);
  return payload;
}

export async function listCalendars(token: string) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload?.error?.message ?? `GCal ${res.status}`);
  return (payload.items ?? []) as { id: string; summary: string; primary?: boolean }[];
}
