import { ReactNode, useEffect, useLayoutEffect, useRef } from "react";

interface ScrollableTableProps {
  children: ReactNode;
  /** Min width for the table — keeps narrow tables from collapsing. */
  minWidth?: number;
  /** Optional className on the outer wrapper. */
  className?: string;
}

/**
 * Renders children at their natural width inside a horizontal scroll container,
 * with a *second* scrollbar above the table that mirrors scrollLeft.
 *
 *   <div class="table-scroll">
 *     <div class="scroll-bar" ref={topRef}>           ← top scrollbar (mirror)
 *       <div ref={innerRef} style={{width: `${w}px`}}/>
 *     </div>
 *     <div class="table-scroll-body" ref={bodyRef}>   ← real scroll surface
 *       <div style={{minWidth: ...}}>{children}</div>
 * </div>
 *
 * Width sync uses an imperative ref (no React state) so re-renders cannot
 * disrupt the scrollLeft value mid-sync.
 */
export default function ScrollableTable({ children, minWidth = 0, className = "" }: ScrollableTableProps) {
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Keep the top scrollbar's inner spacer width equal to body's scrollWidth.
  // Done imperatively via ref to avoid React re-renders that would otherwise
  // happen during scroll sync (which would re-clamp scrollLeft).
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const inner = innerRef.current;
    if (!body || !inner) return;

    const update = () => {
      const w = Math.max(body.scrollWidth, minWidth);
      inner.style.width = `${w}px`;
    };

    update();

    // Re-measure when body or its contents resize
    const ro = new ResizeObserver(update);
    ro.observe(body);
    // Observe the body *child* as well — child width changes don't always
    // bubble up to body's own resize events.
    const firstChild = body.firstElementChild;
    if (firstChild) ro.observe(firstChild);

    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [minWidth, children]);

  // Mirror scroll between the two scroll containers.
  // We use a "syncing" flag so only one direction fires per gesture; otherwise
  // each assignment would re-trigger the other's handler in an infinite loop.
  const syncingRef = useRef(false);

  const onTopScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (bodyRef.current && topRef.current) {
      bodyRef.current.scrollLeft = topRef.current.scrollLeft;
    }
    // Release on the next animation frame
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  const onBodyScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (bodyRef.current && topRef.current) {
      topRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  // Translate vertical mouse-wheel over the top scrollbar into horizontal scroll.
  const onTopWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (bodyRef.current) {
      bodyRef.current.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  // Hide the top scrollbar entirely when the content fits — keeps the layout clean
  // when there's nothing to scroll.
  const topRefForHide = topRef;
  useEffect(() => {
    const body = bodyRef.current;
    const bar = topRefForHide.current;
    if (!body || !bar) return;

    const check = () => {
      const needs = body.scrollWidth > body.clientWidth + 1;
      bar.style.display = needs ? "block" : "none";
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`table-scroll ${className}`}>
      {/* Top (mirror) scrollbar */}
      <div
        ref={topRef}
        className="scroll-bar"
        onScroll={onTopScroll}
        onWheel={onTopWheel}
        aria-hidden="true"
      >
        <div ref={innerRef} className="scroll-bar-inner" />
      </div>

      {/* Bottom (real) scroll container */}
      <div ref={bodyRef} className="table-scroll-body" onScroll={onBodyScroll}>
        <div style={{ minWidth: `${minWidth}px` }}>{children}</div>
      </div>
    </div>
  );
}
