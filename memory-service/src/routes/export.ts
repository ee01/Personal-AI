/**
 * Export route.
 *
 * POST /export - exports memory data as a list of markdown files
 * with metadata.  Phase 4 returns a JSON manifest; actual zip
 * packaging is deferred to Phase 5.
 */

import type { FastifyInstance } from 'fastify';

import type { UserDataManager } from '../storage/UserDataManager.js';

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface ExportBody {
  format?: 'markdown_zip';
  scope?: 'all' | 'project';
  projectId?: string;
  timeRange?: { start: number; end: number };
}

interface ExportResponse {
  files: string[];
  totalFiles: number;
  dataDir: string;
}

// ---------------------------------------------------------------------------
// JSON schema for Fastify validation
// ---------------------------------------------------------------------------

const exportBodySchema = {
  type: 'object' as const,
  properties: {
    format: {
      type: 'string' as const,
      enum: ['markdown_zip'],
      default: 'markdown_zip',
    },
    scope: {
      type: 'string' as const,
      enum: ['all', 'project'],
      default: 'all',
    },
    projectId: { type: 'string' as const },
    timeRange: {
      type: 'object' as const,
      properties: {
        start: { type: 'number' as const },
        end: { type: 'number' as const },
      },
    },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect all file paths under the given subdirectories
 * using the UserDataManager.
 */
function collectFiles(
  udm: UserDataManager,
  subdirs: readonly string[],
): string[] {
  const files: string[] = [];

  for (const subdir of subdirs) {
    try {
      const entries = udm.listFiles(subdir);
      for (const entry of entries) {
        files.push(`${subdir}/${entry}`);
      }
    } catch {
      // Directory may not exist yet — skip silently.
    }
  }

  // Also collect root-level markdown files (CORE_MEMORY.md, etc.)
  try {
    const rootFiles = udm.listFiles('.');
    for (const f of rootFiles) {
      if (f.endsWith('.md')) {
        files.push(f);
      }
    }
  } catch {
    // Ignore if root listing fails.
  }

  return files;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

/** All subdirectories that may contain markdown data files. */
const DATA_SUBDIRS = [
  'daily',
  'projects',
  'entities/people',
  'entities/topics',
  'entities/organizations',
  'entities/technologies',
  'skills',
  'reflections',
  'dreams',
] as const;

export async function exportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{ Body: ExportBody }>(
    '/export',
    {
      schema: {
        body: exportBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              files: { type: 'array', items: { type: 'string' } },
              totalFiles: { type: 'number' },
              dataDir: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const udm = request.userContext.userDataManager;

      if (!udm.isInitialized) {
        return reply.status(503).send({
          error: 'UserDataManager not initialized',
          files: [],
          totalFiles: 0,
          dataDir: '',
        });
      }

      const body = request.body ?? {};
      const scope = body.scope ?? 'all';

      let files: string[];

      if (scope === 'project' && body.projectId) {
        // Scope down to a single project directory
        files = collectFiles(udm, [`projects`]);
        files = files.filter((f) =>
          f.toLowerCase().includes(body.projectId!.toLowerCase()),
        );
      } else {
        // Export everything
        files = collectFiles(udm, DATA_SUBDIRS);
      }

      // If a time range is provided, filter daily logs by filename date
      if (body.timeRange) {
        const { start, end } = body.timeRange;
        files = files.filter((f) => {
          // Only filter daily/ files by date; include all others
          if (!f.startsWith('daily/')) return true;

          // Extract date from filename like "daily/2024-01-15.md"
          const match = f.match(/(\d{4}-\d{2}-\d{2})/);
          if (!match) return true;

          const fileTs = Math.floor(new Date(match[1]).getTime() / 1000);
          if (start && fileTs < start) return false;
          if (end && fileTs > end) return false;
          return true;
        });
      }

      const response: ExportResponse = {
        files,
        totalFiles: files.length,
        dataDir: udm.rootDir,
      };

      return reply.status(200).send(response);
    },
  );
}
