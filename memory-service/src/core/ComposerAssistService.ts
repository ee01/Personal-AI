import type Database from 'better-sqlite3';

import { ContextAssistService } from './ContextAssistService.js';
import type {
  ComposerAssistRequest,
  ComposerAssistResponse,
} from '../types/index.js';

/**
 * Compose Assist handles input-box assistance only. The old Composer Assist
 * class name remains as a route compatibility wrapper.
 *
 * Meeting prep now belongs to Today Pilot.
 */
export class ComposeAssistService {
  private readonly contextAssistService: ContextAssistService;

  constructor(db: Database.Database, userId = 'default') {
    this.contextAssistService = new ContextAssistService(db, userId);
  }

  async assist(
    request: ComposerAssistRequest,
  ): Promise<ComposerAssistResponse> {
    return this.contextAssistService.assistComposer(request);
  }
}

export class ComposerAssistService extends ComposeAssistService {}
