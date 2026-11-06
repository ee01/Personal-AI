import { describe, expect, it } from 'vitest';
import { publishableResult } from '../integrations/executors/publishableResult.js';
describe('publishable result boundary', () => {
  it('never promotes narrative summary, logs or raw text to public output', () => {
    expect(publishableResult({ summary: 'private run log', payload: { raw: 'private transcript' } })).toEqual({ final_output: undefined, publish_fields: undefined });
  });
  it('preserves explicit output through executor envelope payload and validates shape', () => {
    expect(publishableResult({ payload: { raw: { final_output: 'Approved report', publish_fields: { title: 'Report' } } } })).toEqual({ final_output: 'Approved report', publish_fields: { title: 'Report' } });
    expect(publishableResult({ final_output: 123, publish_fields: [] })).toEqual({ final_output: undefined, publish_fields: undefined });
  });
});
