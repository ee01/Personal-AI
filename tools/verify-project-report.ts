import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { DashboardMessageHandler } from '../src/utils/dashboardIntegration';
import { parseProjectReport } from '../src/utils/projectReport';

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function callHandler(handler: DashboardMessageHandler, request: any): Promise<any> {
  let responsePayload: any;
  await handler.handleMessage(request, (response: any) => {
    responsePayload = response;
  });

  if (responsePayload === undefined) {
    throw new Error(`请求未返回响应: ${request.type}`);
  }

  return responsePayload;
}

async function ensureReadableJson(filePath: string): Promise<{ content: string; hash: string }> {
  const content = await fs.readFile(filePath, 'utf8');
  JSON.parse(content);
  return {
    content,
    hash: sha256(content),
  };
}

async function main(): Promise<void> {
  const handler = new DashboardMessageHandler();
  const verificationRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'personal-ai-project-report-'));
  const exportDir = path.join(verificationRoot, 'exported');
  const importDir = path.join(verificationRoot, 'import');

  await fs.mkdir(exportDir, { recursive: true });
  await fs.mkdir(importDir, { recursive: true });

  const initialProjectsResponse = await callHandler(handler, { type: 'GET_PROJECT_DATA' });
  if (!initialProjectsResponse.success) {
    throw new Error(initialProjectsResponse.error || '无法获取初始项目数据');
  }

  const initialProjectCount = (initialProjectsResponse.projects || []).length;

  const exportResponse = await callHandler(handler, {
    type: 'QUICK_ACTION',
    action: 'export_report',
    data: { projectId: 'all' },
  });
  if (!exportResponse.success || !exportResponse.result?.serializedData || !exportResponse.result?.fileName) {
    throw new Error(exportResponse.error || exportResponse.result?.error || '导出失败');
  }

  const parsedReport = parseProjectReport(exportResponse.result.serializedData);
  const exportFilePath = path.join(exportDir, exportResponse.result.fileName);
  await fs.writeFile(exportFilePath, exportResponse.result.serializedData, 'utf8');
  const retainedFile = await ensureReadableJson(exportFilePath);

  const importFilePath = path.join(importDir, 'project-report-import.json');
  await fs.copyFile(exportFilePath, importFilePath);
  const importFile = await ensureReadableJson(importFilePath);

  const extraProjectResponse = await callHandler(handler, {
    type: 'ADD_PROJECT',
    name: 'Verification Temp Project',
    description: 'Used by the project report verification script',
    platformConfig: ['sdk', 'ios', 'android', 'qa'],
  });
  if (!extraProjectResponse.success) {
    throw new Error(extraProjectResponse.error || '无法创建验证项目');
  }

  const mergeResponse = await callHandler(handler, {
    type: 'IMPORT_PROJECT_REPORT',
    reportContent: importFile.content,
    mode: 'merge',
  });
  if (!mergeResponse.success) {
    throw new Error(mergeResponse.error || 'merge 模式导入失败');
  }

  const afterMergeResponse = await callHandler(handler, { type: 'GET_PROJECT_DATA' });
  if (!afterMergeResponse.success) {
    throw new Error(afterMergeResponse.error || 'merge 后无法获取项目数据');
  }

  const mergeProjectCount = (afterMergeResponse.projects || []).length;

  const replaceResponse = await callHandler(handler, {
    type: 'IMPORT_PROJECT_REPORT',
    reportContent: importFile.content,
    mode: 'replace',
  });
  if (!replaceResponse.success) {
    throw new Error(replaceResponse.error || 'replace 模式导入失败');
  }

  const afterReplaceResponse = await callHandler(handler, { type: 'GET_PROJECT_DATA' });
  if (!afterReplaceResponse.success) {
    throw new Error(afterReplaceResponse.error || 'replace 后无法获取项目数据');
  }

  const replaceProjectCount = (afterReplaceResponse.projects || []).length;

  await fs.rm(importFilePath);

  let deletedImportFileMissing = false;
  try {
    await fs.access(importFilePath);
  } catch {
    deletedImportFileMissing = true;
  }

  const retainedFileAfterCleanup = await ensureReadableJson(exportFilePath);

  const expectations = {
    exportedProjectCount: parsedReport.projects.length,
    initialProjectCount,
    mergeRetainedProjectCount: mergeResponse.stats?.retainedProjectCount,
    mergeUpdatedProjectCount: mergeResponse.stats?.updatedProjectCount,
    mergeProjectCount,
    replaceRemovedProjectCount: replaceResponse.stats?.removedProjectCount,
    replaceUpdatedProjectCount: replaceResponse.stats?.updatedProjectCount,
    replaceProjectCount,
    importCopyDeleted: deletedImportFileMissing,
    retainedFileHashStable: retainedFile.hash === retainedFileAfterCleanup.hash,
    importCopyHashMatchesExport: retainedFile.hash === importFile.hash,
  };

  if (parsedReport.projects.length !== initialProjectCount) {
    throw new Error(`导出项目数与初始项目数不一致: ${parsedReport.projects.length} !== ${initialProjectCount}`);
  }

  if (mergeResponse.stats?.retainedProjectCount !== 1) {
    throw new Error(`merge 模式保留项目数异常: ${mergeResponse.stats?.retainedProjectCount}`);
  }

  if (mergeResponse.stats?.updatedProjectCount !== parsedReport.projects.length) {
    throw new Error(`merge 模式更新项目数异常: ${mergeResponse.stats?.updatedProjectCount}`);
  }

  if (mergeProjectCount !== initialProjectCount + 1) {
    throw new Error(`merge 后项目总数异常: ${mergeProjectCount}`);
  }

  if (replaceResponse.stats?.removedProjectCount !== 1) {
    throw new Error(`replace 模式移除项目数异常: ${replaceResponse.stats?.removedProjectCount}`);
  }

  if (replaceResponse.stats?.updatedProjectCount !== parsedReport.projects.length) {
    throw new Error(`replace 模式更新项目数异常: ${replaceResponse.stats?.updatedProjectCount}`);
  }

  if (replaceProjectCount !== initialProjectCount) {
    throw new Error(`replace 后项目总数异常: ${replaceProjectCount}`);
  }

  if (!deletedImportFileMissing) {
    throw new Error('导入副本文件删除校验失败');
  }

  if (retainedFile.hash !== retainedFileAfterCleanup.hash) {
    throw new Error('保留的导出文件哈希变化，文件可能损坏');
  }

  console.log(JSON.stringify({
    verificationRoot,
    retainedExportFile: exportFilePath,
    expectations,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
