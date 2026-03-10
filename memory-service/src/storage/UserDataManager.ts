import fs from 'node:fs';
import path from 'node:path';

/**
 * Subdirectory structure for the user data directory.
 */
const DIRECTORY_TREE = [
  'daily',
  'projects',
  'entities/people',
  'entities/topics',
  'entities/organizations',
  'entities/technologies',
  'skills',
  'reflections',
  'dreams',
  'reports',
  'agent',
] as const;

/**
 * Entity type to subdirectory mapping.
 */
const ENTITY_TYPE_DIRS: Record<string, string> = {
  person: 'entities/people',
  people: 'entities/people',
  topic: 'entities/topics',
  organization: 'entities/organizations',
  technology: 'entities/technologies',
};

const CORE_MEMORY_TEMPLATE = `# Core Memory

> This file contains persistent high-level facts about the user.
> Updated automatically by the memory service during consolidation.

## Identity

- Name:
- Role:
- Organization:

## Preferences

## Key Projects

## Important People

## Notes

`;

const WATCHED_PROJECTS_TEMPLATE = `# Watched Projects

> Projects the memory service is actively tracking.
> Edit this file or use the API to add/remove watched projects.

## Active Projects

<!-- Add projects here in the format:
### Project Name
- **Aliases**: other-name, short-name
- **Description**: Brief description
- **Priority**: 1-10 (higher = more important)
- **Auto-capture rules**: keywords, channels, etc.
-->

`;

/**
 * Manages the Markdown-based user data directory structure.
 * Responsible for creating and maintaining the filesystem layout
 * where daily logs, entity profiles, project summaries, and
 * consolidation outputs are stored as Markdown files.
 */
export class UserDataManager {
  private dataDir: string = '';
  private initialized = false;

  /**
   * Initialize the data directory structure.
   * Creates all required subdirectories and seed files if they do not exist.
   */
  initialize(dataDir: string): void {
    this.dataDir = dataDir;

    // Create the root data directory if needed
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create all subdirectories
    for (const dir of DIRECTORY_TREE) {
      const fullPath = path.join(dataDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }

    // Create seed files
    this.ensureFile(
      path.join(dataDir, 'CORE_MEMORY.md'),
      CORE_MEMORY_TEMPLATE
    );

    this.ensureFile(
      path.join(dataDir, 'WATCHED_PROJECTS.md'),
      WATCHED_PROJECTS_TEMPLATE
    );

    this.initialized = true;
    console.log(`[UserDataManager] Initialized data directory: ${dataDir}`);
  }

  /**
   * Get the path for a daily log file.
   *
   * @param date - The date for the log entry
   * @returns Relative path like "daily/2024-01-15.md"
   *
   * Example:
   *   getDailyLogPath(new Date('2024-01-15'))  // => "daily/2024-01-15.md"
   */
  getDailyLogPath(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `daily/${year}-${month}-${day}.md`;
  }

  /**
   * Get the path for an entity Markdown file.
   *
   * @param type - Entity type (person, topic, organization, technology)
   * @param slug - URL-safe slug for the entity name (e.g., "john-doe")
   * @returns Relative path like "entities/people/john-doe.md"
   */
  getEntityPath(type: string, slug: string): string {
    const dir = ENTITY_TYPE_DIRS[type.toLowerCase()];
    if (!dir) {
      // Fallback: use type as directory name directly
      return `entities/${type.toLowerCase()}/${slug}.md`;
    }
    return `${dir}/${slug}.md`;
  }

  /**
   * Get the path for a project summary file.
   *
   * @param slug - URL-safe slug for the project name (e.g., "project-alpha")
   * @returns Relative path like "projects/project-alpha.md"
   */
  getProjectPath(slug: string): string {
    return `projects/${slug}.md`;
  }

  /**
   * Get the absolute path for a relative data path.
   *
   * @param relativePath - Path relative to the data directory
   * @returns Absolute filesystem path
   */
  getAbsolutePath(relativePath: string): string {
    this.assertInitialized();
    return path.join(this.dataDir, relativePath);
  }

  /**
   * Create a file with the given template content if it does not already exist.
   * Parent directories are created as needed.
   *
   * @param filePath - Absolute path to the file
   * @param template - Content to write if the file does not exist
   * @returns true if the file was created, false if it already existed
   */
  ensureFile(filePath: string, template: string): boolean {
    // Ensure the parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(filePath)) {
      return false;
    }

    fs.writeFileSync(filePath, template, 'utf-8');
    return true;
  }

  /**
   * Read a file from the data directory.
   *
   * @param relativePath - Path relative to the data directory
   * @returns File contents, or null if the file does not exist
   */
  readFile(relativePath: string): string | null {
    this.assertInitialized();
    const fullPath = path.join(this.dataDir, relativePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  /**
   * Write content to a file in the data directory.
   * Creates parent directories as needed.
   *
   * @param relativePath - Path relative to the data directory
   * @param content - Content to write
   */
  writeFile(relativePath: string, content: string): void {
    this.assertInitialized();
    const fullPath = path.join(this.dataDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  /**
   * Append content to a file in the data directory.
   * Creates the file (with optional header) if it does not exist.
   *
   * @param relativePath - Path relative to the data directory
   * @param content - Content to append
   * @param headerIfNew - Optional header template if the file needs to be created
   */
  appendToFile(relativePath: string, content: string, headerIfNew?: string): void {
    this.assertInitialized();
    const fullPath = path.join(this.dataDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(fullPath) && headerIfNew) {
      fs.writeFileSync(fullPath, headerIfNew + '\n' + content, 'utf-8');
    } else {
      fs.appendFileSync(fullPath, content, 'utf-8');
    }
  }

  /**
   * List all files in a subdirectory of the data directory.
   *
   * @param relativePath - Path relative to the data directory
   * @returns Array of filenames, or empty array if directory does not exist
   */
  listFiles(relativePath: string): string[] {
    this.assertInitialized();
    const fullPath = path.join(this.dataDir, relativePath);
    if (!fs.existsSync(fullPath)) {
      return [];
    }
    return fs.readdirSync(fullPath).filter((f) => {
      const stat = fs.statSync(path.join(fullPath, f));
      return stat.isFile();
    });
  }

  /** The root data directory path */
  get rootDir(): string {
    return this.dataDir;
  }

  /** Whether initialize() has been called */
  get isInitialized(): boolean {
    return this.initialized;
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        '[UserDataManager] Not initialized. Call initialize(dataDir) first.'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Deprecated singleton — will be removed once all consumers migrate to
// per-user contexts via UserContextManager.
// ---------------------------------------------------------------------------

/** @deprecated Use UserContextManager.getContext(userId).userDataManager instead. */
export function getUserDataManager(): UserDataManager {
  throw new Error(
    '[UserDataManager] getUserDataManager() singleton is removed. ' +
      'Use UserContextManager.getContext(userId).userDataManager instead.',
  );
}
