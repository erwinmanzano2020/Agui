"use client";

import Link from "next/link";
import {
  CSSProperties,
  cloneElement,
  forwardRef,
  isValidElement,
  memo,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  LAUNCHER_DOCK_ICON_CLASS,
  LUCIDE_STROKE_WIDTH,
} from "@/components/icons/lucide";
import { useTooltipPosition } from "@/hooks/use-tooltip-position";
import { cn } from "@/lib/utils";
import {
  resolveTooltipPlacement,
  type TooltipPlacement,
} from "@/lib/tooltip-placement";

export type AppTileVariant = "auto" | "black" | "pearl" | "charcoal" | "white";

export interface AppTileProps {
  icon: ReactNode;
  label: string;
  href: string;
  description?: string;
  variant?: AppTileVariant;
  className?: string;
  tabIndex?: number;
  onFocus?: FocusEventHandler<HTMLAnchorElement>;
  onBlur?: FocusEventHandler<HTMLAnchorElement>;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
}

type VariantStyles = {
  icon: string;
  label: string;
  ring: string;
  ringOffset: string;
  tooltipBg?: string;
  tooltipColor?: string;
  cssVars?: Record<string, string>;
};

const AUTO_TILE_VARS: Record<string, string> = {
  "--tile-foreground": "var(--launcher-tile-foreground, #1b1c1f)",
  "--tile-icon-border": "var(--launcher-icon-border, rgba(27,28,31,0.1))",
  "--tile-icon-background": "var(--launcher-icon-background, #eef1f6)",
  "--tile-icon-color": "var(--launcher-icon-color, #1b1c1f)",
};

const VARIANT_STYLES: Record<AppTileVariant, VariantStyles> = {
  auto: {
    icon:
      "border-[color:var(--tile-icon-border)] bg-[color:var(--tile-icon-background)] text-[color:var(--tile-icon-color)]",
    label: "text-[color:var(--tile-foreground)]",
    ring: "var(--launcher-tile-ring, var(--agui-ring, rgba(59,130,246,0.32)))",
    ringOffset: "var(--launcher-tile-ring-offset, #eef1f6)",
    tooltipBg: "var(--launcher-tooltip-background, rgba(15,23,42,0.78))",
    tooltipColor: "var(--launcher-tooltip-color, #f6f8fb)",
    cssVars: AUTO_TILE_VARS,
  },
  black: {
    icon:
      "border-white/10 bg-neutral-950 text-white shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
    label: "text-white",
    ring: "rgba(255,255,255,0.55)",
    ringOffset: "rgba(11,11,15,0.9)",
    tooltipBg: "rgba(17,17,20,0.92)",
    tooltipColor: "#f9fafb",
  },
  pearl: {
    icon:
      "border-[#d7dbe3] bg-[#f6f8fb] text-[#1b1c1f] shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.65)]",
    label: "text-[#1b1c1f]/90",
    ring: "rgba(27,28,31,0.45)",
    ringOffset: "#f6f8fb",
    tooltipBg: "rgba(31,41,55,0.92)",
    tooltipColor: "#f6f8fb",
  },
  charcoal: {
    icon:
      "border-white/12 bg-[#1f1f23] text-white shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]",
    label: "text-white",
    ring: "rgba(255,255,255,0.45)",
    ringOffset: "#1f1f23",
    tooltipBg: "rgba(23,25,32,0.96)",
    tooltipColor: "#f5f5f8",
  },
  white: {
    icon:
      "border-neutral-200 bg-white text-neutral-900 shadow-[0_6px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.65)]",
    label: "text-neutral-900",
    ring: "rgba(28,28,28,0.45)",
    ringOffset: "#ffffff",
    tooltipBg: "rgba(17,24,39,0.92)",
    tooltipColor: "#f8fafc",
  },
};

function enhanceIcon(icon: ReactNode): ReactNode {
  if (!isValidElement(icon)) {
    return icon;
  }

  const element = icon as ReactElement<{ className?: string; strokeWidth?: number; color?: string }>;

  return cloneElement(element, {
    className: cn(element.props.className),
    strokeWidth:
      typeof element.props.strokeWidth === "number"
        ? element.props.strokeWidth
        : LUCIDE_STROKE_WIDTH,
    color: element.props.color ?? "currentColor",
  });
}

