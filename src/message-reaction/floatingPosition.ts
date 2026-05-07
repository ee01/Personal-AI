export type FloatingPlacement = 'above' | 'below';
export type FloatingAlignment = 'left' | 'right';

export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface FloatingSize {
  width: number;
  height: number;
}

export interface FloatingViewport {
  width: number;
  height: number;
}

export interface FloatingPositionOptions {
  align?: FloatingAlignment;
  gap?: number;
  margin?: number;
}

export interface FloatingPosition {
  left: number;
  top: number;
  placement: FloatingPlacement;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeFloatingPosition(
  anchorRect: RectLike,
  floatingSize: FloatingSize,
  viewport: FloatingViewport,
  options: FloatingPositionOptions = {},
): FloatingPosition {
  const align = options.align || 'left';
  const gap = options.gap ?? 4;
  const margin = options.margin ?? 10;
  const maxLeft = Math.max(
    margin,
    viewport.width - floatingSize.width - margin,
  );
  const maxTop = Math.max(
    margin,
    viewport.height - floatingSize.height - margin,
  );

  const rawLeft =
    align === 'right'
      ? anchorRect.right - floatingSize.width
      : anchorRect.left;
  const left = clamp(rawLeft, margin, maxLeft);

  const belowTop = anchorRect.bottom + gap;
  const aboveTop = anchorRect.top - floatingSize.height - gap;
  let placement: FloatingPlacement = 'below';
  let top = belowTop;

  if (belowTop + floatingSize.height > viewport.height - margin) {
    placement = 'above';
    top = aboveTop;
  }

  if (top < margin) {
    const belowFits = belowTop + floatingSize.height <= viewport.height - margin;
    if (placement === 'above' && belowFits) {
      placement = 'below';
      top = belowTop;
    } else {
      top = clamp(top, margin, maxTop);
    }
  }

  return { left, top, placement };
}
