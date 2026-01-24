import { extractColors, extractTypography, extractSpacing } from './parser';

interface FigmaFile {
  document: {
    children: unknown[];
  };
}

interface FontInfo {
  family: string;
  weight: number;
  size: number;
  lineHeight?: number;
  letterSpacing?: number;
}

interface DesignSystem {
  colors: Record<string, string>;
  typography: Record<string, {
    fontFamily: string;
    fontWeight: number;
    fontSize: string;
    lineHeight?: string;
    letterSpacing?: string;
  }>;
  spacing: Record<string, string>;
}

export function generateDesignSystem(figmaFile: FigmaFile): DesignSystem {
  const document = figmaFile.document;
  
  const colors = extractColors(document as never);
  const typography = extractTypography(document as never);
  const spacing = extractSpacing(document as never);

  return {
    colors: generateColorTokens(colors),
    typography: generateTypographyTokens(typography),
    spacing: generateSpacingTokens(spacing)
  };
}

function generateColorTokens(colors: string[]): Record<string, string> {
  const tokens: Record<string, string> = {};
  
  colors.forEach((color, i) => {
    tokens[`color-${i + 1}`] = color;
  });

  return tokens;
}

function generateTypographyTokens(fonts: FontInfo[]): Record<string, {
  fontFamily: string;
  fontWeight: number;
  fontSize: string;
  lineHeight?: string;
  letterSpacing?: string;
}> {
  const tokens: Record<string, {
    fontFamily: string;
    fontWeight: number;
    fontSize: string;
    lineHeight?: string;
    letterSpacing?: string;
  }> = {};
  
  fonts.forEach((font, i) => {
    tokens[`font-${i + 1}`] = {
      fontFamily: font.family,
      fontWeight: font.weight,
      fontSize: `${font.size}px`,
      lineHeight: font.lineHeight ? `${font.lineHeight}px` : undefined,
      letterSpacing: font.letterSpacing ? `${font.letterSpacing}px` : undefined
    };
  });

  return tokens;
}

function generateSpacingTokens(spacings: number[]): Record<string, string> {
  const tokens: Record<string, string> = {};
  
  spacings.forEach((spacing, i) => {
    tokens[`spacing-${i + 1}`] = `${spacing}px`;
  });

  return tokens;
}

export function generateTailwindConfig(designSystem: DesignSystem): {
  theme: {
    extend: {
      colors: Record<string, string>;
      spacing: Record<string, string>;
    };
  };
} {
  return {
    theme: {
      extend: {
        colors: designSystem.colors,
        spacing: designSystem.spacing
      }
    }
  };
}