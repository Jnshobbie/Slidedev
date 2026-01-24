interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface FigmaFill {
  type: string;
  color?: FigmaColor;
}

interface FigmaNode {
  type?: string;
  name?: string;
  fills?: FigmaFill[];
  strokes?: FigmaFill[];
  children?: FigmaNode[];
  style?: {
    fontFamily?: string;
    fontWeight?: number;
    fontSize?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
  };
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
}

export function extractColors(node: FigmaNode, colors = new Set<string>()): string[] {
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.color) {
        const { r, g, b, a = 1 } = fill.color;
        const hex = rgbaToHex(r, g, b, a);
        colors.add(hex);
      }
    }
  }

  if (node.strokes) {
    for (const stroke of node.strokes) {
      if (stroke.type === 'SOLID' && stroke.color) {
        const { r, g, b, a = 1 } = stroke.color;
        const hex = rgbaToHex(r, g, b, a);
        colors.add(hex);
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      extractColors(child, colors);
    }
  }

  return Array.from(colors);
}

interface FontInfo {
  family: string;
  weight: number;
  size: number;
  lineHeight?: number;
  letterSpacing?: number;
}

export function extractTypography(node: FigmaNode, fonts = new Map<string, FontInfo>()): FontInfo[] {
  if (node.type === 'TEXT' && node.style) {
    const key = `${node.style.fontFamily}-${node.style.fontWeight}`;
    if (!fonts.has(key)) {
      fonts.set(key, {
        family: node.style.fontFamily || 'Inter',
        weight: node.style.fontWeight || 400,
        size: node.style.fontSize || 16,
        lineHeight: node.style.lineHeightPx,
        letterSpacing: node.style.letterSpacing
      });
    }
  }

  if (node.children) {
    for (const child of node.children) {
      extractTypography(child, fonts);
    }
  }

  return Array.from(fonts.values());
}

export function extractSpacing(node: FigmaNode, spacings = new Set<number>()): number[] {
  if (node.paddingLeft) spacings.add(node.paddingLeft);
  if (node.paddingRight) spacings.add(node.paddingRight);
  if (node.paddingTop) spacings.add(node.paddingTop);
  if (node.paddingBottom) spacings.add(node.paddingBottom);
  if (node.itemSpacing) spacings.add(node.itemSpacing);

  if (node.children) {
    for (const child of node.children) {
      extractSpacing(child, spacings);
    }
  }

  return Array.from(spacings).sort((a, b) => a - b);
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a < 1 ? `${hex}${toHex(a)}` : hex;
} 