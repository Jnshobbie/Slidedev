export interface FigmaImportResult {
    designSystem: {
      colors: Record<string, string>;
      typography: Record<string, {
        fontFamily: string;
        fontWeight: number;
        fontSize: string;
        lineHeight?: string;
        letterSpacing?: string;
      }>;
      spacing: Record<string, string>;
    };
    tailwindConfig: {
      theme: {
        extend: {
          colors: Record<string, string>;
          spacing: Record<string, string>;
        };
      };
    };
    components: Record<string, string>;
    fileName: string;
  }