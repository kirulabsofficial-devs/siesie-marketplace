import { useEffect, useId, useRef, useState } from "react";
import { Check, Link2, Palette } from "lucide-react";
import { applyTheme, THEMES, themeLink, useTheme } from "../lib/theme";
import { useToast } from "./Toast";

/** Prototype-only palette picker. Stays open while choosing so themes can be flicked between and compared. */
export function ThemeSwitcher() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const toast = useToast();
  const active = THEMES.find((t) => t.id === theme)!;

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(themeLink(theme)); toast(`Link to ${active.name} copied.`); }
    catch { toast("Couldn't copy the link in this browser.", "error"); }
  };

  return (
    <div className="theme-switcher" ref={wrap}>
      <button ref={trigger} className="prototype-theme" aria-expanded={open} aria-controls={panelId} aria-label={`Colour theme: ${active.name}`} title="Try a colour theme" onClick={() => setOpen((o) => !o)}>
        <Palette size={15} aria-hidden /><span className="prototype-theme-label">Theme</span>
      </button>
      {open && (
        <div id={panelId} className="theme-popover" role="group" aria-label="Colour themes">
          <p className="theme-popover-title">Colour theme <small>Prototype only</small></p>
          <div className="theme-options">
            {THEMES.map((t) => (
              <button key={t.id} className="theme-option" aria-pressed={t.id === theme} onClick={() => applyTheme(t.id)}>
                <span className="theme-swatches" aria-hidden>{t.swatches.map((c) => <span key={c} style={{ background: c }} />)}</span>
                <span className="theme-option-copy"><strong>{t.name}</strong><small>{t.note}</small></span>
                {t.id === theme && <Check size={16} aria-hidden />}
              </button>
            ))}
          </div>
          <button className="theme-copy" onClick={() => void copyLink()}><Link2 size={14} aria-hidden />Copy link to this theme</button>
        </div>
      )}
    </div>
  );
}
