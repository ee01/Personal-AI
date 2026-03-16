/**
 * Seed demo data for Context Match (浏览上下文自动气泡提示) testing.
 *
 * Creates reflections and dreams in esone.qiu's account with content
 * that will semantically match when browsing specific tech documentation pages.
 *
 * Usage:
 *   cd memory-service
 *   DATA_DIR=./data npx tsx scripts/seed-context-match-demo.ts
 *
 * Or with custom user:
 *   DEMO_USER_ID=esone.qiu DATA_DIR=./data npx tsx scripts/seed-context-match-demo.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { UserContextManager } from '../src/core/UserContextManager.js';
import { getMarkdownManager } from '../src/core/MarkdownManager.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const userId = process.env.DEMO_USER_ID || 'esone.qiu';

/** Demo content designed to match when browsing these pages */
const DEMO_FILES: Array<{ relPath: string; content: string }> = [
  {
    relPath: 'reflections/context-match-react.md',
    content: `# Reflection: React 与前端工程

React is a JavaScript library for building user interfaces. The library for web and native user interfaces. Facebook 开源的 React 库是构建 web 和 native 用户界面的核心。

最近在研究 React 18 的并发特性，useTransition 和 useDeferredValue 对复杂交互场景很有帮助。作为 JavaScript 生态中最流行的 UI 库之一，React 的组件化思想和声明式编程让前端开发效率大幅提升。

## 关键洞察
- React 18 的并发渲染可以显著改善大型应用的交互流畅度
- Suspense 和 lazy 加载对首屏性能优化很有价值
- 与 TypeScript 结合使用能获得更好的类型安全
`,
  },
  {
    relPath: 'dreams/context-match-vue.md',
    content: `# Dream: Vue 3 项目重构

Vue - The Progressive JavaScript Framework. 梦到在重构一个大型前端项目，用 Vue 3 的 Composition API 和 script setup 语法让代码组织更清晰。

Vue 作为渐进式 JavaScript 框架，从模板到响应式系统都设计得很优雅。Vue 3 的 TypeScript 支持也比 Vue 2 完善很多，适合中大型项目。

## 梦境要点
- Composition API 让逻辑复用更自然
- Pinia 作为状态管理比 Vuex 更轻量
- Vite 构建 Vue 项目速度极快
`,
  },
  {
    relPath: 'reflections/context-match-typescript.md',
    content: `# Reflection: TypeScript 类型系统

TypeScript: JavaScript With Syntax For Types. 微软开源的 TypeScript 为 JavaScript 添加了静态类型系统。

泛型约束和 conditional types 在复杂类型推导中很有用。支持接口、泛型、联合类型等高级特性。与 React、Vue 等框架配合使用已成为现代前端开发的标准配置。

## 实践总结
- 泛型约束 (extends) 可以精确控制类型边界
- 条件类型 (T extends U ? X : Y) 实现类型层面的逻辑分支
- 模块解析和 path mapping 对 monorepo 很重要
`,
  },
];

async function main() {
  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const userDir = path.join(dataDir, 'users', userId);

  // Ensure reflections and dreams dirs exist
  await fs.mkdir(path.join(userDir, 'reflections'), { recursive: true });
  await fs.mkdir(path.join(userDir, 'dreams'), { recursive: true });

  const mdManager = getMarkdownManager(ctx.db, userDir);
  let totalChunks = 0;

  for (const { relPath, content } of DEMO_FILES) {
    const absPath = path.join(userDir, relPath);
    await fs.writeFile(absPath, content, 'utf-8');
    const count = await mdManager.reindexFile(relPath);
    totalChunks += count;
    console.log(`  Created ${relPath} -> ${count} chunks`);
  }

  const summary = {
    dataDir,
    userId,
    filesCreated: DEMO_FILES.length,
    totalChunks,
    testUrls: [
      'https://github.com/facebook/react',
      'https://vuejs.org',
      'https://www.typescriptlang.org/docs/',
    ],
  };

  console.log('\n' + JSON.stringify(summary, null, 2));
  console.log('\n✅ 请确保扩展的 User ID 设置为:', userId);
  console.log('   然后浏览上述任一 URL 测试气泡提示。');
  ucm.closeAll();
}

main().catch((error) => {
  console.error('[seed-context-match-demo] Failed:', error);
  process.exit(1);
});
