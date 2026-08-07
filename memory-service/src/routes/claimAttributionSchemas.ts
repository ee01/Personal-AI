const receiptBucketSchema = {
  type: 'object' as const,
  properties: {
    kind: { type: 'string' as const },
    label: { type: 'string' as const },
    count: { type: 'number' as const },
  },
};

export const claimAttributionReceiptItemSchema = {
  type: 'object' as const,
  properties: {
    claimId: { type: 'string' as const },
    sourceMessageId: { type: 'string' as const },
    revision: { type: 'number' as const },
    excerpt: { type: 'string' as const },
    ownerKind: { type: 'string' as const },
    ownerLabel: { type: 'string' as const },
    speechMode: { type: 'string' as const },
    verification: { type: 'string' as const },
    commitment: { type: 'string' as const },
    effect: {
      type: 'string' as const,
      enum: ['used', 'background_only', 'blocked'],
    },
    displayLabel: { type: 'string' as const },
    consequence: { type: 'string' as const },
    correctionAllowed: { type: 'boolean' as const },
    corrected: { type: 'boolean' as const },
  },
};

export const claimAttributionReceiptSchema = {
  type: 'object' as const,
  properties: {
    status: {
      type: 'string' as const,
      enum: ['mixed', 'downgraded', 'corrected'],
    },
    visibility: {
      type: 'string' as const,
      enum: ['compact', 'review'],
    },
    summary: { type: 'string' as const },
    boundary: { type: 'string' as const },
    used: { type: 'array' as const, items: receiptBucketSchema },
    backgroundOnly: { type: 'array' as const, items: receiptBucketSchema },
    blocked: { type: 'array' as const, items: receiptBucketSchema },
    claims: {
      type: 'array' as const,
      items: claimAttributionReceiptItemSchema,
    },
    affectedHighResponsibility: { type: 'boolean' as const },
    correctedCount: { type: 'number' as const },
  },
};

export const ingestClaimAttributionDecisionSchema = {
  type: 'object' as const,
  properties: {
    status: {
      type: 'string' as const,
      enum: ['legacy_unclassified', 'pending', 'resolved', 'failed'],
    },
    claimCount: { type: 'number' as const },
    highResponsibilityAllowed: { type: 'number' as const },
    highResponsibilityBlocked: { type: 'number' as const },
    receipt: claimAttributionReceiptSchema,
  },
};
