import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Hand } from 'lucide-react';

interface PinchZoomContainerProps {
  children: React.ReactNode;
  /** Natural width of the inner document/table on mobile (e.g. 860 for wide tables, 794 for A4) */
  contentWidth?: number;
  /** Whether to auto-fit to container width on mobile (< 768px) by default */
  autoFitMobile?: boolean;
  /** Minimum allowed scale */
  minScale?: number;
  /** Maximum allowed scale */
  maxScale?: number;
  /** Optional className for outer wrapper */
  className?: string;
  /** Whether to show floating/top zoom toolbar on mobile (or always) */
  showToolbar?: boolean;
  /** Whether to apply zoom behavior on desktop too (default: false for tables, true if alwaysZoomable) */
  alwaysZoomable?: boolean;
}

export const PinchZoomContainer: React.FC<PinchZoomContainerProps> = ({
  children,
  contentWidth = 860,
  autoFitMobile = true,
  minScale = 0.25,
  maxScale = 3.0,
  className = '',
  showToolbar = true,
  alwaysZoomable = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isMobileView, setIsMobileView] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [scale, setScale] = useState<number>(1);
  const [fitScale, setFitScale] = useState<number>(1);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);

  // Touch pinch state
  const touchStateRef = useRef<{
    initialDistance: number | null;
    initialScale: number;
    lastTapTime: number;
  }>({
    initialDistance: null,
    initialScale: 1,
    lastTapTime: 0,
  });

  const activeZoomMode = alwaysZoomable || isMobileView;

  const calculateFit = useCallback(() => {
    if (typeof window === 'undefined') return;
    const mobile = window.innerWidth < 768;
    setIsMobileView(mobile);

    if (!alwaysZoomable && !mobile) {
      setScale(1);
      setFitScale(1);
      return;
    }

    const containerEl = containerRef.current;
    const availableWidth = containerEl
      ? Math.max(containerEl.clientWidth - 16, 260)
      : Math.max(window.innerWidth - 24, 260);

    if (availableWidth < contentWidth) {
      const calculated = Math.max(minScale, Number((availableWidth / contentWidth).toFixed(3)));
      setFitScale(calculated);
      if (autoFitMobile) {
        setScale(calculated);
      }
    } else {
      setFitScale(1);
      setScale(1);
    }
  }, [alwaysZoomable, autoFitMobile, contentWidth, minScale]);

  // Measure natural height of inner content so scaled container has exact height (no giant blank space below)
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const updateHeight = () => {
      if (contentRef.current) {
        setNaturalHeight(contentRef.current.scrollHeight || contentRef.current.offsetHeight);
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, activeZoomMode]);

  useEffect(() => {
    calculateFit();
    const timer = setTimeout(calculateFit, 120);
    window.addEventListener('resize', calculateFit);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateFit);
    };
  }, [calculateFit]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!activeZoomableCheck()) return;

    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStateRef.current.initialDistance = Math.hypot(dx, dy);
      touchStateRef.current.initialScale = scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const delta = now - touchStateRef.current.lastTapTime;
      if (delta > 0 && delta < 280) {
        // Double tap toggles between Fit-to-Screen and 100% readable zoom
        setScale((prev) => (Math.abs(prev - fitScale) < 0.08 ? Math.min(1.15, maxScale) : fitScale));
        touchStateRef.current.lastTapTime = 0;
      } else {
        touchStateRef.current.lastTapTime = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!activeZoomableCheck()) return;

    if (e.touches.length === 2 && touchStateRef.current.initialDistance !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.hypot(dx, dy);
      const ratio = currentDistance / touchStateRef.current.initialDistance;
      const nextScale = Math.min(
        maxScale,
        Math.max(minScale, Number((touchStateRef.current.initialScale * ratio).toFixed(3)))
      );
      setScale(nextScale);
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current.initialDistance = null;
  };

  function activeZoomableCheck() {
    return alwaysZoomable || isMobileView;
  }

  // On desktop when alwaysZoomable is false, render children directly without altering desktop layout
  if (!activeZoomMode) {
    return <div className={className}>{children}</div>;
  }

  const scaledWidth = Math.round(contentWidth * scale);
  const scaledHeight = naturalHeight > 0 ? Math.round(naturalHeight * scale) : undefined;
  const zoomPercent = Math.round(scale * 100);

  return (
    <div className={`flex flex-col w-full max-w-full ${className}`}>
      {showToolbar && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 mb-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs select-none no-print">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
            <Hand size={13} className="text-indigo-500 shrink-0" />
            <span className="text-[11px]">زوم دو انگشتی یا دو بار لمس</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(minScale, Number((s - 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 active:scale-95 transition-transform"
              title="کوچک‌نمایی"
            >
              <ZoomOut size={14} />
            </button>

            <span className="min-w-[44px] text-center font-mono font-bold text-[11px] text-slate-700 dark:text-slate-200">
              {zoomPercent}%
            </span>

            <button
              type="button"
              onClick={() => setScale((s) => Math.min(maxScale, Number((s + 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 active:scale-95 transition-transform"
              title="بزرگ‌نمایی"
            >
              <ZoomIn size={14} />
            </button>

            <button
              type="button"
              onClick={() => setScale(fitScale)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                Math.abs(scale - fitScale) < 0.03
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
              }`}
              title="برازش کل جدول در صفحه"
            >
              <Maximize2 size={12} />
              <span>کل صفحه</span>
            </button>

            <button
              type="button"
              onClick={() => setScale(1)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                Math.abs(scale - 1) < 0.03
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
              }`}
              title="اندازه واقعی ۱۰۰٪"
            >
              <RotateCcw size={12} />
              <span>۱۰۰٪</span>
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="w-full max-w-full overflow-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 touch-pan-x touch-pan-y"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        <div
          style={{
            width: `${scaledWidth}px`,
            height: scaledHeight ? `${scaledHeight}px` : 'auto',
            margin: '0 auto',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            ref={contentRef}
            dir="rtl"
            style={{
              width: `${contentWidth}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top right',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