const AppTileBase = forwardRef<HTMLAnchorElement, AppTileProps>(
  (
    {
      icon,
      label,
      href,
      description,
      variant = "auto",
      className,
      tabIndex,
      onFocus,
      onBlur,
      onKeyDown,
    },
    ref
  ) => {
    const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.auto;
    const tooltipStyle = useMemo(() => {
      const style: Record<string, string> = {};

      if (styles.tooltipBg) {
        style["--agui-tip-bg"] = styles.tooltipBg;
      }

      if (styles.tooltipColor) {
        style["--agui-tip-fg"] = styles.tooltipColor;
      }

      return style;
    }, [styles.tooltipBg, styles.tooltipColor]);
    const [isTooltipVisible, setTooltipVisible] = useState(false);
    const [isCoarsePointer, setIsCoarsePointer] = useState(() => {
      if (typeof window === "undefined") {
        return false;
      }

      return window.matchMedia("(pointer: coarse)").matches;
    });
    const showTimerRef = useRef<number | null>(null);

    const shouldRenderTooltip = Boolean(description) && !isCoarsePointer;
    const iconContainerRef = useRef<HTMLDivElement | null>(null);
    const { ref: tooltipRef, inlineOffset, update: updateTooltipInlineOffset } =
      useTooltipPosition<HTMLDivElement>({
        open: isTooltipVisible && shouldRenderTooltip,
        gap: 12,
        contentKey: shouldRenderTooltip ? description : undefined,
      });
    const [placement, setPlacement] = useState<TooltipPlacement>("top");

    const updatePlacement = useCallback(() => {
      if (!shouldRenderTooltip || typeof window === "undefined") {
        return;
      }

      const trigger = iconContainerRef.current;
      const tooltipNode = tooltipRef.current;

      if (!trigger || !tooltipNode) {
        return;
      }

      const nextPlacement = resolveTooltipPlacement(trigger, tooltipNode, {
        gap: 12,
        viewportPadding: 12,
      });

      setPlacement((current) => (current === nextPlacement ? current : nextPlacement));
    }, [shouldRenderTooltip, tooltipRef]);

    const handleTooltipMetrics = useCallback(() => {
      updatePlacement();
      updateTooltipInlineOffset();
    }, [updatePlacement, updateTooltipInlineOffset]);

    const clearShowTimer = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };

    const showTooltip = () => {
      if (!shouldRenderTooltip) {
        return;
      }

      clearShowTimer();
      showTimerRef.current = window.setTimeout(() => {
        setTooltipVisible(true);
        showTimerRef.current = null;
      }, 120);
    };

    const hideTooltip = () => {
      clearShowTimer();
      setTooltipVisible(false);
    };

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }

      const mediaQuery = window.matchMedia("(pointer: coarse)");
      const update = () => setIsCoarsePointer(mediaQuery.matches);

      update();

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", update);
        return () => {
          mediaQuery.removeEventListener("change", update);
        };
      }

      mediaQuery.addListener(update);
      return () => {
        mediaQuery.removeListener(update);
      };
    }, []);

    useEffect(() => {
      if (!isCoarsePointer) {
        return;
      }

      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      setTooltipVisible(false);
    }, [isCoarsePointer]);

    useEffect(() => {
      return () => {
        if (showTimerRef.current !== null) {
          window.clearTimeout(showTimerRef.current);
        }
      };
    }, []);

    const enhancedIcon = useMemo(() => enhanceIcon(icon), [icon]);
    const tooltipInlineStyles = useMemo(() => {
      const style: Record<string, string | number> = {
        "--agui-tip-gap": "12px",
        marginLeft: inlineOffset,
      };

      for (const [key, value] of Object.entries(tooltipStyle)) {
        style[key] = value;
      }

      return style as CSSProperties;
    }, [inlineOffset, tooltipStyle]);
    const tooltipId = description
      ? `${label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}-tooltip`
      : undefined;

    useLayoutEffect(() => {
      if (!isTooltipVisible || !shouldRenderTooltip) {
        return;
      }

      handleTooltipMetrics();

      window.addEventListener("resize", handleTooltipMetrics);
      window.addEventListener("scroll", handleTooltipMetrics, true);

      return () => {
        window.removeEventListener("resize", handleTooltipMetrics);
        window.removeEventListener("scroll", handleTooltipMetrics, true);
      };
    }, [description, handleTooltipMetrics, isTooltipVisible, shouldRenderTooltip]);

    return (
      <div className="relative inline-block z-[30]">
        <Link
          href={href}
          ref={ref}
          tabIndex={tabIndex}
          className={cn(
            "group inline-flex flex-col items-center gap-2 text-center outline-none",
            className,
          )}
          style={
            {
              "--tile-ring": styles.ring,
              "--tile-ring-offset": styles.ringOffset,
              ...(styles.cssVars ?? {}),
            } as CSSProperties
          }
          onPointerEnter={(event) => {
            if (event.pointerType === "touch") {
              return;
            }
            showTooltip();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "touch") return;
            if (event.currentTarget === document.activeElement) {
              return;
            }
            hideTooltip();
          }}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) {
              showTooltip();
            }
            onFocus?.(event);
          }}
          onBlur={(event) => {
            hideTooltip();
            onBlur?.(event);
          }}
          onPointerDown={() => {
            hideTooltip();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              hideTooltip();
            }
            onKeyDown?.(event);
          }}
          aria-describedby={isTooltipVisible && shouldRenderTooltip ? tooltipId : undefined}
        >
          <div ref={iconContainerRef} className="relative flex justify-center">
            <span
              className={cn(
                "grid h-[60px] w-[60px] place-items-center rounded-2xl border text-[color:inherit] shadow-[inset_0_1px_0_rgba(255,255,255,.65),0_6px_20px_rgba(0,0,0,.12)]",
                "transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0",
                "active:scale-95 motion-reduce:active:scale-100",
                "group-focus-visible:ring-2 group-focus-visible:ring-[color:var(--tile-ring)] group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-[color:var(--tile-ring-offset)]",
                styles.icon,
              )}
              aria-hidden
            >
              <span className={cn("[&>*]:h-7 [&>*]:w-7 [&>*]:stroke-[1.5]", LAUNCHER_DOCK_ICON_CLASS)}>
                {enhancedIcon}
              </span>
            </span>
            {shouldRenderTooltip ? (
              <div
                id={tooltipId}
                role="tooltip"
                ref={tooltipRef}
                aria-hidden={!isTooltipVisible}
                data-placement={placement}
                className={cn(
                  "agui-tip left-1/2 -translate-x-1/2 select-none",
                  "absolute transition-[opacity,transform] duration-150 motion-reduce:transition-none motion-reduce:duration-0",
                  isTooltipVisible
                    ? "opacity-100 translate-y-0"
                    : placement === "top"
                      ? "opacity-0 translate-y-[4px]"
                      : "opacity-0 -translate-y-[4px]",
                )}
                style={tooltipInlineStyles}
              >
                {description}
              </div>
            ) : null}
          </div>
          <span
            className={cn(
              "max-w-[8.5rem] text-[13px] tracking-wide",
              "text-balance text-center font-medium leading-[1.35]",
              "[display:-webkit-box] min-h-[2.75rem] [overflow:hidden] [WebkitBoxOrient:vertical] [WebkitLineClamp:2]",
              styles.label,
            )}
          >
            {label}
          </span>
        </Link>
      </div>
    );
  }
);

AppTileBase.displayName = "AppTile";

export const AppTile = memo(
  AppTileBase,
  (prev, next) => {
    return (
      prev.href === next.href &&
      prev.label === next.label &&
      prev.description === next.description &&
      prev.variant === next.variant &&
      prev.className === next.className &&
      prev.tabIndex === next.tabIndex &&
      prev.onFocus === next.onFocus &&
      prev.onBlur === next.onBlur &&
      prev.onKeyDown === next.onKeyDown
    );
  }
);

AppTile.displayName = "AppTile";
