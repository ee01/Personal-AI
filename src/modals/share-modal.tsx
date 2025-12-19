import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useMemo } from 'react';

// 推荐功能定义
interface RecommendFeature {
    id: string;
    label: string;
    desc: string;
    preview?: string;  // 预览图路径
}

const RECOMMEND_FEATURES: RecommendFeature[] = [
    {
        id: 'jira-sync',
        label: '同步 JIRA 到 Sheet',
        desc: '可以一键刷新 sheet 上 Jira 数据',
        preview: 'previews/Personal AI - fetch jira.png'
    },
    {
        id: 'jira-automation',
        label: 'Jira Automation 导入',
        desc: '一键导入 Jira 自动化规则，自动向群组推送 report',
        preview: 'previews/Personal AI - import jira automation.png'
    },
    {
        id: 'scheduled-messages',
        label: '定时消息管理',
        desc: '可以假装"我"定时发消息，也可以管理 AI report',
        preview: 'previews/Personal AI - scheduled messages.png'
    },
    {
        id: 'message-analysis',
        label: '消息分析提醒',
        desc: '分析过滤出我感兴趣的话题',
        preview: 'previews/Personal AI - messages filter.png'
    },
    {
        id: 'design-link',
        label: '快速显示 Design Link',
        desc: '在 User Story 上快速跳转关联 UX 的 Design',
        preview: 'previews/Personal AI - design link.png'
    },
    {
        id: 'ask-ai',
        label: '记忆查询',
        desc: '在 RingCentral 应用内随时提问，获取记忆中 AI 智能回复',
        preview: 'previews/Personal AI - ask.png'
    }
];

const WIKI_URL = 'https://wiki.ringcentral.com/spaces/XTO/pages/911054301/Personal+AI+-+Tools';
const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/kefnadjndpllbibeklhajjddgmlbafel?authuser=0&hl=zh-CN';

