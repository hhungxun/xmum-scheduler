import { Crepe } from "@milkdown/crepe";
import { useEffect, useRef } from "react";

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
};

export function MilkdownEditor({ value, onChange, theme }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  onChangeRef.current = onChange;
  valueRef.current = value;

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

  return <div ref={hostRef} className="milkdown-host" data-theme={mapTheme(theme)} />;
}
