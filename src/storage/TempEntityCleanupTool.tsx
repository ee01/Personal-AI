import React, { useState } from 'react';
import { memorySystem } from '../memory';
import type { MemoryEntity } from '../memory';

/**
 * 🧹 临时实体清理工具
 * 
 * 功能：
 * 1. 扫描所有实体，找出 relatedData 中包含 temp_ 开头ID的实体
 * 2. 尝试通过实体名称和类型查找真实的实体ID
 * 3. 替换临时ID为真实ID
 * 4. 移除无法解析的临时实体引用
 * 
 * 问题说明：
 * 旧版本代码在构建实体关联数据时，为共现的其他实体生成了 temp_ 开头的临时ID，
 * 但没有后续解析为真实ID的逻辑，导致关联数据中充斥着无效的临时ID引用。
 */

interface CleanupStats {
  totalEntities: number;
  entitiesWithTempRefs: number;
  tempRefsFound: number;
  tempRefsResolved: number;
  tempRefsRemoved: number;
  entitiesUpdated: number;
  errors: string[];
}

interface TempReference {
  entityId: string;
  entityName: string;
  field: string; // 'people', 'projects', 'topics', 'cooccurringEntities', etc.
  tempId: string;
  name: string;
  type: string;
}

export const TempEntityCleanupTool: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanResult, setScanResult] = useState<TempReference[]>([]);
  const [cleanupStats, setCleanupStats] = useState<CleanupStats | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  /**
   * 扫描所有实体，找出包含临时ID引用的实体
   */
  const scanTempReferences = async () => {
    setIsScanning(true);
    setProgress({ current: 0, total: 0 });
    setScanResult([]);
    
    try {
      // 获取所有实体
      const allEntities = await memorySystem.searchEntities({
        query: '',
        limit: 100000,
        offset: 0
      });

      setProgress({ current: 0, total: allEntities.length });
      
      const tempRefs: TempReference[] = [];
      
      for (let i = 0; i < allEntities.length; i++) {
        const entity = allEntities[i];
        setProgress({ current: i + 1, total: allEntities.length });
        
        if (!entity.relatedData) continue;
        
        // 检查各个关联数据字段
        const fields = [
          { key: 'people', items: entity.relatedData.people || [] },
          { key: 'projects', items: entity.relatedData.projects || [] },
          { key: 'topics', items: entity.relatedData.topics || [] },
          { key: 'jiraTickets', items: entity.relatedData.jiraTickets || [] },
          { key: 'resources', items: entity.relatedData.resources || [] },
          { key: 'cooccurringEntities', items: entity.relatedData.cooccurringEntities || [] }
        ];
        
        for (const field of fields) {
          for (const item of field.items) {
            if (item.id && item.id.startsWith('temp_')) {
              // 从临时ID中提取类型和名称
              // 格式: temp_Type_Name_Timestamp
              const match = item.id.match(/^temp_([^_]+)_(.+)_\d+$/);
              if (match) {
                const [, type, name] = match;
                tempRefs.push({
                  entityId: entity.id,
                  entityName: entity.name,
                  field: field.key,
                  tempId: item.id,
                  name: name,
                  type: type
                });
              } else {
                // 如果ID格式不符合预期，也记录下来
                tempRefs.push({
                  entityId: entity.id,
                  entityName: entity.name,
                  field: field.key,
                  tempId: item.id,
                  name: item.name || 'unknown',
                  type: 'unknown'
                });
              }
            }
          }
        }
      }
      
      setScanResult(tempRefs);
      console.log(`🔍 扫描完成，发现 ${tempRefs.length} 个临时ID引用`);
      
    } catch (error) {
      console.error('扫描失败:', error);
      alert(`扫描失败: ${error}`);
    } finally {
      setIsScanning(false);
    }
  };

  /**
   * 清理临时引用：解析或移除
   */
  const cleanupTempReferences = async () => {
    if (scanResult.length === 0) {
      alert('请先执行扫描');
      return;
    }
    
    if (!confirm(`发现 ${scanResult.length} 个临时ID引用，确定要清理吗？`)) {
      return;
    }
    
    setIsCleaning(true);
    setProgress({ current: 0, total: scanResult.length });
    
    const stats: CleanupStats = {
      totalEntities: 0,
      entitiesWithTempRefs: 0,
      tempRefsFound: scanResult.length,
      tempRefsResolved: 0,
      tempRefsRemoved: 0,
      entitiesUpdated: 0,
      errors: []
    };
    
    try {
      // 按 entityId 分组
      const refsByEntity = new Map<string, TempReference[]>();
      for (const ref of scanResult) {
        if (!refsByEntity.has(ref.entityId)) {
          refsByEntity.set(ref.entityId, []);
        }
        refsByEntity.get(ref.entityId)!.push(ref);
      }
      
      stats.entitiesWithTempRefs = refsByEntity.size;
      
      let processedCount = 0;
      
      // 处理每个实体
      for (const [entityId, refs] of refsByEntity.entries()) {
        try {
          // 获取实体
          const entity = await memorySystem.getEntityDetails(entityId);
          if (!entity) {
            stats.errors.push(`实体不存在: ${entityId}`);
            continue;
          }
          
          let hasChanges = false;
          const relatedData = entity.relatedData || {
            conversations: [], webpages: [], resources: [], projects: [],
            people: [], topics: [], jiraTickets: [], cooccurringEntities: []
          };
          
          // 处理每个临时引用
          for (const ref of refs) {
            processedCount++;
            setProgress({ current: processedCount, total: scanResult.length });
            
            try {
              // 尝试查找真实实体
              const searchResults = await memorySystem.searchEntities({
                query: ref.name,
                type: ref.type !== 'unknown' ? ref.type : undefined,
                limit: 5
              });
              
              // 找到名称完全匹配的实体
              const matchedEntity = searchResults.find(
                e => e.name === ref.name && e.type === ref.type
              );
              
              if (matchedEntity && matchedEntity.id !== ref.tempId) {
                // 找到了真实实体，替换临时ID
                const field = relatedData[ref.field as keyof typeof relatedData] as any[];
                const itemIndex = field.findIndex((item: any) => item.id === ref.tempId);
                
                if (itemIndex >= 0) {
                  field[itemIndex].id = matchedEntity.id;
                  hasChanges = true;
                  stats.tempRefsResolved++;
                  console.log(`✅ 解析成功: ${ref.tempId} -> ${matchedEntity.id} (${ref.name})`);
                }
              } else {
                // 没找到真实实体，移除临时引用
                const field = relatedData[ref.field as keyof typeof relatedData] as any[];
                const itemIndex = field.findIndex((item: any) => item.id === ref.tempId);
                
                if (itemIndex >= 0) {
                  field.splice(itemIndex, 1);
                  hasChanges = true;
                  stats.tempRefsRemoved++;
                  console.log(`🗑️ 移除临时引用: ${ref.tempId} (${ref.name})`);
                }
              }
            } catch (error) {
              stats.errors.push(`处理引用失败 ${ref.tempId}: ${error}`);
            }
          }
          
          // 如果有修改，更新实体
          if (hasChanges) {
            await memorySystem.updateEntity(entityId, { relatedData });
            stats.entitiesUpdated++;
            console.log(`💾 实体已更新: ${entity.name} (${entityId})`);
          }
          
        } catch (error) {
          stats.errors.push(`处理实体失败 ${entityId}: ${error}`);
        }
      }
      
      stats.totalEntities = refsByEntity.size;
      setCleanupStats(stats);
      
      alert(`清理完成！\n已解析: ${stats.tempRefsResolved}\n已移除: ${stats.tempRefsRemoved}\n已更新实体: ${stats.entitiesUpdated}`);
      
    } catch (error) {
      console.error('清理失败:', error);
      alert(`清理失败: ${error}`);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🧹 临时实体引用清理工具</h1>
      
      <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>📝 工具说明</h3>
        <p>
          此工具用于清理实体关联数据中的临时ID引用（temp_ 开头）。
        </p>
        <ul>
          <li><strong>问题原因</strong>: 旧版本代码在构建实体关联数据时生成了临时ID，但没有解析为真实ID</li>
          <li><strong>清理策略</strong>:
            <ol>
              <li>扫描所有实体，找出包含 temp_ 开头ID的引用</li>
              <li>尝试通过名称和类型查找真实实体</li>
              <li>如果找到真实实体，替换临时ID；否则移除该引用</li>
            </ol>
          </li>
          <li><strong>注意</strong>: 此操作会修改数据库，建议先备份</li>
        </ul>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={scanTempReferences}
          disabled={isScanning || isCleaning}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            marginRight: '10px',
            cursor: isScanning || isCleaning ? 'not-allowed' : 'pointer',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {isScanning ? '扫描中...' : '🔍 扫描临时引用'}
        </button>
        
        <button
          onClick={cleanupTempReferences}
          disabled={isScanning || isCleaning || scanResult.length === 0}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: isScanning || isCleaning || scanResult.length === 0 ? 'not-allowed' : 'pointer',
            background: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {isCleaning ? '清理中...' : '🧹 执行清理'}
        </button>
      </div>
      
      {(isScanning || isCleaning) && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '5px' }}>
            进度: {progress.current} / {progress.total}
          </div>
          <div style={{ 
            width: '100%', 
            height: '20px', 
            background: '#e0e0e0', 
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
              height: '100%',
              background: '#4CAF50',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}
      
      {scanResult.length > 0 && !isCleaning && (
        <div style={{ marginBottom: '20px' }}>
          <h3>📊 扫描结果</h3>
          <p>发现 <strong>{scanResult.length}</strong> 个临时ID引用</p>
          
          <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f5f5f5' }}>
                <tr>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>实体</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>字段</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>临时ID</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>名称</th>
                  <th style={{ padding: '8px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>类型</th>
                </tr>
              </thead>
              <tbody>
                {scanResult.slice(0, 100).map((ref, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{ref.entityName}</td>
                    <td style={{ padding: '8px' }}>{ref.field}</td>
                    <td style={{ padding: '8px', fontSize: '12px', color: '#666' }}>{ref.tempId}</td>
                    <td style={{ padding: '8px' }}>{ref.name}</td>
                    <td style={{ padding: '8px' }}>{ref.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {scanResult.length > 100 && (
              <div style={{ padding: '10px', textAlign: 'center', color: '#666' }}>
                ... 还有 {scanResult.length - 100} 个引用未显示
              </div>
            )}
          </div>
        </div>
      )}
      
      {cleanupStats && (
        <div style={{ marginTop: '20px', background: '#e8f5e9', padding: '15px', borderRadius: '8px' }}>
          <h3>✅ 清理完成</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li>📊 涉及实体数: {cleanupStats.entitiesWithTempRefs}</li>
            <li>🔍 发现临时引用: {cleanupStats.tempRefsFound}</li>
            <li>✅ 成功解析: {cleanupStats.tempRefsResolved}</li>
            <li>🗑️ 已移除: {cleanupStats.tempRefsRemoved}</li>
            <li>💾 已更新实体: {cleanupStats.entitiesUpdated}</li>
            {cleanupStats.errors.length > 0 && (
              <li>
                ❌ 错误数: {cleanupStats.errors.length}
                <details style={{ marginTop: '10px' }}>
                  <summary style={{ cursor: 'pointer' }}>查看错误详情</summary>
                  <ul style={{ marginTop: '10px', maxHeight: '200px', overflow: 'auto' }}>
                    {cleanupStats.errors.map((error, idx) => (
                      <li key={idx} style={{ fontSize: '12px', color: '#d32f2f' }}>{error}</li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TempEntityCleanupTool;

