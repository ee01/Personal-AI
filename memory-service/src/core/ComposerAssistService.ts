import type Database from 'better-sqlite3';

import { ContextAssistService } from './ContextAssistService.js';
import type {
  ComposerAssistRequest,
  ComposerAssistResponse,
} from '../types/index.js';

/**
 * Compatibility wrapper for the original Composer Guard API.
 *
 * New surfaces should call ContextAssistService directly. Keeping this class
 * avoids changing existing route imports and content-script callers.
 */
export class ComposerAssistService {
  private readonly contextAssistService: ContextAssistService;

  constructor(db: Database.Database) {
    this.contextAssistService = new ContextAssistService(db);
  }

  async assist(request: ComposerAssistRequest): Promise<ComposerAssistResponse> {
    return this.contextAssistService.assistComposer(request);
  }
}
