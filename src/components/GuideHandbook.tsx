import { useEffect, useLayoutEffect, useRef } from "react";
import { guideById } from "@/lib/firstAid";
import type { GuideTopic } from "@/data/fieldGuide";

const clampText = (text: string, max: number) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > 40 ? stop : max).trim()}…`;
};

/** The guide title without its trailing detail ("Chest pain · possible heart attack"). */
export const shortTitle = (title: string) => title.split(" · ")[0];

interface GuideHandbookProps {
  topic: GuideTopic;
  open: boolean;
  color: string;
  /** The tile that decides hover: only the tile opens the book. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The three-dimensional handbook in the guide menu. Its cover turns to face the
 * reader while the tile is hovered and the first pages carry the real guide
 * text: the intro the person would hear, then the first two steps.
 *
 * It is deliberately the only decorative object in this section — the shape and
 * motion come from the supplied mockup, the words come from `firstAid.ts`.
 */
export function GuideHandbook({ topic, open, color, containerRef }: GuideHandbookProps) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const guide = guideById(topic.id);

  // Size the book from its tile: tall enough to fill it, narrow enough that the
  // opened two-page spread stays inside the column.
  useLayoutEffect(() => {
    const shelf = shelfRef.current;
    const book = bookRef.current;
    if (!shelf || !book) return;
    const fit = () => {
      const height = shelf.clientHeight;
      const width = shelf.clientWidth;
      if (!height || !width || !book) return;
      const bh = Math.max(150, Math.min(height * 0.78, ((width * 0.8) / 2) * 1.5, 360));
      book.style.setProperty("--bh", `${bh}px`);
      book.style.setProperty("--bw", `${bh / 1.5}px`);
      book.style.setProperty("--bt", `${Math.round(bh * 0.1)}px`);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(shelf);
    fit();
    return () => observer.disconnect();
  }, []);

  // Tilt toward the pointer anywhere over the tile.
  useEffect(() => {
    const tile = containerRef.current;
    const book = bookRef.current;
    if (!tile || !book) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const move = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = tile.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        book.style.setProperty("--tx", (((x - rect.left) / rect.width) * 2 - 1).toFixed(3));
        book.style.setProperty("--ty", (((y - rect.top) / rect.height) * 2 - 1).toFixed(3));
      });
    };
    const leave = () => {
      book.style.setProperty("--tx", "0");
      book.style.setProperty("--ty", "0");
    };
    tile.addEventListener("pointermove", move);
    tile.addEventListener("pointerleave", leave);
    return () => {
      tile.removeEventListener("pointermove", move);
      tile.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
    };
  }, [containerRef]);

  const steps = guide?.steps ?? [];
  const intro = guide?.intro ?? "";
  const title = shortTitle(topic.title);

  return (
    <div className={`fg-shelf3d${open ? " fg-is-open" : ""}`} ref={shelfRef} aria-hidden="true">
      <div className="fg-b3-float">
        <div className="fg-b3" ref={bookRef} style={{ "--spine": color } as React.CSSProperties}>
          <span className="fg-b3-shadow" />
          <div className="fg-b3-back" />
          <div className="fg-b3-liner" />
          <div className="fg-b3-spine">
            <span>{title}</span>
          </div>
          <div className="fg-b3-edge" />
          <div className="fg-b3-top" />
          <div className="fg-b3-bot" />
          <div className="fg-b3-page">
            <small>Step 2</small>
            <blockquote>{clampText(steps[1] ?? intro, 150)}</blockquote>
            <b>3</b>
          </div>
          <div className="fg-b3-leaf l3" />
          <div className="fg-b3-leaf l2" />
          <div className="fg-b3-leaf l1" />
          <div className="fg-b3-leaf lf">
            <div className="fg-pf front fg-title-page">
              <small>First step</small>
              <em>{clampText(steps[0] ?? intro, 84)}</em>
            </div>
            <div className="fg-pf back">
              <small>Before anything else</small>
              <blockquote>{intro}</blockquote>
              <b>2</b>
            </div>
          </div>
          <div className="fg-b3-cover">
            <div className="front">
              <span className="cv">
                <span className="cv-a">Lifeline field guide</span>
                <span className="cv-t">{title}</span>
                <span className="cv-rule" />
              </span>
            </div>
            <div className="inside" />
          </div>
        </div>
      </div>
    </div>
  );
}
