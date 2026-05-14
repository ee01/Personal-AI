/**
 * 一键初始化组件
 * 引导用户创建定时消息系统
 */

import * as React from 'react';
import { useState } from 'react';
import { SheetInitializer } from '../SheetInitializer';
import { InitializationResult, SheetConfig } from '../types';
import { getGoogleAuthToken } from '../../utils/googleAuth';
import {
  buildSheetUrl,
  getManualBindSheetInputFeedback,
} from '../manualBindSheetInput';
import {
  formatConfigSyncTimestamp,
} from '../configSyncFreshness';
import {
  getManualBindDecision,
  getManualBindRestoreScope,
} from '../manualBindConfigDecision';
import type {
  ManualBindDecision,
  ManualBindWriteMode,
} from '../manualBindConfigDecision';

interface OneClickSetupProps {
  onComplete: (result: InitializationResult) => void;
}

function formatSheetIdForDisplay(sheetId: string): string {
  if (sheetId.length <= 20) {
    return sheetId;
  }

  return `${sheetId.slice(0, 10)}...${sheetId.slice(-6)}`;
}

export const OneClickSetup: React.FC<OneClickSetupProps> = ({ onComplete }) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [manualSheetUrl, setManualSheetUrl] = useState('');
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [tempResult, setTempResult] = useState<InitializationResult | null>(null);
  const [needsAppScriptAPI, setNeedsAppScriptAPI] = useState(false);
  const [appScriptAPIUrl, setAppScriptAPIUrl] = useState('');
  const [manualBindDecision, setManualBindDecision] = useState<ManualBindDecision | null>(null);
  const manualBindFeedback = getManualBindSheetInputFeedback(manualSheetUrl);
  
  const handleOneClickSetup = async () => {
    setIsInitializing(true);
    setError('');
    
    try {
      // 获取 Google OAuth token（强制刷新以应用新权限）
      setCurrentStep('正在获取授权...');
      const token = await getAuthTokenWithForceRefresh();
      
      if (!token) {
        throw new Error('无法获取 Google 授权，请检查账号登录状态');
      }
      
      setAuthToken(token);
      
      // 创建 Sheet 和 AppScript
      setCurrentStep('正在创建系统（共8步，当前完成1-5步）...');
      const initializer = new SheetInitializer(token);
      const result = await initializer.createScheduledMessagesSheet();
      
      if (result.success && result.needsAuthorization) {
        // 需要用户授权
        setTempResult(result);
        setNeedsAuth(true);
        setAuthUrl(result.authUrl || '');
        setCurrentStep('');
        setIsInitializing(false);
      } else if (result.success) {
        setCurrentStep('初始化成功！');
        onComplete(result);
      } else if (result.needsAppScriptAPI) {
        // 需要开启 AppScript API
        setNeedsAppScriptAPI(true);
        setAppScriptAPIUrl(result.appScriptAPIUrl || 'https://script.google.com/home/usersettings');
        setCurrentStep('');
        setIsInitializing(false);
      } else {
        throw new Error(result.error || '初始化失败');
      }
      
    } catch (err: any) {
      console.error('初始化失败:', err);
      setError(err.message || '初始化失败，请重试');
      setIsInitializing(false);
    }
  };
  
  const handleCompleteAuth = async () => {
    if (!tempResult || !authToken) {
      setError('缺少必要信息，请重新初始化');
      return;
    }
    
    setIsInitializing(true);
    setError('');
    
    try {
      setCurrentStep('正在完成初始化（第6-8步：创建触发器、添加示例数据、保存配置）...');
      const initializer = new SheetInitializer(authToken);
      const result = await initializer.completeInitialization(
        tempResult.sheetId,
        tempResult.scriptId,
        tempResult.webAppUrl
      );
      
      if (result.success) {
        setCurrentStep('初始化成功！');
        onComplete(result);
      } else {
        throw new Error(result.error || '完成初始化失败');
      }
      
    } catch (err: any) {
      console.error('完成初始化失败:', err);
      
      // 检查是否是授权错误
      if (err.message === 'AUTHORIZATION_REQUIRED' || err.message?.includes('AUTHORIZATION_REQUIRED')) {
        setError('⚠️ 检测到您尚未完成授权！请先点击上方"打开授权页面"按钮，在弹出的页面中完成授权操作，然后再点击此按钮继续。');
        setNeedsAuth(true);  // 保持在授权界面
      } else {
        setError(err.message || '完成初始化失败，请重试');
        setNeedsAuth(true);  // 保持在授权界面，允许重试
      }
      
      setIsInitializing(false);
    }
  };
  
  const handleManualBind = async () => {
    const rawSheetInput = manualSheetUrl.trim();
    if (!rawSheetInput) {
      setError('请输入 Sheet URL 或 Sheet ID');
      return;
    }
    
    setIsInitializing(true);
    setError('');
    setManualBindDecision(null);
    setCurrentStep('正在验证 Sheet 地址...');
    
    try {
      // 从 URL 提取 Sheet ID
      const sheetId = manualBindFeedback.sheetId;
      if (!sheetId) {
        throw new Error(manualBindFeedback.error || '无效的 Sheet URL 或 Sheet ID');
      }
      const canonicalSheetUrl = buildSheetUrl(sheetId);
      
      // 获取授权（强制刷新以应用新权限）
      setCurrentStep('正在获取 Google 授权...');
      const token = await getAuthTokenWithForceRefresh();
      if (!token) {
        throw new Error('无法获取 Google 授权');
      }
      setAuthToken(token);
      
      // 使用 ConfigSyncService 从 Sheet 读取完整配置
      const { ConfigSyncService } = await import('../ConfigSyncService');
      const syncService = new ConfigSyncService(token || '');
      const localConfig = await syncService.readConfigFromStorage().catch((storageError) => {
        console.warn('读取本地配置失败，将继续按 Sheet 恢复:', storageError);
        return null;
      });
      const pauseForManualBindDecision = (
        nextSheetConfig: SheetConfig,
        writeMode: ManualBindWriteMode
      ): boolean => {
        const decision = getManualBindDecision({
          localConfig,
          sheetConfig: nextSheetConfig,
          canonicalSheetUrl,
          writeMode,
        });

        if (!decision) {
          return false;
        }

        setManualBindDecision(decision);
        setCurrentStep('');
        setIsInitializing(false);
        return true;
      };
      
      setCurrentStep('正在读取 Sheet Config 工作表...');
      let sheetConfig: Partial<SheetConfig>;
      try {
        sheetConfig = await syncService.readConfigFromSheet(sheetId);
      } catch (readError) {
        if (!ConfigSyncService.isMissingConfigSheetError(readError)) {
          throw readError;
        }

        console.warn('Sheet 缺少 Config 工作表，正在自动补齐:', readError);
        setCurrentStep('未找到 Config 工作表，正在为旧维护表补齐配置...');
        await syncService.ensureConfigSheet(sheetId);
        sheetConfig = {
          sheetId,
          sheetUrl: canonicalSheetUrl,
        };
      }
      
      // 如果 Sheet 中没有配置，创建最小配置
      if (!sheetConfig.sheet_version) {
        console.warn('Sheet Config 表为空，创建最小配置');
        setCurrentStep('未检测到完整 Config，正在补齐基础配置...');
        await syncService.ensureConfigSheet(sheetId);
        const worksheetIds: { messagesSheetId?: number; logsSheetId?: number } = await syncService.getScheduledMessagesWorksheetIds(sheetId).catch((idError) => {
          console.warn('读取 Messages/Logs 工作表 ID 失败，将仅保存基础绑定信息:', idError);
          return {};
        });
        const minimalConfig: SheetConfig = {
          sheetId,
          sheetUrl: canonicalSheetUrl,
          messagesSheetId: worksheetIds.messagesSheetId,
          logsSheetId: worksheetIds.logsSheetId,
          sheet_version: '2.0',
          created_by: 'Manual',
          created_at: new Date().toISOString()
        };
        if (pauseForManualBindDecision(minimalConfig, 'sync')) {
          return;
        }
        await syncService.syncConfig(minimalConfig);
      } else {
        const needsMessagesSheetId = sheetConfig.messagesSheetId === undefined || sheetConfig.messagesSheetId === null;
        const needsLogsSheetId = sheetConfig.logsSheetId === undefined || sheetConfig.logsSheetId === null;
        let recoveredConfig = sheetConfig;
        let shouldWriteRecoveredConfig = false;

        if (needsMessagesSheetId || needsLogsSheetId) {
          try {
            setCurrentStep('正在检查 Messages/Logs 工作表定位...');
            recoveredConfig = await syncService.recoverScheduledMessagesWorksheetIds(sheetId, sheetConfig);
            const recoveredWorksheetIds =
              (needsMessagesSheetId && recoveredConfig.messagesSheetId !== undefined && recoveredConfig.messagesSheetId !== null) ||
              (needsLogsSheetId && recoveredConfig.logsSheetId !== undefined && recoveredConfig.logsSheetId !== null);

            if (recoveredWorksheetIds) {
              shouldWriteRecoveredConfig = true;
            }
          } catch (idError) {
            console.warn('读取 Messages/Logs 工作表 ID 失败，将仅恢复已有 Config:', idError);
          }
        }

        const writeMode: ManualBindWriteMode = shouldWriteRecoveredConfig ? 'sync' : 'storage';
        if (pauseForManualBindDecision(recoveredConfig as SheetConfig, writeMode)) {
          return;
        }

        if (writeMode === 'sync') {
          setCurrentStep('正在把子表定位写回 Config...');
          await syncService.syncConfig(recoveredConfig as SheetConfig);
        } else {
          // 保存从 Sheet 读取的完整配置到 Chrome Storage
          setCurrentStep('正在恢复本地配置...');
          await syncService.saveConfigToStorage(recoveredConfig as any);
        }

        console.log('✅ 从 Sheet 读取并绑定配置:', recoveredConfig);
      }
      
      // 刷新页面
      completeManualBind();
      
    } catch (err: any) {
      console.error('绑定 Sheet 失败:', err);
      setError(getManualBindErrorMessage(err));
      setIsInitializing(false);
    }
  };

  const completeManualBind = () => {
    setManualBindDecision(null);
    setCurrentStep('配置绑定成功，正在刷新...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleKeepLocalConfig = async () => {
    if (!manualBindDecision || manualBindDecision.kind !== 'local-newer') {
      return;
    }

    setIsInitializing(true);
    setError('');
    setCurrentStep('正在保留本机配置并同步到 Sheet...');

    try {
      const token = authToken || await getAuthTokenWithForceRefresh();
      if (!token) {
        throw new Error('无法获取 Google 授权');
      }

      const { ConfigSyncService } = await import('../ConfigSyncService');
      const syncService = new ConfigSyncService(token || '');
      await syncService.syncConfig({
        ...manualBindDecision.localConfig,
        sheetId: manualBindDecision.sheetConfig.sheetId,
        sheetUrl: manualBindDecision.canonicalSheetUrl,
      });
      completeManualBind();
    } catch (err: any) {
      console.error('同步本机配置到 Sheet 失败:', err);
      setError(getManualBindErrorMessage(err));
      setIsInitializing(false);
    }
  };

  const handleUsePendingSheetConfig = async () => {
    if (!manualBindDecision) {
      return;
    }

    setIsInitializing(true);
    setError('');
    setCurrentStep(
      manualBindDecision.writeMode === 'sync'
        ? '正在写回 Config 并恢复本机...'
        : '正在用 Sheet 配置恢复本机...'
    );

    try {
      const { ConfigSyncService } = await import('../ConfigSyncService');
      const token = manualBindDecision.writeMode === 'sync'
        ? authToken || await getAuthTokenWithForceRefresh()
        : authToken || '';

      if (manualBindDecision.writeMode === 'sync' && !token) {
        throw new Error('无法获取 Google 授权');
      }

      const syncService = new ConfigSyncService(token || '');
      if (manualBindDecision.writeMode === 'sync') {
        await syncService.syncConfig(manualBindDecision.sheetConfig);
      } else {
        await syncService.saveConfigToStorage(manualBindDecision.sheetConfig);
      }
      completeManualBind();
    } catch (err: any) {
      console.error('用 Sheet 恢复本机配置失败:', err);
      setError(getManualBindErrorMessage(err));
      setIsInitializing(false);
    }
  };

  const handleCancelManualBindDecision = () => {
    setManualBindDecision(null);
    setCurrentStep('');
    setIsInitializing(false);
    setError('');
  };
  
  // Google Auth Token 已迁移到 utils/googleAuth.ts
  // 使用 forceRefresh: true 以确保应用新的权限范围
  const getAuthTokenWithForceRefresh = async (): Promise<string | null> => {
    return getGoogleAuthToken({ 
      caller: 'OneClickSetup.getAuthToken',
      forceRefresh: true  // 强制刷新，以应用新的权限范围
    });
  };
  
  const getManualBindErrorMessage = (err: any): string => {
    const message = err?.message || '';
    if (message.includes('401') || message.includes('invalid_token') || message.includes('Unauthorized')) {
      return '绑定失败：Google 授权已失效，请重新授权后再试。';
    }
    if (message.includes('403')) {
      return '绑定失败：当前 Google 账号没有访问这个 Sheet 的权限。';
    }
    if (message.includes('404') || message.includes('Requested entity was not found')) {
      return '绑定失败：找不到这个 Sheet，请确认链接或 ID 是否正确。';
    }
    if (message.includes('读取 Sheet 配置失败')) {
      return '绑定失败：无法读取 Config 工作表。请确认这是定时消息维护表，且当前 Google 账号有访问权限。';
    }
    if (message.includes('Unable to parse range')) {
      return '绑定失败：找不到 Config 工作表，且自动补齐失败。请确认这是定时消息维护表，且当前 Google 账号有编辑权限。';
    }
    return message || '绑定失败，请检查 Sheet URL、Config 工作表和 Google 授权状态';
  };

  const manualBindInputHasValue = Boolean(manualSheetUrl.trim());
  const manualBindDisabled = isInitializing || !manualBindFeedback.sheetId;
  const manualBindDisplayId = manualBindFeedback.sheetId
    ? formatSheetIdForDisplay(manualBindFeedback.sheetId)
    : '';
  const manualBindRestoreScope = manualBindDecision
    ? getManualBindRestoreScope(manualBindDecision.sheetConfig)
    : [];
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🚀 开始使用定时消息管理</h1>
      </div>
      
      <div style={styles.content}>
        {needsAppScriptAPI ? (
          // AppScript API 开启界面
          <div style={styles.apiSection}>
            <h2 style={styles.authTitle}>⚙️ 需要开启 AppScript API</h2>
            <p style={styles.authDescription}>
              在创建 Apps Script 项目之前，您需要先开启 Google Apps Script API。
            </p>
            
            <div style={styles.authSteps}>
              <p style={styles.stepTitle}>请按照以下步骤操作：</p>
              <ol style={styles.stepList}>
                <li>点击下方"打开 AppScript 设置页面"按钮</li>
                <li>在新打开的页面中，找到 "Google Apps Script API" 设置</li>
                <li>将开关切换到 "ON" 状态</li>
                <li>返回此页面，点击"重新初始化"按钮继续</li>
              </ol>
            </div>
            
            <button 
              style={styles.primaryButton}
              onClick={() => window.open(appScriptAPIUrl, '_blank')}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
            >
              ⚙️ 打开 AppScript 设置页面
            </button>
            
            <p style={styles.authNote}>
              💡 提示：开启 API 后，可能需要等待几秒钟让设置生效。
            </p>
            
            <p style={styles.authHint}>
              开启 API 后，点击下方按钮继续：
            </p>
            
            <button 
              style={styles.completeButton}
              onClick={() => {
                setNeedsAppScriptAPI(false);
                setError('');
                handleOneClickSetup();
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
            >
              ✅ 我已开启 API，重新初始化
            </button>
            
            {error && (
              <div style={styles.error}>
                ❌ {error}
              </div>
            )}
          </div>
        ) : needsAuth ? (
          // 授权界面
          <>
          {!isInitializing ? (
            <>
              {error && (
                <div style={error.includes('尚未完成授权') ? styles.authError : styles.error}>
                  {error}
                </div>
              )}

              <div style={styles.authSection}>
                <h2 style={styles.authTitle}>🔐 需要授权</h2>
                <p style={styles.authDescription}>
                  系统已成功创建 Sheet 和 AppScript（完成步骤 1-5/8）
                </p>
                <p style={styles.authDescription}>
                  现在需要您授权 Apps Script 访问 Google 服务，之后将继续完成剩余步骤。
                </p>
                
                <div style={styles.authSteps}>
                  <p style={styles.stepTitle}>请按照以下步骤操作：</p>
                  <ol style={styles.stepList}>
                    <li>点击下方"打开授权页面"按钮</li>
                    <li>在新打开的页面中，点击 "REVIEW PERMISSIONS" 按钮</li>
                    <li>选择您的 Google 账号并授权应用</li>
                    <li>授权完成后，回到此页面点击"完成初始化"按钮</li>
                  </ol>
                </div>
                
                <button 
                  style={styles.primaryButton}
                  onClick={() => window.open(authUrl, '_blank')}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
                >
                  🔓 打开授权页面
                </button>
                
                <p style={styles.authNote}>
                  💡 提示：如果授权窗口已关闭，您可以随时重新点击上方按钮打开。
                </p>
                
                <p style={styles.authHint}>
                  授权完成后，点击下方按钮继续：
                </p>
                
                <button 
                  style={styles.completeButton}
                  onClick={handleCompleteAuth}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                >
                  ✅ 我已完成授权，继续初始化
                </button>
                
                {tempResult && (
                  <div style={styles.infoBox}>
                    <p style={styles.infoTitle}>📋 系统信息：</p>
                    <p style={styles.infoItem}>Sheet ID: {tempResult.sheetId}</p>
                    <p style={styles.infoItem}>
                      <a href={tempResult.sheetUrl} target="_blank" rel="noopener noreferrer">
                        📊 查看 Sheet
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>
              <p style={styles.loadingText}>{currentStep}</p>
              <p style={styles.loadingHint}>这可能需要 10-15 秒，请稍候...</p>
            </div>
          )}
          </>
        ) : !isInitializing ? (
          <>
            <p style={styles.description}>
              您还没有设置定时消息系统。
            </p>
            
            <div style={styles.features}>
              <p style={styles.featureTitle}>点击下方按钮，系统将自动为您：</p>
              <ul style={styles.featureList}>
                <li>✅ 创建 Google Sheet 维护表</li>
                <li>✅ 配置自动执行脚本</li>
                <li>✅ 设置定时触发器</li>
                <li>✅ 添加测试消息（一分钟后推送）</li>
              </ul>
            </div>
            
            <button 
              style={styles.primaryButton}
              disabled={isInitializing}
              onClick={handleOneClickSetup}
              onMouseOver={(e) => {
                if (!isInitializing) e.currentTarget.style.backgroundColor = '#0056b3';
              }}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
            >
              🚀 一键生成维护表
            </button>
            
            <div style={styles.divider}>
              <span style={styles.dividerText}>或者</span>
            </div>
            
            <div style={styles.manualSection}>
              <p style={styles.manualTitle}>如果您已有维护表，可以直接绑定：</p>
              <p style={styles.manualHint}>支持 Sheet 分享链接、Drive open?id 链接或直接粘贴 Sheet ID；旧维护表缺少 Config 时会自动补齐。</p>
              <div style={styles.syncNotice}>
                绑定会以 Sheet Config 作为跨设备恢复源；当前设备未参与写回的新字段会保留在 Sheet 中，避免旧本地配置覆盖远端设置。
              </div>
              {manualBindInputHasValue && (
                <div
                  style={manualBindFeedback.error ? styles.inputErrorHint : styles.inputPreview}
                  role={manualBindFeedback.error ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {manualBindFeedback.error ? (
                    manualBindFeedback.error
                  ) : (
                    <>
                      <div style={styles.inputPreviewTitle}>识别到维护表：{manualBindDisplayId}</div>
                      <div style={styles.inputPreviewMeta}>{manualBindFeedback.canonicalSheetUrl}</div>
                      <div style={styles.inputPreviewBody}>
                        绑定后会从 Config 恢复 Web App、触发器、Bot Automation 和 Messages/Logs 定位。
                      </div>
                    </>
                  )}
                </div>
              )}
              <div style={styles.inputGroup}>
                <input
                  type="text"
                  placeholder="粘贴 Sheet URL 或 Sheet ID..."
                  value={manualSheetUrl}
                  onChange={(e) => {
                    setManualSheetUrl(e.target.value);
                    setManualBindDecision(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !manualBindDisabled) {
                      void handleManualBind();
                    }
                  }}
                  disabled={isInitializing}
                  aria-invalid={Boolean(manualBindFeedback.error)}
                  style={styles.input}
                />
                <button 
                  style={{
                    ...styles.secondaryButton,
                    ...(manualBindDisabled ? styles.disabledButton : {}),
                  }}
                  disabled={manualBindDisabled}
                  onClick={handleManualBind}
                  onMouseOver={(e) => {
                    if (!manualBindDisabled) e.currentTarget.style.backgroundColor = '#5a6268';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = manualBindDisabled ? '#adb5bd' : '#6c757d';
                  }}
                >
                  {manualBindFeedback.sheetId ? '绑定已有表' : '等待有效链接'}
                </button>
              </div>
              {manualBindDecision && (
                <div
                  style={manualBindDecision.kind === 'different-sheet' ? styles.switchNotice : styles.conflictNotice}
                  role="alert"
                >
                  {manualBindDecision.kind === 'different-sheet' ? (
                    <>
                      <div style={styles.conflictTitle}>将切换维护表</div>
                      <div style={styles.conflictBody}>
                        当前本机：{formatSheetIdForDisplay(manualBindDecision.localConfig.sheetId)}
                      </div>
                      <div style={styles.conflictBody}>
                        新维护表：{formatSheetIdForDisplay(manualBindDecision.sheetConfig.sheetId)}
                      </div>
                      <div style={styles.conflictBody}>
                        继续后会用新维护表恢复本机配置；当前本机配置不会写入新表。
                      </div>
                      <div style={styles.scopeList}>
                        {manualBindRestoreScope.map((item) => (
                          <span key={item} style={styles.scopeItem}>{item}</span>
                        ))}
                      </div>
                      <div style={styles.conflictActions}>
                        <button
                          style={styles.warningButton}
                          onClick={handleUsePendingSheetConfig}
                        >
                          继续绑定新表
                        </button>
                        <button
                          style={styles.plainButton}
                          onClick={handleCancelManualBindDecision}
                        >
                          取消，保留本机
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.conflictTitle}>本机配置比 Sheet 更新</div>
                      <div style={styles.conflictBody}>
                        本机同步时间：{formatConfigSyncTimestamp(manualBindDecision.localConfig.last_sync_time)}
                      </div>
                      <div style={styles.conflictBody}>
                        Sheet 同步时间：{formatConfigSyncTimestamp(manualBindDecision.sheetConfig.last_sync_time)}
                      </div>
                      <div style={styles.conflictBody}>
                        请选择保留本机最新配置并写回 Sheet，或继续用 Sheet 恢复本机。
                      </div>
                      <div style={styles.scopeList}>
                        {manualBindRestoreScope.map((item) => (
                          <span key={item} style={styles.scopeItem}>{item}</span>
                        ))}
                      </div>
                      <div style={styles.conflictActions}>
                        <button
                          style={styles.warningButton}
                          onClick={handleKeepLocalConfig}
                        >
                          保留本机并同步到 Sheet
                        </button>
                        <button
                          style={styles.plainButton}
                          onClick={handleUsePendingSheetConfig}
                        >
                          仍用 Sheet 恢复本机
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {error && (
              <div style={styles.error}>
                ❌ {error}
              </div>
            )}
          </>
        ) : (
          <div style={styles.loading}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>{currentStep}</p>
            <p style={styles.loadingHint}>这可能需要 10-15 秒，请稍候...</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  description: {
    fontSize: '16px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '30px',
  },
  features: {
    marginBottom: '30px',
  },
  featureTitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '10px',
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  primaryButton: {
    width: '100%',
    padding: '15px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  divider: {
    textAlign: 'center',
    margin: '30px 0',
    position: 'relative',
  },
  dividerText: {
    backgroundColor: '#fff',
    padding: '0 10px',
    color: '#999',
    fontSize: '14px',
  },
  manualSection: {
    marginTop: '20px',
  },
  manualTitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '10px',
  },
  manualHint: {
    fontSize: '12px',
    color: '#888',
    lineHeight: 1.5,
    marginTop: '-4px',
    marginBottom: '10px',
  },
  syncNotice: {
    fontSize: '12px',
    color: '#495057',
    backgroundColor: '#f8f9fa',
    border: '1px solid #e9ecef',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  inputPreview: {
    fontSize: '12px',
    color: '#155724',
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '10px',
    overflowWrap: 'anywhere',
  },
  inputPreviewTitle: {
    fontWeight: 600,
    marginBottom: '4px',
  },
  inputPreviewMeta: {
    color: '#2f6f3e',
    fontFamily: 'monospace',
    fontSize: '11px',
    marginBottom: '6px',
  },
  inputPreviewBody: {
    lineHeight: 1.5,
  },
  inputErrorHint: {
    fontSize: '12px',
    color: '#721c24',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '6px',
    padding: '8px 10px',
    marginBottom: '10px',
    lineHeight: 1.5,
  },
  inputGroup: {
    display: 'flex',
    gap: '10px',
  },
  input: {
    flex: 1,
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
  },
  secondaryButton: {
    padding: '10px 20px',
    fontSize: '14px',
    color: '#fff',
    backgroundColor: '#6c757d',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  disabledButton: {
    backgroundColor: '#adb5bd',
    cursor: 'not-allowed',
  },
  conflictNotice: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffe08a',
    borderRadius: '6px',
    color: '#664d03',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  switchNotice: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d7ff',
    borderRadius: '6px',
    color: '#17415f',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  conflictTitle: {
    fontWeight: 700,
    marginBottom: '6px',
  },
  conflictBody: {
    marginBottom: '4px',
  },
  conflictActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '10px',
  },
  scopeList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '8px',
  },
  scopeItem: {
    padding: '3px 7px',
    borderRadius: '999px',
    backgroundColor: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(0,0,0,0.08)',
    fontSize: '12px',
    color: 'inherit',
  },
  warningButton: {
    padding: '9px 12px',
    fontSize: '13px',
    color: '#212529',
    backgroundColor: '#ffc107',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  plainButton: {
    padding: '9px 12px',
    fontSize: '13px',
    color: '#495057',
    backgroundColor: '#fff',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  completeButton: {
    padding: '15px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#28a745',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
    width: '100%',
  },
  error: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '6px',
    fontSize: '14px',
  },
  authError: {
    marginTop: '20px',
    padding: '20px',
    backgroundColor: '#fff3cd',
    color: '#856404',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 500,
    border: '2px solid #ffc107',
    lineHeight: '1.6',
  },
  loading: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #007bff',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '10px',
  },
  loadingHint: {
    fontSize: '14px',
    color: '#999',
  },
  authSection: {
    padding: '20px 0',
  },
  apiSection: {
    padding: '20px 0',
  },
  authTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center' as const,
    marginBottom: '15px',
  },
  authDescription: {
    fontSize: '15px',
    color: '#666',
    textAlign: 'center' as const,
    marginBottom: '10px',
  },
  authSteps: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  stepTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '10px',
  },
  stepList: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.8',
    paddingLeft: '20px',
  },
  authNote: {
    fontSize: '13px',
    color: '#888',
    textAlign: 'center' as const,
    marginTop: '10px',
    fontStyle: 'italic',
  },
  authHint: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center' as const,
    marginTop: '20px',
    marginBottom: '10px',
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    padding: '15px',
    borderRadius: '6px',
    marginTop: '20px',
    border: '1px solid #b3d7ff',
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '8px',
  },
  infoItem: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '5px',
  },
};

// 添加 CSS 动画
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);
