import { it, expect } from "vitest";
import http from "node:http";
import { once } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startOpenRouterProxy } from "../src/cost/openrouter-proxy.js";
it("serializes concurrent requests and blocks the next call using settled costs", async () => {
  const root = mkdtempSync(join(tmpdir(),"e155-proxy-"));
  const policy = join(root,"policy.json");
  writeFileSync(policy,JSON.stringify({ledger_dir:root,total_ceiling_usd:100,scheme_ceilings_usd:{A:.5}}));
  let forwarded = 0;
  const server = http.createServer(async (req,res) => {
    for await (const _chunk of req) { /* drain */ }
    forwarded++;
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify({id:"gen-test",model:"test",usage:{cost:.6,prompt_tokens:1,completion_tokens:1},choices:[]}));
  }).listen(0,"127.0.0.1");
  await once(server,"listening");
  const port = (server.address() as {port:number}).port;
  const previous = process.env.MEMORY_BENCHMARK_BUDGET_POLICY;
  process.env.MEMORY_BENCHMARK_BUDGET_POLICY=policy;
  const proxy = await startOpenRouterProxy({runId:"test",schemeId:"A",ledgerPath:join(root,"calls.jsonl"),apiKey:"test-only",port:0,upstreamBase:`http://127.0.0.1:${port}`});
  try {
    const request = () => fetch(`${proxy.baseUrl}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"test",messages:[]})});
    const responses = await Promise.all([request(),request()]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,402]); expect(forwarded).toBe(1);
  } finally {
    if(previous===undefined) delete process.env.MEMORY_BENCHMARK_BUDGET_POLICY; else process.env.MEMORY_BENCHMARK_BUDGET_POLICY=previous;
    await proxy.stop(); await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});
