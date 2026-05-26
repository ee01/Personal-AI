/**
 * User Files routes.
 *
 * GET /user-files/:subdir         — list files in a user data subdirectory
 * GET /user-files/:subdir/:filename — read a specific file's content
 */

import type { FastifyInstance } from 'fastify';

const ALLOWED_SUBDIRS = [
  'dreams',
  'reflections',
  'reflection-threads',
  'rehearsals',
  'reports',
  'delegations',
];

export async function userFilesRoutes(app: FastifyInstance): Promise<void> {
  // GET /user-files/:subdir - list files
  app.get<{ Params: { subdir: string } }>(
    '/user-files/:subdir',
    async (request, reply) => {
      const { userDataManager } = request.userContext;
      const { subdir } = request.params;

      if (!ALLOWED_SUBDIRS.includes(subdir)) {
        return reply.status(400).send({ error: 'Invalid subdirectory' });
      }

      try {
        const files = userDataManager.listFiles(subdir);
        return reply.status(200).send({ files });
      } catch {
        return reply.status(200).send({ files: [] });
      }
    },
  );

  // GET /user-files/:subdir/:filename - read file content
  app.get<{ Params: { subdir: string; filename: string } }>(
    '/user-files/:subdir/:filename',
    async (request, reply) => {
      const { userDataManager } = request.userContext;
      const { subdir, filename } = request.params;

      if (!ALLOWED_SUBDIRS.includes(subdir)) {
        return reply.status(400).send({ error: 'Invalid subdirectory' });
      }

      // Prevent path traversal
      if (filename.includes('..') || filename.includes('/')) {
        return reply.status(400).send({ error: 'Invalid filename' });
      }

      const content = userDataManager.readFile(`${subdir}/${filename}`);
      if (content === null) {
        return reply.status(404).send({ error: 'File not found' });
      }

      return reply.status(200).send({ filename, content });
    },
  );
}
