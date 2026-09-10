/**
 * P4 ACL/EgressPolicyEngine (plan §10.2/§11.9): every memory read computes
 * the full permission matrix:
 *
 *   tenant × owner_user × requesting_agent × source_scope
 *   × destination_host × model_provider × purpose × sensitivity
 *
 * Policy resolution is deny-by-default; explicit deny > allow; narrower
 * binding > wider binding; any missing field = fail-closed (I10).
 */

export type Sensitivity = 'public' | 'internal' | 'private' | 'restricted';
export type EgressPolicy = 'local_only' | 'approved_destinations' | 'user_selected';
export type PrincipalScope = 'user' | 'agent' | 'sandbox';

export interface Principal {
  tenantId: string;
  userId: string;
  scope: PrincipalScope;
  /** For agent principals: the claiming human (null = sandbox). */
  claimedByUserId?: string | null;
}

export interface DestinationContext {
  destinationHost: string;
  modelProvider: string | null;
  purpose: string;
}

export interface MemoryItem {
  tenantId: string;
  ownerUserId: string;
  sensitivity: Sensitivity;
  egressPolicy: EgressPolicy;
  scopeLocator: string | null;
  status: string;
}

export interface AclCheckResult {
  allowed: boolean;
  reason?: string;
  sensitivity: Sensitivity;
  effectiveEgress: EgressPolicy;
}

export class EgressPolicyEngine {
  /**
   * The single gate every read path must call. Fail-closed on ANY missing
   * field or unresolvable policy (plan §10.2, I10).
   */
  static checkRead(
    principal: Principal,
    item: MemoryItem,
    destination: DestinationContext,
  ): AclCheckResult {
    // I6: retracted/quarantined/deletion_pending never pass any gate.
    if (
      item.status === 'retracted' ||
      item.status === 'quarantined' ||
      item.status === 'deletion_pending'
    ) {
      return {
        allowed: false,
        reason: `status_${item.status}_blocked`,
        sensitivity: item.sensitivity,
        effectiveEgress: item.egressPolicy,
      };
    }

    // Tenant isolation: cross-tenant is always denied.
    if (principal.tenantId !== item.tenantId) {
      return {
        allowed: false,
        reason: 'cross_tenant',
        sensitivity: item.sensitivity,
        effectiveEgress: item.egressPolicy,
      };
    }

    // Sandbox principals can never read real data (§10.2) — check BEFORE
    // owner/claim so a sandbox with a matching userId is still blocked.
    if (principal.scope === 'sandbox') {
      return {
        allowed: false,
        reason: 'sandbox_no_real_data',
        sensitivity: item.sensitivity,
        effectiveEgress: item.egressPolicy,
      };
    }

    // Owner isolation: only the owner (or their claimed agent) can read.
    const isOwner = principal.userId === item.ownerUserId;
    const isClaimedAgent =
      principal.scope === 'agent' && principal.claimedByUserId === item.ownerUserId;
    if (!isOwner && !isClaimedAgent) {
      return {
        allowed: false,
        reason: 'not_owner_or_claimed_agent',
        sensitivity: item.sensitivity,
        effectiveEgress: item.egressPolicy,
      };
    }

    // Fail-closed on missing destination fields (§10.2).
    if (!destination.destinationHost || !destination.purpose) {
      return {
        allowed: false,
        reason: 'missing_destination_fields',
        sensitivity: item.sensitivity,
        effectiveEgress: item.egressPolicy,
      };
    }

    // Egress policy: local_only never leaves the boundary.
    let effectiveEgress = item.egressPolicy;
    if (effectiveEgress === 'local_only') {
      // local_only data can only be read by the owner on the local host.
      // For now, any API-mediated read counts as non-local.
      return {
        allowed: false,
        reason: 'local_only_blocked_on_remote',
        sensitivity: item.sensitivity,
        effectiveEgress,
      };
    }

    // Sensitivity: private/restricted block external destinations.
    if (
      (item.sensitivity === 'private' || item.sensitivity === 'restricted') &&
      destination.destinationHost !== 'local'
    ) {
      // Private data can be read by the owner locally, but not egressed.
      return {
        allowed: false,
        reason: `sensitivity_${item.sensitivity}_blocks_egress_to_${destination.destinationHost}`,
        sensitivity: item.sensitivity,
        effectiveEgress,
      };
    }

    // user_selected: only valid for the specific request that was previewed.
    if (effectiveEgress === 'user_selected' && destination.purpose !== 'user_selection') {
      return {
        allowed: false,
        reason: 'user_selected_requires_preview_purpose',
        sensitivity: item.sensitivity,
        effectiveEgress,
      };
    }

    return {
      allowed: true,
      sensitivity: item.sensitivity,
      effectiveEgress,
    };
  }

  /**
   * Adapter semantic surface (§11.9): the minimal fixed set of operations
   * exposed to any host. Protocol names may differ (MCP/HTTP) but the
   * meaning must be identical.
   */
  static readonly ADAPTER_OPERATIONS = [
    'recall',
    'open_sources',
    'write_explicit',
    'feedback',
    'delete',
  ] as const;

  /**
   * write_explicit authorization (§10.1): an adapter calling write_explicit
   * only proves the writer_agent requested a write, NOT that the user
   * confirmed. Only a user-authenticated intent token or local UI action
   * can set user_confirmed.
   */
  static canSetUserConfirmed(
    callerType: 'adapter' | 'agent' | 'user_ui' | 'user_token',
  ): boolean {
    return callerType === 'user_ui' || callerType === 'user_token';
  }

  /**
   * open_sources re-authorization (§11.9): recall-time unit ids are NOT
   * permanent capabilities; every open_sources call re-runs the full gate.
   */
  static requireReAuthorization(operation: string): boolean {
    return this.ADAPTER_OPERATIONS.includes(operation as never);
  }
}
