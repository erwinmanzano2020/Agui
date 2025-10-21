export type TooltipPlacement = "top" | "bottom";

type ResolveOptions = {
  /** Minimum gap between the trigger and the tooltip. */
  gap?: number;
  /** Padding applied to the viewport edges before flipping. */
  viewportPadding?: number;
};

/**
 * Returns a preferred tooltip placement based on the available vertical space.
 * The logic intentionally favours the "top" placement to match launcher
 * expectations, and only flips to "bottom" when there simply isn't enough room
 * above the trigger element. When both directions are constrained we fall back
 * to the side with more space which keeps the tooltip visible.
 */
export function resolveTooltipPlacement(
  trigger: HTMLElement,
  tooltip: HTMLElement,
  { gap = 12, viewportPadding = 8 }: ResolveOptions = {}
): TooltipPlacement {
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipHeight = tooltip.offsetHeight;
  const availableAbove = triggerRect.top - viewportPadding;
  const requiredSpace = tooltipHeight + gap;

  if (availableAbove >= requiredSpace) {
    return "top";
  }

  const viewportHeight = window.innerHeight;
  const availableBelow = viewportHeight - triggerRect.bottom - viewportPadding;

  if (availableBelow >= requiredSpace) {
    return "bottom";
  }

  return availableAbove >= availableBelow ? "top" : "bottom";
}
