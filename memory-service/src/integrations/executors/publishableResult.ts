/** Only explicit structured output may be published. Never promote run summaries. */
export function publishableResult(result?: Record<string, unknown>) {
  const payload = result?.payload && typeof result.payload === 'object' ? result.payload as Record<string, unknown> : {};
  const raw = payload.raw && typeof payload.raw === 'object' ? payload.raw as Record<string, unknown> : {};
  const final = result?.final_output ?? payload.final_output ?? raw.final_output;
  const fields = result?.publish_fields ?? payload.publish_fields ?? raw.publish_fields;
  return {
    final_output: typeof final === 'string' ? final : undefined,
    publish_fields: fields && typeof fields === 'object' && !Array.isArray(fields) ? fields as Record<string, unknown> : undefined,
  };
}