const ShareModal: React.FC = () => {
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['jira-sync']);
    const [shareRecipient, setShareRecipient] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
    const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [copySuccess, setCopySuccess] = useState(false);
    const [isScheduledMsgInitialized, setIsScheduledMsgInitialized] = useState(false);
    const [showConfigOverlay, setShowConfigOverlay] = useState(false);
    const [isWaitingForConfig, setIsWaitingForConfig] = useState(false);

    // 检查配置状态
    const checkConfigStatus = async () => {
        const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
        const config = result.scheduledMessagesConfig;
        const initialized = !!(config && config.sheetId);
        setIsScheduledMsgInitialized(initialized);
        return initialized;
    };

    useEffect(() => {
        checkConfigStatus();
    }, []);

    // 监听 storage 变化
    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
            if (namespace === 'local' && changes.scheduledMessagesConfig) {
                const newConfig = changes.scheduledMessagesConfig.newValue;
                const initialized = !!(newConfig && newConfig.sheetId);
                setIsScheduledMsgInitialized(initialized);
                if (initialized && isWaitingForConfig) {
                    setIsWaitingForConfig(false);
                    setShowConfigOverlay(false);
                }
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.onChanged.removeListener(handleStorageChange);
        };
    }, [isWaitingForConfig]);

    // 轮询检查配置（作为备用方案）
    useEffect(() => {
        if (!isWaitingForConfig) return;

        const interval = setInterval(async () => {
            const initialized = await checkConfigStatus();
            if (initialized) {
                setIsWaitingForConfig(false);
                setShowConfigOverlay(false);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [isWaitingForConfig]);

    // 生成分享文案
    const shareContent = useMemo(() => {
        const selected = RECOMMEND_FEATURES.filter(f => selectedFeatures.includes(f.id));
        
        // 如果没有选择任何功能，只显示安装地址和 wiki
        if (selected.length === 0) {
            return `安装：${CHROME_STORE_URL}\n或者 [查看 wiki](${WIKI_URL})`;
        }

        const mainFeature = selected[0];
        const otherFeatures = selected.slice(1);
        
        let content = `推荐个小工具，${mainFeature.desc}`;
        
        if (otherFeatures.length > 0) {
            const otherLabels = otherFeatures.map(f => f.label).join('、');
            content += `\n还可以做到：${otherLabels} 等`;
        }
        
        content += `\n\n安装：${CHROME_STORE_URL}\n或者 [查看 wiki](${WIKI_URL})`;
        
        return content;
    }, [selectedFeatures]);

    const handleFeatureToggle = (featureId: string) => {
        setSelectedFeatures(prev => {
            if (prev.includes(featureId)) {
                return prev.filter(id => id !== featureId);
            } else {
                return [...prev, featureId];
            }
        });
    };

    const handleFeatureHover = (featureId: string | null, event?: React.MouseEvent) => {
        setHoveredFeature(featureId);
        if (event && featureId) {
            setTooltipPosition({
                x: event.clientX,
                y: event.clientY
            });
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareContent);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (error) {
            console.error('复制失败:', error);
        }
    };

    const handleOpenScheduledMessages = () => {
        setIsWaitingForConfig(true);
        chrome.windows.create({
            url: 'scheduled-messages.html',
            type: 'popup',
            width: 1280,
            height: 700,
            focused: true
        });
    };

    const handleSend = async () => {
        if (!shareRecipient.trim() || !isScheduledMsgInitialized) return;
        
        setIsSending(true);
        setSendResult(null);
        
        try {
            // 格式化用户名为 firstname.lastname 格式
            const formattedUsername = shareRecipient.trim().toLowerCase().replace(/\s+/g, '.');
            
            // 计算 1 分钟后的时间
            const now = new Date();
            const scheduleTime = new Date(now.getTime() + 60 * 1000);
            const scheduleDate = scheduleTime.toISOString().split('T')[0]; // YYYY-MM-DD
            const scheduleTimeStr = scheduleTime.toTimeString().slice(0, 5); // HH:mm
            
            // 通过 background 发送消息
            const response = await chrome.runtime.sendMessage({
                type: 'ADD_SCHEDULED_MESSAGE',
                data: {
                    Topic: 'Personal AI 推荐',
                    Content: shareContent,
                    Schedule_Date: scheduleDate,
                    Schedule_Time: scheduleTimeStr,
                    Push_Method: 'AsMe',
                    Target_Type: 'private',
                    Glip_User_Name: formattedUsername
                }
            });
            
            if (response?.success) {
                setSendResult({ success: true, message: '消息已安排发送！将在1分钟内送达' });
                setTimeout(() => {
                    window.close();
                }, 2000);
            } else {
                setSendResult({ success: false, message: response?.error || '发送失败' });
            }
        } catch (error: any) {
            console.error('发送消息失败:', error);
            setSendResult({ success: false, message: error.message || '发送失败' });
        } finally {
            setIsSending(false);
        }
    };

    const hoveredFeatureData = RECOMMEND_FEATURES.find(f => f.id === hoveredFeature);

    return (
        <div style={styles.outerContainer}>
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={styles.header}>
                        <h2 style={styles.title}>↗️ 分享 Personal AI</h2>
                        <p style={styles.subtitle}>选择要推荐的功能，发送给同事</p>
                    </div>

                    <div style={styles.content}>
                    {/* 分享文案预览 */}
                    <div style={styles.section}>
                        <label style={styles.sectionLabel}>分享文案预览：</label>
                        <textarea 
                            style={styles.contentPreview}
                            value={shareContent}
                            readOnly
                            rows={5}
                        />
                    </div>
                    
                    {/* 推荐功能选择 */}
                    <div style={styles.section}>
                        <label style={styles.sectionLabel}>选择要推荐的功能：</label>
                        <div style={styles.featureGrid}>
                            {RECOMMEND_FEATURES.map(feature => (
                                <label 
                                    key={feature.id} 
                                    style={{
                                        ...styles.featureItem,
                                        ...(selectedFeatures.includes(feature.id) ? styles.featureItemSelected : {})
                                    }}
                                    onMouseMove={(e) => feature.preview && handleFeatureHover(feature.id, e)}
                                    onMouseLeave={() => handleFeatureHover(null)}
                                >
                                    <input 
                                        type="checkbox"
                                        style={styles.checkbox}
                                        checked={selectedFeatures.includes(feature.id)}
                                        onChange={() => handleFeatureToggle(feature.id)}
                                    />
                                    <div style={styles.featureContent}>
                                        <span style={styles.featureLabel}>{feature.label}</span>
                                        <span style={styles.featureDesc}>{feature.desc}</span>
                                    </div>
                                    {feature.preview && <span style={styles.previewIcon}>🖼️</span>}
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    {/* 接收人输入 */}
                    <div style={styles.section}>
                        <label style={styles.sectionLabel}>接收人（用户名）：</label>
                        <input 
                            type="text"
                            style={styles.recipientInput}
                            placeholder="例如：Esone Qiu 或 esone.qiu"
                            value={shareRecipient}
                            onChange={e => setShareRecipient(e.target.value)}
                        />
                    </div>
                    
                    {/* 发送结果提示 */}
                    {sendResult && (
                        <div style={{
                            ...styles.resultMessage,
                            ...(sendResult.success ? styles.resultSuccess : styles.resultError)
                        }}>
                            {sendResult.success ? '✅' : '❌'} {sendResult.message}
                        </div>
                    )}
                </div>
            </div>
                
            {/* 固定在底部的按钮栏 */}
                <div style={styles.fixedFooter}>
                    <div style={styles.footerButtonGroup}>
                        <button 
                            style={{
                                ...styles.btn,
                                ...styles.btnCopy,
                                ...(copySuccess ? styles.btnCopySuccess : {})
                            }}
                            onClick={handleCopy}
                            disabled={!shareContent}
                        >
                            {copySuccess ? '✅ 已复制' : '📋 复制文案'}
                        </button>
                        
                        <div 
                            style={styles.sendBtnWrapper}
                            onMouseEnter={() => {
                                if (!isScheduledMsgInitialized) {
                                    setShowConfigOverlay(true);
                                }
                            }}
                            onMouseLeave={() => {
                                if (!isWaitingForConfig) {
                                    setShowConfigOverlay(false)
                                }
                            }}
                        >
                            <button 
                                style={{
                                    ...styles.btn,
                                    ...styles.btnSend,
                                    ...(!isScheduledMsgInitialized || !shareRecipient.trim() || isSending ? styles.btnDisabled : {})
                                }}
                                onClick={handleSend}
                                disabled={!isScheduledMsgInitialized || !shareRecipient.trim() || isSending || !shareContent}
                            >
                                {isSending ? '发送中...' : '↗️ 发送'}
                            </button>
                            
                            {/* 配置引导遮盖按钮 - 滑出效果 */}
                            {showConfigOverlay && !isScheduledMsgInitialized && (
                                <button
                                    style={styles.configOverlayBtn}
                                    onClick={handleOpenScheduledMessages}
                                >
                                    {isWaitingForConfig ? '⏳ 等待配置完成...' : '⚙️ 需配置定时消息'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 图片预览浮动 Tooltip */}
            {hoveredFeature && hoveredFeatureData?.preview && (
                <div style={{
                    ...styles.previewTooltip,
                    left: `${Math.min(tooltipPosition.x + 15, window.innerWidth - 420)}px`,
                    top: `${tooltipPosition.y + 30}px`,
                }}>
                    <div style={styles.previewTooltipHeader}>{hoveredFeatureData.label}</div>
                    <img 
                        src={chrome.runtime.getURL(hoveredFeatureData.preview)} 
                        alt={hoveredFeatureData.label}
                        style={styles.previewImage}
                    />
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    outerContainer: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
    },
    container: {
        flex: 1,
        padding: '20px',
        paddingBottom: '100px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
    },
    card: {
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        padding: '24px 28px',
        borderBottom: '1px solid #eee',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
    },
    title: {
        margin: 0,
        fontSize: '22px',
        color: '#333',
        fontWeight: 600,
    },
    subtitle: {
        margin: '8px 0 0 0',
        fontSize: '14px',
        color: '#666',
    },
    content: {
        padding: '24px 28px',
    },
    section: {
        marginBottom: '24px',
    },
    sectionLabel: {
        display: 'block',
        fontSize: '14px',
        fontWeight: 600,
        color: '#444',
        marginBottom: '12px',
    },
    featureGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '10px',
    },
    featureItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        background: '#f8f9fa',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '2px solid transparent',
    },
    featureItemSelected: {
        background: '#e7f3ff',
        borderColor: '#2196F3',
    },
    checkbox: {
        width: '18px',
        height: '18px',
        marginTop: '2px',
        cursor: 'pointer',
        accentColor: '#2196F3',
    },
    featureContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    featureLabel: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#333',
    },
    featureDesc: {
        fontSize: '12px',
        color: '#666',
        lineHeight: '1.4',
    },
    previewIcon: {
        fontSize: '14px',
        opacity: 0.6,
    },
    contentPreview: {
        width: '100%',
        padding: '14px',
        border: '1px solid #ddd',
        borderRadius: '10px',
        fontSize: '13px',
        lineHeight: '1.6',
        resize: 'none',
        background: '#f8f9fa',
        color: '#333',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
    },
    recipientInput: {
        width: '100%',
        padding: '14px 16px',
        border: '1px solid #ddd',
        borderRadius: '10px',
        fontSize: '15px',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        outline: 'none',
    },
    resultMessage: {
        padding: '12px 16px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 500,
    },
    resultSuccess: {
        background: '#d4edda',
        color: '#155724',
        border: '1px solid #c3e6cb',
    },
    resultError: {
        background: '#f8d7da',
        color: '#721c24',
        border: '1px solid #f5c6cb',
    },
    fixedFooter: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '20px 28px',
        borderTop: '1px solid #eee',
        background: '#f8f9fa',
        zIndex: 100,
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'flex-end',
    },
    footerButtonGroup: {
        display: 'flex',
        gap: '12px',
    },
    btn: {
        minWidth: '140px',
        padding: '14px 24px',
        fontSize: '15px',
        fontWeight: 600,
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    btnCopy: {
        background: '#6c757d',
        color: 'white',
    },
    btnCopySuccess: {
        background: '#28a745',
    },
    btnSend: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
    },
    btnDisabled: {
        cursor: 'not-allowed',
        opacity: 0.6,
    },
    sendBtnWrapper: {
        position: 'relative',
    },
    configOverlayBtn: {
        position: 'absolute',
        top: '-48px',
        left: 0,
        right: 0,
        width: '100%',
        padding: '14px 20px',
        fontSize: '14px',
        fontWeight: 600,
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
        color: '#333',
        boxShadow: '0 -4px 12px rgba(255, 152, 0, 0.3)',
        animation: 'slideDown 0.3s ease-out',
        zIndex: 10,
    },
    previewTooltip: {
        position: 'fixed',
        backgroundColor: '#333',
        color: '#fff',
        padding: '12px',
        borderRadius: '12px',
        zIndex: 10000,
        pointerEvents: 'none',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        maxWidth: '400px',
    },
    previewTooltipHeader: {
        fontWeight: 'bold',
        marginBottom: '10px',
        fontSize: '14px',
        color: '#ffc107',
    },
    previewImage: {
        maxWidth: '100%',
        borderRadius: '8px',
        display: 'block',
    },
};

// 添加动画样式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    input:focus {
        border-color: #2196F3 !important;
        box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.2) !important;
    }
    
    button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .feature-item:hover {
        background: #e9ecef !important;
    }
`;
document.head.appendChild(styleSheet);

ReactDOM.render(
    <React.StrictMode>
        <ShareModal />
    </React.StrictMode>,
    document.getElementById('share-modal-root')
);

