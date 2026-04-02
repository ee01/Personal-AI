/**
 * TruthMaintainer — bitemporal entity property management with conflict resolution.
 *
 * Handles the lifecycle of entity properties: creation, updates, retractions,
 * confirmations, and proposals. When a property conflict is detected (two sources
 * disagree on the value of the same key), the maintainer uses authority weights
 * and confidence scores to decide which value wins, or escalates to the user via
 * a confirm request.
 *
 * Authority weights reflect the trustworthiness of the information source.
 * The effective weight of a property is:
 *   effectiveWeight = AUTHORITY_WEIGHTS[source_authority] * confidence
 */

import type Database from 'better-sqlite3';
import { ConfirmRequestRepository } from '../repositories/ConfirmRequestRepository.js';
import { now } from '../utils/time.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTHORITY_WEIGHTS: Record<string, number> = {
  'official': 1.0,
  'team_lead': 0.9,
  'pm': 0.85,
  'stakeholder': 0.80,
  'developer': 0.75,
  'peer': 0.7,
  'self': 0.6,
  'hearsay': 0.5,
  'inferred': 0.4,
  'dream': 0.2,
};

const CONFIDENCE_BOOST = 0.1;
const DEFAULT_CONFIDENCE = 0.8;
const DEFAULT_AUTHORITY = 'peer';
const DEFAULT_VALUE_TYPE = 'string';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PropertyChange {
  entityId: string;
  entityName?: string;
  key: string;
  value: string;
  valueType?: string;
  actionType: 'set' | 'update' | 'retract' | 'confirm' | 'propose';
  sourceMessageId?: string;
  sourceAuthor?: string;
  sourceAuthority?: string;
  sourceContext?: string;
  confidence?: number;
  validFrom?: number;
  validTo?: number;
}

export interface PropertyChangeResult {
  action: 'created' | 'updated' | 'superseded' | 'confirmed' | 'disputed' | 'rejected' | 'proposed';
  propertyId: number;
  confirmRequestId?: string;
  notificationId?: string;
}

export interface TimelineEntry {
  propertyId: number;
  entityId: string;
  key: string;
  value: string;
  actionType: string;
  status: string;
  sourceAuthor?: string;
  sourceAuthority?: string;
  confidence: number;
  txStart: number;
  txEnd?: number;
  validFrom?: number;
  validTo?: number;
  supersededBy?: number;
  supersedeReason?: string;
}

interface EntityPropertyRow {
  id: number;
  entity_id: string;
  property_key: string;
  property_value: string;
  value_type: string;
  source_message_id: string | null;
  source_author: string | null;
  source_authority: string | null;
  source_context: string | null;
  valid_from: number | null;
  valid_to: number | null;
  tx_start: number;
  tx_end: number | null;
  confidence: number;
  superseded_by: number | null;
  supersede_reason: string | null;
  is_final: number;
  status: string;
  action_type: string | null;
  depends_on_json: string | null;
  related_property_ids_json: string | null;
}

// ---------------------------------------------------------------------------
// TruthMaintainer
// ---------------------------------------------------------------------------

export class TruthMaintainer {
  private db: Database.Database;
  private userId?: string;
  private confirmRequestRepo: ConfirmRequestRepository;

