/**
 * Debug script for context-match: verify data and simulate query.
 * Run: cd memory-service && DATA_DIR=./data npx tsx scripts/debug-context-match.ts
 */

import path from 'node:path';
import { UserContextManager } from '../src/core/UserContextManager.js';
import { EmbeddingClient } from '../src/llm/EmbeddingClient.js';
import { getConfig } from '../src/config.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const userId = process.env.DEMO_USER_ID || 'esone.qiu';

async function main() {
  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const db = ctx.db;

  console.log('=== 1. 检查 chunks 表 ===');
  const chunks = db
    .prepare(
      `SELECT chunk_id, file_path, substr(content, 1, 80) as content_preview
       FROM chunks
       WHERE file_path LIKE 'reflections/%' OR file_path LIKE 'dreams/%'`,
    )
    .all() as Array<{ chunk_id: number; file_path: string; content_preview: string }>;

  console.log(`reflections/dreams chunks 数量: ${chunks.length}`);
  for (const c of chunks) {
    console.log(`  - ${c.file_path} (chunk_id=${c.chunk_id}): ${c.content_preview}...`);
  }

  console.log('\n=== 2. 检查 chunks_vec 表 ===');
  const vecCount = db.prepare(`SELECT COUNT(*) as n FROM chunks_vec`).get() as { n: number };
  console.log(`chunks_vec 总行数: ${vecCount.n}`);

  if (chunks.length === 0 || vecCount.n === 0) {
    console.log('\n❌ 无 demo 数据。请先运行: DATA_DIR=./data npx tsx scripts/seed-context-match-demo.ts');
    ucm.closeAll();
    return;
  }

  console.log('\n=== 3. 模拟 context-match 查询 ===');
  const queryText =
    'facebook/react: The library for web and native user interfaces. React is a JavaScript library for building user interfaces';
  const embeddingClient = await EmbeddingClient.getInstance();
  const embedding = await embeddingClient.embed(queryText);
  const embJson = JSON.stringify(embedding);

  const vecRows = db
    .prepare(
      `SELECT chunk_id, distance
       FROM chunks_vec
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT 20`,
    )
    .all(embJson) as Array<{ chunk_id: number; distance: number }>;

  console.log(`向量搜索返回 ${vecRows.length} 条`);

  const config = getConfig();
  console.log(`当前阈值 contextMatchThreshold: ${config.contextMatchThreshold}`);

  const chunkIds = vecRows.map((r) => r.chunk_id);
  const ph = chunkIds.map(() => '?').join(', ');
  const chunkRows = db
    .prepare(
      `SELECT chunk_id, content, file_path FROM chunks WHERE chunk_id IN (${ph})`,
    )
    .all(...chunkIds) as Array<{ chunk_id: number; content: string; file_path: string }>;
  const chunkMap = new Map(chunkRows.map((c) => [c.chunk_id, c]));

  console.log('\nTop 20 结果 (含 reflections/dreams):');
  for (let i = 0; i < vecRows.length; i++) {
    const row = vecRows[i];
    const chunk = chunkMap.get(row.chunk_id);
    const fp = chunk?.file_path ?? '?';
    const score = 1 / (1 + row.distance);
    const isReflection =
      fp.includes('reflections/') || fp.includes('dreams/') || fp.includes('reflection-threads/');
    const pass = isReflection && score >= config.contextMatchThreshold;
    console.log(
      `  ${i + 1}. ${fp} | distance=${row.distance.toFixed(4)} score=${score.toFixed(4)} ${isReflection ? '✓reflection' : ''} ${pass ? '✓PASS' : ''}`,
    );
  }

  const bestReflection = vecRows.find((row) => {
    const chunk = chunkMap.get(row.chunk_id);
    if (!chunk) return false;
    const fp = chunk.file_path.toLowerCase();
    const ok =
      fp.includes('reflections/') || fp.includes('dreams/') || fp.includes('reflection-threads/');
    const score = 1 / (1 + row.distance);
    return ok && score >= config.contextMatchThreshold;
  });

  if (bestReflection) {
    const chunk = chunkMap.get(bestReflection.chunk_id)!;
    console.log('\n✅ 最佳匹配:', chunk.file_path, 'score=', (1 / (1 + bestReflection.distance)).toFixed(4));
  } else {
    const bestReflectionAny = vecRows.find((row) => {
      const chunk = chunkMap.get(row.chunk_id);
      if (!chunk) return false;
      const fp = chunk.file_path.toLowerCase();
      return fp.includes('reflections/') || fp.includes('dreams/') || fp.includes('reflection-threads/');
    });
    if (bestReflectionAny) {
      const score = 1 / (1 + bestReflectionAny.distance);
      console.log(
        `\n⚠️ 最佳 reflection 分数 ${score.toFixed(4)} < 阈值 ${config.contextMatchThreshold}`,
      );
      console.log(`   建议: 设置 CONTEXT_MATCH_THRESHOLD=${(score - 0.02).toFixed(2)} 或更低进行测试`);
    } else {
      console.log('\n❌ Top 20 中没有任何 reflections/dreams 类型的 chunk');
      console.log('   可能原因: 该账号有大量其他 chunks，reflection 排名在 20 之外');
    }
  }

  ucm.closeAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
