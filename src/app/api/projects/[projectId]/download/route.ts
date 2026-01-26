import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { BOILERPLATE_FILES } from "@/lib/boilerplate-files";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { userId } = await auth();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get project and verify ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId, userId },
      include: {
        messages: {
          where: { type: "RESULT" },
          include: { fragment: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const fragment = project.messages[0]?.fragment;
    if (!fragment || !fragment.files) {
      return NextResponse.json(
        { error: "No code to download" },
        { status: 404 }
      );
    }

    const files = fragment.files as { [path: string]: string };

    // Create ZIP
    const zip = new JSZip();

    // Add generated files
    Object.entries(files).forEach(([path, content]) => {
      zip.file(path, content);
    });

    // Add boilerplate files (only if they don't exist)
    Object.entries(BOILERPLATE_FILES).forEach(([path, content]) => {
      if (!files[path]) {
        zip.file(path, content);
      }
    });

    // If no package.json exists, generate one from imports
    if (!files['package.json']) {
      const packageJson = generatePackageJson(files);
      zip.file('package.json', JSON.stringify(packageJson, null, 2));
    }

    // Generate ZIP buffer (uint8array for web compatibility)
    const zipBuffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.zip"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to generate download" },
      { status: 500 }
    );
  }
}

// Helper: Generate package.json from imports if AI didn't create one
function generatePackageJson(files: { [path: string]: string }) {
  const imports = new Set<string>();

  // Scan all files for imports
  Object.values(files).forEach((content) => {
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const pkg = match[1];
      // Skip relative imports and Next.js internals
      if (!pkg.startsWith('.') && !pkg.startsWith('@/')) {
        // Extract package name (handle scoped packages)
        const pkgName = pkg.startsWith('@') ? pkg.split('/').slice(0, 2).join('/') : pkg.split('/')[0];
        imports.add(pkgName);
      }
    }
  });

  // Default versions for common packages
  const versionMap: { [key: string]: string } = {
    'next': '15.3.4',
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.263.1',
    'class-variance-authority': '^0.7.0',
    'clsx': '^2.0.0',
    'tailwind-merge': '^2.0.0',
    '@radix-ui/react-slot': '^1.0.2',
    '@radix-ui/react-accordion': '^1.2.11',
    '@radix-ui/react-alert-dialog': '^1.1.14',
    '@radix-ui/react-aspect-ratio': '^1.1.7',
    '@radix-ui/react-avatar': '^1.1.10',
    '@radix-ui/react-checkbox': '^1.3.2',
    '@radix-ui/react-collapsible': '^1.1.11',
    '@radix-ui/react-context-menu': '^2.2.15',
    '@radix-ui/react-dialog': '^1.1.14',
    '@radix-ui/react-dropdown-menu': '^2.1.15',
    '@radix-ui/react-hover-card': '^1.1.14',
    '@radix-ui/react-label': '^2.1.7',
    '@radix-ui/react-menubar': '^1.1.15',
  };

  const dependencies: { [key: string]: string } = {};
  imports.forEach((pkg) => {
    dependencies[pkg] = versionMap[pkg] || 'latest';
  });

  // Always include core dependencies
  const corePackages = ['next', 'react', 'react-dom', 'clsx', 'tailwind-merge'];
  corePackages.forEach((pkg) => {
    if (!dependencies[pkg]) {
      dependencies[pkg] = versionMap[pkg];
    }
  });

  return {
    name: "generated-app",
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies,
    devDependencies: {
      "@types/node": "^20.0.0",
      "@types/react": "^18.2.0",
      "@types/react-dom": "^18.2.0",
      "typescript": "^5.0.0",
      "autoprefixer": "^10.4.16",
      "postcss": "^8.4.31",
      "tailwindcss": "^3.4.0",
      "eslint": "^8.0.0",
      "eslint-config-next": "15.3.4",
    },
  };
}