  constructor(db: Database.Database, userId?: string) {
    this.db = db;
    this.userId = userId;
    this.confirmRequestRepo = new ConfirmRequestRepository(db);
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------

  async processPropertyChange(change: PropertyChange): Promise<PropertyChangeResult> {
    const timestamp = now();
    const confidence = change.confidence ?? DEFAULT_CONFIDENCE;
    const authority = change.sourceAuthority ?? DEFAULT_AUTHORITY;
    const valueType = change.valueType ?? DEFAULT_VALUE_TYPE;

    // Find current active property for this entity+key
    const existing = this.getActivePropertyRow(change.entityId, change.key);

    // --- No existing property ---
    if (!existing) {
      if (change.actionType === 'retract') {
        // Nothing to retract
        return { action: 'rejected', propertyId: -1 };
      }

      if (change.actionType === 'confirm') {
        // Nothing to confirm
        return { action: 'rejected', propertyId: -1 };
      }

      const status = change.actionType === 'propose' ? 'pending_confirm' : 'active';
      const newId = this.insertProperty({
        entityId: change.entityId,
        key: change.key,
        value: change.value,
        valueType,
        sourceMessageId: change.sourceMessageId,
        sourceAuthor: change.sourceAuthor,
        sourceAuthority: authority,
        sourceContext: change.sourceContext,
        validFrom: change.validFrom,
        validTo: change.validTo,
        txStart: timestamp,
        confidence,
        status,
        actionType: change.actionType === 'propose' ? 'set' : change.actionType,
      });

      if (change.actionType === 'propose') {
        const confirmId = this.createConfirmRequest({
          entityId: change.entityId,
          entityName: change.entityName,
          propertyId: newId,
          key: change.key,
          value: change.value,
          sourceAuthor: change.sourceAuthor,
          sourceAuthority: authority,
          context: change.sourceContext,
          timestamp,
        });
        return { action: 'proposed', propertyId: newId, confirmRequestId: confirmId };
      }

      return { action: 'created', propertyId: newId };
    }

    // --- Existing property exists ---
    switch (change.actionType) {
      case 'retract': {
        this.db.prepare(`
          UPDATE entity_properties
          SET status = 'retracted', tx_end = ?, action_type = 'retract'
          WHERE id = ?
        `).run(timestamp, existing.id);

        const notifId = this.createPropertyChangeNotification({
          entityId: change.entityId,
          entityName: change.entityName,
          key: change.key,
          oldValue: existing.property_value,
          newValue: null,
          action: 'retracted',
          sourceAuthor: change.sourceAuthor,
          timestamp,
        });

        return { action: 'superseded', propertyId: existing.id, notificationId: notifId };
      }

      case 'confirm': {
        this.db.prepare(`
          UPDATE entity_properties
          SET is_final = 1, confidence = MIN(1.0, confidence + ?), action_type = 'confirm'
          WHERE id = ?
        `).run(CONFIDENCE_BOOST, existing.id);

        return { action: 'confirmed', propertyId: existing.id };
      }

      case 'propose': {
        const newId = this.insertProperty({
          entityId: change.entityId,
          key: change.key,
          value: change.value,
          valueType,
          sourceMessageId: change.sourceMessageId,
          sourceAuthor: change.sourceAuthor,
          sourceAuthority: authority,
          sourceContext: change.sourceContext,
          validFrom: change.validFrom,
          validTo: change.validTo,
          txStart: timestamp,
          confidence,
          status: 'pending_confirm',
          actionType: 'set',
        });

        const confirmId = this.createConfirmRequest({
          entityId: change.entityId,
          entityName: change.entityName,
          propertyId: newId,
          key: change.key,
          value: change.value,
          oldValue: existing.property_value,
          sourceAuthor: change.sourceAuthor,
          sourceAuthority: authority,
          context: change.sourceContext,
          timestamp,
        });

        return { action: 'proposed', propertyId: newId, confirmRequestId: confirmId };
      }

      case 'set':
      case 'update': {
        // Same value -> boost confidence
        if (existing.property_value === change.value) {
          this.db.prepare(`
            UPDATE entity_properties
            SET confidence = MIN(1.0, confidence + ?)
            WHERE id = ?
          `).run(CONFIDENCE_BOOST, existing.id);

          return { action: 'confirmed', propertyId: existing.id };
        }

        // Different value -> conflict resolution
        return this.handleConflict(existing, change, timestamp);
      }

      default: {
        return { action: 'rejected', propertyId: -1 };
      }
    }
  }

  // -------------------------------------------------------------------------
  // Conflict resolution
  // -------------------------------------------------------------------------

  private handleConflict(
    existing: EntityPropertyRow,
    incoming: PropertyChange,
    timestamp: number,
  ): PropertyChangeResult {
    const existingAuthority = existing.source_authority ?? DEFAULT_AUTHORITY;
    const incomingAuthority = incoming.sourceAuthority ?? DEFAULT_AUTHORITY;
    const incomingConfidence = incoming.confidence ?? DEFAULT_CONFIDENCE;
    const valueType = incoming.valueType ?? DEFAULT_VALUE_TYPE;

    const existingWeight =
      (AUTHORITY_WEIGHTS[existingAuthority] ?? AUTHORITY_WEIGHTS[DEFAULT_AUTHORITY]) *
      existing.confidence;
    const incomingWeight =
      (AUTHORITY_WEIGHTS[incomingAuthority] ?? AUTHORITY_WEIGHTS[DEFAULT_AUTHORITY]) *
      incomingConfidence;

    // If existing is marked as final, only official authority can override
    if (existing.is_final && incomingAuthority !== 'official') {
      // Insert as disputed and create confirm request
      const disputedId = this.insertProperty({
        entityId: incoming.entityId,
        key: incoming.key,
        value: incoming.value,
        valueType,
        sourceMessageId: incoming.sourceMessageId,
        sourceAuthor: incoming.sourceAuthor,
        sourceAuthority: incomingAuthority,
        sourceContext: incoming.sourceContext,
        validFrom: incoming.validFrom,
        validTo: incoming.validTo,
        txStart: timestamp,
        confidence: incomingConfidence,
        status: 'disputed',
        actionType: incoming.actionType,
      });

      const confirmId = this.createConfirmRequest({
        entityId: incoming.entityId,
        entityName: incoming.entityName,
        propertyId: disputedId,
        key: incoming.key,
        value: incoming.value,
        oldValue: existing.property_value,
        sourceAuthor: incoming.sourceAuthor,
        sourceAuthority: incomingAuthority,
        context: incoming.sourceContext,
        isFinalConflict: true,
        timestamp,
      });

      return { action: 'disputed', propertyId: disputedId, confirmRequestId: confirmId };
    }

    // Incoming wins if higher weight or explicit 'update' action
    if (incomingWeight > existingWeight || incoming.actionType === 'update') {
      // Supersede existing
      const newId = this.insertProperty({
        entityId: incoming.entityId,
        key: incoming.key,
        value: incoming.value,
        valueType,
        sourceMessageId: incoming.sourceMessageId,
        sourceAuthor: incoming.sourceAuthor,
        sourceAuthority: incomingAuthority,
        sourceContext: incoming.sourceContext,
        validFrom: incoming.validFrom,
        validTo: incoming.validTo,
        txStart: timestamp,
        confidence: incomingConfidence,
        status: 'active',
        actionType: incoming.actionType,
      });

      this.db.prepare(`
        UPDATE entity_properties
        SET tx_end = ?, status = 'superseded', superseded_by = ?,
            supersede_reason = ?
        WHERE id = ?
      `).run(
        timestamp,
        newId,
        `Superseded by higher-authority source (${incomingAuthority}: ${incomingWeight.toFixed(2)} > ${existingAuthority}: ${existingWeight.toFixed(2)})`,
        existing.id,
      );

      const notifId = this.createPropertyChangeNotification({
        entityId: incoming.entityId,
        entityName: incoming.entityName,
        key: incoming.key,
        oldValue: existing.property_value,
        newValue: incoming.value,
        action: 'superseded',
        sourceAuthor: incoming.sourceAuthor,
        timestamp,
      });

      return { action: 'superseded', propertyId: newId, notificationId: notifId };
    }

    // Existing wins -> insert incoming as disputed
    const disputedId = this.insertProperty({
      entityId: incoming.entityId,
      key: incoming.key,
      value: incoming.value,
      valueType,
      sourceMessageId: incoming.sourceMessageId,
      sourceAuthor: incoming.sourceAuthor,
      sourceAuthority: incomingAuthority,
      sourceContext: incoming.sourceContext,
      validFrom: incoming.validFrom,
      validTo: incoming.validTo,
      txStart: timestamp,
      confidence: incomingConfidence,
      status: 'disputed',
      actionType: incoming.actionType,
    });

    const confirmId = this.createConfirmRequest({
      entityId: incoming.entityId,
      entityName: incoming.entityName,
      propertyId: disputedId,
      key: incoming.key,
      value: incoming.value,
      oldValue: existing.property_value,
      sourceAuthor: incoming.sourceAuthor,
      sourceAuthority: incomingAuthority,
      context: incoming.sourceContext,
      timestamp,
    });

    return { action: 'disputed', propertyId: disputedId, confirmRequestId: confirmId };
  }

  // -------------------------------------------------------------------------
  // Query helpers
  // -------------------------------------------------------------------------

  /**
   * Get the currently active property for an entity+key pair.
   */
  getActiveProperty(entityId: string, key: string): EntityPropertyRow | undefined {
    return this.getActivePropertyRow(entityId, key) ?? undefined;
  }

  private getActivePropertyRow(entityId: string, key: string): EntityPropertyRow | null {
    return (
      this.db
        .prepare(
          `SELECT * FROM entity_properties
           WHERE entity_id = ? AND property_key = ? AND status = 'active' AND tx_end IS NULL
           ORDER BY tx_start DESC
           LIMIT 1`,
        )
        .get(entityId, key) as EntityPropertyRow | undefined
    ) ?? null;
  }

  /**
   * Get full property history for an entity, optionally filtered by key.
   * Returns all versions including superseded and retracted.
   */
  getPropertyHistory(entityId: string, key?: string): EntityPropertyRow[] {
    if (key) {
      return this.db
        .prepare(
          `SELECT * FROM entity_properties
           WHERE entity_id = ? AND property_key = ?
           ORDER BY tx_start DESC`,
        )
        .all(entityId, key) as EntityPropertyRow[];
    }

    return this.db
      .prepare(
        `SELECT * FROM entity_properties
         WHERE entity_id = ?
         ORDER BY property_key ASC, tx_start DESC`,
      )
      .all(entityId) as EntityPropertyRow[];
  }

  /**
   * Get a chronological timeline of all property changes for an entity.
   */
  getEntityTimeline(entityId: string): TimelineEntry[] {
    const rows = this.db
      .prepare(
        `SELECT id, entity_id, property_key, property_value, action_type,
                status, source_author, source_authority, confidence,
                tx_start, tx_end, valid_from, valid_to,
                superseded_by, supersede_reason
         FROM entity_properties
         WHERE entity_id = ?
         ORDER BY tx_start ASC`,
      )
      .all(entityId) as EntityPropertyRow[];

    return rows.map((row) => ({
      propertyId: row.id,
      entityId: row.entity_id,
      key: row.property_key,
      value: row.property_value,
      actionType: row.action_type ?? 'set',
      status: row.status,
      sourceAuthor: row.source_author ?? undefined,
      sourceAuthority: row.source_authority ?? undefined,
      confidence: row.confidence,
      txStart: row.tx_start,
      txEnd: row.tx_end ?? undefined,
      validFrom: row.valid_from ?? undefined,
      validTo: row.valid_to ?? undefined,
      supersededBy: row.superseded_by ?? undefined,
      supersedeReason: row.supersede_reason ?? undefined,
    }));
  }

  // -------------------------------------------------------------------------
  // Profile conflict detection
  // -------------------------------------------------------------------------

  /**
   * Detect conflicts when a new profile item is about to be inserted.
   *
   * Queries user_profile_items for active items with the same item_key but
   * a different item_value. If both the existing and new item have confidence
   * > 0.5, it is considered a genuine conflict and a confirm_request is created
   * asking the user to resolve it.
   *
   * Returns the created confirm_request ID, or null if no conflict.
   */
  detectProfileConflict(
    newItem: { itemKey: string; itemValue: string; confidence: number },
    db: Database.Database,
  ): string | null {
    const existing = db
      .prepare(
        `SELECT id, item_key, item_value, confidence
         FROM user_profile_items
         WHERE item_key = ? AND status = 'active'
         ORDER BY salience_score DESC
         LIMIT 1`,
      )
      .get(newItem.itemKey) as
      | { id: string; item_key: string; item_value: string; confidence: number }
      | undefined;

    if (!existing) return null;

    // No conflict if the values are the same (case-insensitive)
    if (existing.item_value.toLowerCase().trim() === newItem.itemValue.toLowerCase().trim()) {
      return null;
    }

    // Only flag as a genuine conflict if both have confidence > 0.5
    if (existing.confidence <= 0.5 || newItem.confidence <= 0.5) {
      return null;
    }

    // Create a confirm_request for the user to resolve
    const timestamp = now();
    const id = `cr_profile_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;

    const question = `Conflicting profile data detected for '${newItem.itemKey}'`;
    const context = `Previous: ${existing.item_value} (confidence: ${existing.confidence})\nNew: ${newItem.itemValue} (confidence: ${newItem.confidence})`;
    const options = JSON.stringify([
      { label: 'Keep previous', value: 'keep_old' },
      { label: 'Accept new', value: 'accept_new' },
      { label: 'Keep both', value: 'keep_both' },
    ]);
    const result = this.confirmRequestRepo.createOrReusePending({
      id,
      question,
      context,
      options: JSON.parse(options) as Array<{ label: string; value: string }>,
      category: 'profile_conflict',
      relatedEntityId: existing.id,
      priority: 'normal',
      createdAt: timestamp,
    });

    return result.record.id;
  }

  /**
   * Resolve a confirm request with the user's answer.
   *
   * If the answer accepts the disputed/proposed property, the old active
   * property is superseded. If the answer rejects it, the disputed property
   * is retracted.
   */
  resolveConfirmRequest(requestId: string, answer: string, detail?: string): void {
    const timestamp = now();

    const request = this.db
      .prepare(`SELECT * FROM confirm_requests WHERE id = ?`)
      .get(requestId) as {
      id: string;
      related_entity_id: string | null;
      related_property_id: number | null;
      state: string;
    } | undefined;

    if (!request) {
      throw new Error(`Confirm request ${requestId} not found`);
    }

    if (request.state !== 'pending') {
      throw new Error(`Confirm request ${requestId} is already ${request.state}`);
    }

    // Update the confirm request
    this.db.prepare(`
      UPDATE confirm_requests
      SET state = 'answered', user_answer = ?, answered_at = ?
      WHERE id = ?
    `).run(detail ? `${answer}: ${detail}` : answer, timestamp, requestId);

    // If there is a related property, handle it
    if (request.related_property_id == null) return;

    const disputedProp = this.db
      .prepare(`SELECT * FROM entity_properties WHERE id = ?`)
      .get(request.related_property_id) as EntityPropertyRow | undefined;

    if (!disputedProp) return;

    const isAccepted = answer === 'accept' || answer === 'yes' || answer === 'approve';

    if (isAccepted) {
      // Accept the disputed/proposed property: make it active
      this.db.prepare(`
        UPDATE entity_properties
        SET status = 'active', action_type = 'update'
        WHERE id = ?
      `).run(disputedProp.id);

      // Supersede the currently active property for the same entity+key
      const currentActive = this.getActivePropertyRow(
        disputedProp.entity_id,
        disputedProp.property_key,
      );
      if (currentActive && currentActive.id !== disputedProp.id) {
        this.db.prepare(`
          UPDATE entity_properties
          SET tx_end = ?, status = 'superseded', superseded_by = ?,
              supersede_reason = 'User confirmed replacement'
          WHERE id = ?
        `).run(timestamp, disputedProp.id, currentActive.id);
      }
    } else {
      // Reject the disputed/proposed property
      this.db.prepare(`
        UPDATE entity_properties
        SET status = 'retracted', tx_end = ?
        WHERE id = ?
      `).run(timestamp, disputedProp.id);
    }
  }

  // -------------------------------------------------------------------------
  // Insert helpers
  // -------------------------------------------------------------------------

  private insertProperty(params: {
    entityId: string;
    key: string;
    value: string;
    valueType: string;
    sourceMessageId?: string;
    sourceAuthor?: string;
    sourceAuthority: string;
    sourceContext?: string;
    validFrom?: number;
    validTo?: number;
    txStart: number;
    confidence: number;
    status: string;
    actionType: string;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO entity_properties (
        entity_id, property_key, property_value, value_type,
        source_message_id, source_author, source_authority, source_context,
        valid_from, valid_to, tx_start, confidence, status, action_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.entityId,
      params.key,
      params.value,
      params.valueType,
      params.sourceMessageId ?? null,
      params.sourceAuthor ?? null,
      params.sourceAuthority,
      params.sourceContext ?? null,
      params.validFrom ?? null,
      params.validTo ?? null,
      params.txStart,
      params.confidence,
      params.status,
      params.actionType,
    );

    return Number(result.lastInsertRowid);
  }

  // -------------------------------------------------------------------------
  // Confirm request helper
  // -------------------------------------------------------------------------

  private createConfirmRequest(params: {
    entityId: string;
    entityName?: string;
    propertyId: number;
    key: string;
    value: string;
    oldValue?: string;
    sourceAuthor?: string;
    sourceAuthority?: string;
    context?: string;
    isFinalConflict?: boolean;
    timestamp: number;
  }): string {
    const id = `cr_${params.timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const entityLabel = params.entityName ?? params.entityId;

    let question: string;
    if (params.oldValue) {
      question = `Property "${params.key}" on ${entityLabel} may have changed from "${params.oldValue}" to "${params.value}". Accept the new value?`;
    } else {
      question = `Set property "${params.key}" on ${entityLabel} to "${params.value}"?`;
    }

    if (params.isFinalConflict) {
      question += ' (Note: the current value was marked as final.)';
    }

    const contextParts: string[] = [];
    if (params.sourceAuthor) contextParts.push(`Source: ${params.sourceAuthor}`);
    if (params.sourceAuthority) contextParts.push(`Authority: ${params.sourceAuthority}`);
    if (params.context) contextParts.push(params.context);

    const options = JSON.stringify([
      { label: 'Accept', value: 'accept' },
      { label: 'Reject', value: 'reject' },
    ]);

    const result = this.confirmRequestRepo.createOrReusePending({
      id,
      question,
      context: contextParts.join('; ') || null,
      options: JSON.parse(options) as Array<{ label: string; value: string }>,
      category: 'property_change',
      relatedEntityId: params.entityId,
      relatedPropertyId: params.propertyId,
      priority: params.isFinalConflict ? 'high' : 'normal',
      createdAt: params.timestamp,
    });

    if (result.created) {
      void this.notifyConfirmRequestCreated({
        id: result.record.id,
        question,
        context: contextParts.join('; ') || null,
        priority: params.isFinalConflict ? 'high' : 'normal',
      });
    }

    return result.record.id;
  }

  private async notifyConfirmRequestCreated(params: {
    id: string;
    question: string;
    context: string | null;
    priority: string;
  }): Promise<void> {
    void params;
  }

  // -------------------------------------------------------------------------
  // Notification helper
  // -------------------------------------------------------------------------

  private createPropertyChangeNotification(params: {
    entityId: string;
    entityName?: string;
    key: string;
    oldValue: string;
    newValue: string | null;
    action: string;
    sourceAuthor?: string;
    timestamp: number;
  }): string {
    const id = `notif_${params.timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const entityLabel = params.entityName ?? params.entityId;

    let title: string;
    let body: string;

    if (params.newValue === null) {
      title = `Property retracted: ${entityLabel}.${params.key}`;
      body = `"${params.key}" was retracted (was "${params.oldValue}").`;
    } else {
      title = `Property updated: ${entityLabel}.${params.key}`;
      body = `"${params.key}" changed from "${params.oldValue}" to "${params.newValue}".`;
    }

    if (params.sourceAuthor) {
      body += ` (by ${params.sourceAuthor})`;
    }

    const payload = JSON.stringify({
      entityId: params.entityId,
      key: params.key,
      oldValue: params.oldValue,
      newValue: params.newValue,
      action: params.action,
    });

    this.db.prepare(`
      INSERT INTO notification_records (
        id, channel, type, title, body, payload_json,
        related_entity_id, sent_at, created_at
      ) VALUES (?, 'system', 'property_change', ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      body,
      payload,
      params.entityId,
      params.timestamp,
      params.timestamp,
    );

    return id;
  }
}
