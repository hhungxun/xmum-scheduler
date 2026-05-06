import { Crepe } from "@milkdown/crepe";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import "@milkdown/crepe/theme/common/style.css";
import frameLightUrl from "@milkdown/crepe/theme/frame.css?url";
import frameDarkUrl from "@milkdown/crepe/theme/frame-dark.css?url";
import "./milkdown.css";

function ensureCrepeTheme(theme: "light" | "dark") {
  const id = "crepe-theme";
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  const href = theme === "dark" ? frameDarkUrl : frameLightUrl;
  if (existing) {
    if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
    return;
  }
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function mapTheme(t: import("./types").Theme): "light" | "dark" {
  if (t === "dark" || t === "cyberpunk") return "dark";
  return "light";
}

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  theme: import("./types").Theme;
  onLinkTrigger?: (trigger: { type: "note" | "moodle"; query: string; rect: DOMRect } | null) => void;
  onOpenWikiLink?: (title: string) => void;
  onOpenMoodleLink?: (key: string) => void;
  onLinkPickerKeyDown?: (event: KeyboardEvent) => boolean;
};

export type MilkdownEditorHandle = {
  replaceTriggerWithText: (text: string) => void;
  replaceTriggerWithLink: (label: string, href: string) => void;
};

export const MilkdownEditor = forwardRef<MilkdownEditorHandle, Props>(function MilkdownEditor({ value, onChange, theme, onLinkTrigger, onOpenWikiLink, onOpenMoodleLink, onLinkPickerKeyDown }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const triggerRangeRef = useRef<Range | null>(null);
  const onLinkTriggerRef = useRef(onLinkTrigger);
  const onOpenWikiLinkRef = useRef(onOpenWikiLink);
  const onOpenMoodleLinkRef = useRef(onOpenMoodleLink);
  const onLinkPickerKeyDownRef = useRef(onLinkPickerKeyDown);

  onChangeRef.current = onChange;
  valueRef.current = value;
  onLinkTriggerRef.current = onLinkTrigger;
  onOpenWikiLinkRef.current = onOpenWikiLink;
  onOpenMoodleLinkRef.current = onOpenMoodleLink;
  onLinkPickerKeyDownRef.current = onLinkPickerKeyDown;

  function escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function detectTrigger() {
    if (!onLinkTriggerRef.current || !hostRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      triggerRangeRef.current = null;
      onLinkTriggerRef.current(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!hostRef.current.contains(range.startContainer)) {
      triggerRangeRef.current = null;
      onLinkTriggerRef.current(null);
      return;
    }
    if (range.startContainer.nodeType !== Node.TEXT_NODE) {
      triggerRangeRef.current = null;
      onLinkTriggerRef.current(null);
      return;
    }
    const text = range.startContainer.textContent ?? "";
    const before = text.slice(0, range.startOffset);
    const wiki = before.match(/\[\[([^\]\n]*)$/);
    const moodle = before.match(/(?:^|\s)@([^\s@]*)$/);
    const match = wiki ?? moodle;
    if (!match) {
      triggerRangeRef.current = null;
      onLinkTriggerRef.current(null);
      return;
    }
    const query = match[1] ?? "";
    const startOffset = range.startOffset - query.length - (wiki ? 2 : 1);
    const triggerRange = document.createRange();
    triggerRange.setStart(range.startContainer, Math.max(0, startOffset));
    triggerRange.setEnd(range.startContainer, range.startOffset);
    triggerRangeRef.current = triggerRange;
    const rect = range.getBoundingClientRect();
    onLinkTriggerRef.current({ type: wiki ? "note" : "moodle", query, rect });
  }

  function replaceTrigger(html: string, asHtml: boolean) {
    const triggerRange = triggerRangeRef.current;
    if (!triggerRange) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(triggerRange);
    document.execCommand(asHtml ? "insertHTML" : "insertText", false, html);
    triggerRangeRef.current = null;
    onLinkTriggerRef.current?.(null);
  }

  useImperativeHandle(ref, () => ({
    replaceTriggerWithText(text: string) {
      replaceTrigger(text, false);
    },
    replaceTriggerWithLink(label: string, href: string) {
      replaceTrigger(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>&nbsp;`, true);
    },
  }));

  useEffect(() => {
    if (!hostRef.current) return;
    const crepe = new Crepe({
      root: hostRef.current,
      defaultValue: valueRef.current,
    });
    crepeRef.current = crepe;
    let disposed = false;

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown) => {
        if (!disposed) onChangeRef.current(markdown);
      });
    });

    crepe.create();

    return () => {
      disposed = true;
      crepe.destroy();
      crepeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const crepeTheme = mapTheme(theme);
    ensureCrepeTheme(crepeTheme);
    document.documentElement.dataset.milkdownTheme = crepeTheme;
  }, [theme]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function onKeyDown(e: KeyboardEvent) {
      if (onLinkPickerKeyDownRef.current?.(e)) return;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Escape") {
        triggerRangeRef.current = null;
        onLinkTriggerRef.current?.(null);
        return;
      }
      detectTrigger();
    }
    function onMouseUp() { detectTrigger(); }
    function onInput() { window.setTimeout(detectTrigger, 0); }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("xmum-note://")) {
        e.preventDefault();
        onOpenWikiLinkRef.current?.(decodeURIComponent(href.slice("xmum-note://".length)));
        return;
      }
      if (href.startsWith("xmum-moodle://")) {
        e.preventDefault();
        onOpenMoodleLinkRef.current?.(decodeURIComponent(href.slice("xmum-moodle://".length)));
        return;
      }
      if (href) {
        e.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      }
    }
    host.addEventListener("keydown", onKeyDown);
    host.addEventListener("keyup", onKeyUp);
    host.addEventListener("mouseup", onMouseUp);
    host.addEventListener("input", onInput);
    host.addEventListener("click", onClick);
    return () => {
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("keyup", onKeyUp);
      host.removeEventListener("mouseup", onMouseUp);
      host.removeEventListener("input", onInput);
      host.removeEventListener("click", onClick);
    };
  }, []);

  return <div ref={hostRef} className="milkdown-host" data-theme={mapTheme(theme)} />;
});
