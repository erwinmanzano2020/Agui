"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

type Options = {
  open: boolean;
  gap?: number;
  contentKey?: string | number | null | undefined;
};

type UseTooltipPositionReturn<T extends HTMLElement> = {
  ref: MutableRefObject<T | null>;
  inlineOffset: number;
  update: () => void;
};

/**
 * Keeps floating tooltips within the viewport by shifting them horizontally
 * when they would otherwise overflow.
 */
export function useTooltipPosition<T extends HTMLElement>(
  { open, gap = 8, contentKey }: Options
): UseTooltipPositionReturn<T> {
  const tooltipRef = useRef<T | null>(null);
  const [inlineOffset, setInlineOffset] = useState(0);

  const update = useCallback(() => {
    const tooltip = tooltipRef.current;
    if (!open || !tooltip) {
      setInlineOffset(0);
      return;
    }

    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    const overflowRight = Math.max(0, rect.right + gap - viewportWidth);
    const overflowLeft = Math.max(0, gap - rect.left);

    if (overflowRight === 0 && overflowLeft === 0) {
      setInlineOffset(0);
      return;
    }

    const nextOffset = overflowLeft - overflowRight;
    setInlineOffset((current) => (current === nextOffset ? current : nextOffset));
  }, [gap, open]);

  useLayoutEffect(() => {
    update();
  }, [update, contentKey]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleResize = () => {
      update();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [open, update]);

  return { ref: tooltipRef, inlineOffset, update };
}
