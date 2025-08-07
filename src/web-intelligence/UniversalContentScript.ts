/**
 * 通用网页智能分析内容脚本
 * 在任何网页上运行，智能识别与用户项目相关的信息
 */

import { WebIntelligenceAnalyzer, PageContent, WebAnalysisResult } from './WebIntelligenceAnalyzer';
import { RelevanceDetector } from './RelevanceDetector';

interface UserNotificationConfig {
  showIndicator: boolean;
  autoAnalyze: boolean;
  relevanceThreshold: number;
  analysisDelay: number;
}

interface AnalysisState {
  isAnalyzing: boolean;
  lastAnalysis: number;
  relevanceScore: number;
  hasUserInteracted: boolean;
}

class UniversalContentScript {
  private analyzer: WebIntelligenceAnalyzer;
  private relevanceDetector: RelevanceDetector;
  private config: UserNotificationConfig;
  private state: AnalysisState;
  private contentObserver?: MutationObserver;
  private analysisDebounceTimer?: NodeJS.Timeout;
  private indicatorElement?: HTMLElement;

  constructor() {
    this.analyzer = new WebIntelligenceAnalyzer();
    this.relevanceDetector = new RelevanceDetector();
    
    // 默认配置
    this.config = {
      showIndicator: true,
      autoAnalyze: false,
      relevanceThreshold: 0.7,
      analysisDelay: 2000
    };
    
    this.state = {
      isAnalyzing: false,
      lastAnalysis: 0,
      relevanceScore: 0,
      hasUserInteracted: false
    };
  }

  /**
   * 初始化内容脚本
   */
  async initialize(): Promise<void> {
    try {
      // 加载用户配置
      await this.loadUserConfig();
      
      // 延迟执行初始分析，避免影响页面加载
      setTimeout(() => {
        this.performInitialAnalysis();
      }, this.config.analysisDelay);
      
      // 设置内容变化监听
      this.setupContentObserver();
      
      // 设置用户交互监听
      this.setupUserInteractionListeners();
      
      // 监听来自背景脚本的消息
      this.setupMessageListeners();
      
      console.log('🧠 Universal Content Script initialized');
      
    } catch (error) {
      console.error('Universal Content Script initialization failed:', error);
    }
  }

  /**
   * 加载用户配置
   */
  private async loadUserConfig(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get('webIntelligenceConfig');
      if (result.webIntelligenceConfig) {
        this.config = { ...this.config, ...result.webIntelligenceConfig };
      }
    } catch (error) {
      console.warn('Failed to load user config, using defaults');
    }
  }

  /**
   * 执行初始页面分析
   */
  private async performInitialAnalysis(): Promise<void> {
    if (this.state.isAnalyzing || this.shouldSkipAnalysis()) {
      return;
    }

    this.state.isAnalyzing = true;
    
    try {
      const pageContent = this.extractPageContent();
      
      // 快速相关性检测
      const relevanceScore = await this.relevanceDetector.calculateRelevance(pageContent);
      this.state.relevanceScore = relevanceScore;
      
      if (relevanceScore > this.config.relevanceThreshold) {
        // 执行快速分析
        const analysisResult = await this.analyzer.quickAnalyze(pageContent);
        
        if (analysisResult.isRelevant && this.config.showIndicator) {
          this.showRelevanceIndicator(analysisResult);
        }
        
        // 记录分析结果到本地存储
        await this.recordAnalysisResult(pageContent.url, analysisResult);
      }
      
      this.state.lastAnalysis = Date.now();
      
    } catch (error) {
      console.error('Initial analysis failed:', error);
    } finally {
      this.state.isAnalyzing = false;
    }
  }

  /**
   * 提取页面内容
   */
  private extractPageContent(): PageContent {
    const title = document.title;
    const url = window.location.href;
    const domain = window.location.hostname;
    
    // 提取主要文本内容
    const mainContent = this.getMainTextContent();
    
    // 提取元数据
    const metadata = this.extractMetadata();
    
    // 检测页面类型
    const pageType = this.detectPageType(url, title, mainContent);
    
    return {
      title,
      url,
      domain,
      mainContent,
      metadata,
      pageType,
      timestamp: Date.now(),
      wordCount: mainContent.split(/\s+/).length,
      language: this.detectLanguage(mainContent)
    };
  }

  /**
   * 获取页面主要文本内容
   */
  private getMainTextContent(): string {
    // 移除脚本、样式等无关元素
    const elementsToRemove = ['script', 'style', 'nav', 'footer', 'aside'];
    const content = document.body.cloneNode(true) as HTMLElement;
    
    elementsToRemove.forEach(tag => {
      const elements = content.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });
    
    // 优先提取主要内容区域
    const mainSelectors = [
      'main', '[role="main"]', '.main-content', '#main-content',
      'article', '.article', '.post', '.content', '.page-content'
    ];
    
    for (const selector of mainSelectors) {
      const mainElement = content.querySelector(selector);
      if (mainElement && mainElement.textContent && mainElement.textContent.trim().length > 100) {
        return mainElement.textContent.trim();
      }
    }
    
    // 如果没有找到主要内容区域，返回body文本
    return content.textContent?.trim() || '';
  }

  /**
   * 提取页面元数据
   */
  private extractMetadata(): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // 提取meta标签
    document.querySelectorAll('meta').forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    // 提取结构化数据
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        metadata.structuredData = data;
      } catch (e) {
        // 忽略解析错误
      }
    });
    
    // 提取其他有用信息
    metadata.lastModified = document.lastModified;
    metadata.referrer = document.referrer;
    metadata.characterSet = document.characterSet;
    
    return metadata;
  }

  /**
   * 检测页面类型
   */
  private detectPageType(url: string, title: string, content: string): string {
    // Jira页面
    if (url.includes('jira') && (url.includes('/browse/') || title.includes('JIRA'))) {
      return 'jira';
    }
    
    // Confluence页面
    if (url.includes('confluence') || title.includes('Confluence')) {
      return 'confluence';
    }
    
    // Google Docs
    if (url.includes('docs.google.com')) {
      if (url.includes('/spreadsheets/')) return 'google_sheets';
      if (url.includes('/presentation/')) return 'google_slides';
      if (url.includes('/document/')) return 'google_docs';
    }
    
    // GitHub
    if (url.includes('github.com')) {
      return 'github';
    }
    
    // Slack
    if (url.includes('slack.com')) {
      return 'slack';
    }
    
    // 技术博客/文档
    if (this.isTechnicalContent(url, title, content)) {
      return 'technical_doc';
    }
    
    // 新闻/文章
    if (this.isNewsArticle(url, title, content)) {
      return 'news_article';
    }
    
    return 'general';
  }

  /**
   * 检测是否为技术内容
   */
  private isTechnicalContent(url: string, title: string, content: string): boolean {
    const techKeywords = [
      'api', 'documentation', 'developer', 'programming', 'code',
      'tutorial', 'guide', 'reference', 'sdk', 'framework'
    ];
    
    const text = (title + ' ' + content).toLowerCase();
    return techKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 检测是否为新闻文章
   */
  private isNewsArticle(url: string, title: string, content: string): boolean {
    // 检查是否有文章结构
    const hasArticleStructure = document.querySelector('article') || 
                               document.querySelector('.article') ||
                               document.querySelector('[role="article"]');
    
    // 检查日期信息
    const hasDateInfo = document.querySelector('time') ||
                       content.includes('发布时间') ||
                       content.includes('更新时间');
    
    return !!(hasArticleStructure && hasDateInfo);
  }

  /**
   * 检测语言
   */
  private detectLanguage(content: string): string {
    // 简单的语言检测
    const chineseChars = content.match(/[\u4e00-\u9fff]/g);
    if (chineseChars && chineseChars.length > content.length * 0.3) {
      return 'zh';
    }
    return 'en';
  }

  /**
   * 显示相关性指示器
   */
  private showRelevanceIndicator(analysisResult: WebAnalysisResult): void {
    if (this.indicatorElement) {
      this.indicatorElement.remove();
    }

    this.indicatorElement = document.createElement('div');
    this.indicatorElement.className = 'brain-system-relevance-indicator';
    this.indicatorElement.innerHTML = `
      <div class="indicator-content">
        <div class="indicator-header">
          <span class="brain-icon">🧠</span>
          <span class="title">发现相关信息</span>
          <span class="confidence">${Math.round(analysisResult.confidence * 100)}%</span>
          <button class="close-btn" data-action="close">×</button>
        </div>
        <div class="indicator-body">
          <div class="extracted-info">
            ${this.formatExtractedInfo(analysisResult.extractedInfo)}
          </div>
          <div class="actions">
            <button class="analyze-btn" data-action="analyze">
              <span class="icon">🔍</span>
              深度分析并保存
            </button>
            <button class="quick-save-btn" data-action="quick-save">
              <span class="icon">💾</span>
              快速保存
            </button>
            <button class="dismiss-btn" data-action="dismiss">忽略</button>
          </div>
        </div>
      </div>
    `;

    // 添加事件监听器
    this.indicatorElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action') || 
                    target.closest('[data-action]')?.getAttribute('data-action');
      
      switch (action) {
        case 'analyze':
          this.handleDeepAnalysis(analysisResult);
          break;
        case 'quick-save':
          this.handleQuickSave(analysisResult);
          break;
        case 'dismiss':
        case 'close':
          this.hideRelevanceIndicator();
          break;
      }
    });

    // 添加样式
    this.addIndicatorStyles();
    
    document.body.appendChild(this.indicatorElement);

    // 自动消失
    setTimeout(() => {
      if (this.indicatorElement && !this.state.hasUserInteracted) {
        this.hideRelevanceIndicator();
      }
    }, 30000);
  }

  /**
   * 格式化提取的信息
   */
  private formatExtractedInfo(extractedInfo: any): string {
    const items = [];
    
    if (extractedInfo.projects?.length > 0) {
      items.push(`项目: ${extractedInfo.projects.join(', ')}`);
    }
    
    if (extractedInfo.people?.length > 0) {
      items.push(`人员: ${extractedInfo.people.join(', ')}`);
    }
    
    if (extractedInfo.deadlines?.length > 0) {
      items.push(`时间: ${extractedInfo.deadlines.map(d => new Date(d).toLocaleDateString()).join(', ')}`);
    }
    
    if (extractedInfo.actionItems?.length > 0) {
      items.push(`行动项: ${extractedInfo.actionItems.length}个`);
    }
    
    return items.length > 0 ? 
      `<div class="info-items">${items.map(item => `<div class="info-item">${item}</div>`).join('')}</div>` :
      '<div class="no-specific-info">检测到相关内容</div>';
  }

  /**
   * 处理深度分析
   */
  private async handleDeepAnalysis(quickResult: WebAnalysisResult): Promise<void> {
    this.state.hasUserInteracted = true;
    this.showAnalysisProgress();

    try {
      const pageContent = this.extractPageContent();
      
      // 发送到背景脚本进行深度分析
      const response = await chrome.runtime.sendMessage({
        type: 'DEEP_ANALYZE_WEB_CONTENT',
        data: {
          pageContent,
          quickResult,
          userAction: 'deep_analyze'
        }
      });

      if (response.success) {
        this.showSuccessNotification('信息已分析并保存到知识库');
        
        // 记录用户行为
        await this.recordUserAction('deep_analysis_accepted', pageContent.url);
      } else {
        throw new Error(response.error || 'Analysis failed');
      }

    } catch (error) {
      console.error('Deep analysis failed:', error);
      this.showErrorNotification('分析失败，请稍后重试');
    } finally {
      this.hideRelevanceIndicator();
    }
  }

  /**
   * 处理快速保存
   */
  private async handleQuickSave(quickResult: WebAnalysisResult): Promise<void> {
    this.state.hasUserInteracted = true;
    
    try {
      const pageContent = this.extractPageContent();
      
      const response = await chrome.runtime.sendMessage({
        type: 'QUICK_SAVE_WEB_CONTENT',
        data: {
          pageContent,
          quickResult,
          userAction: 'quick_save'
        }
      });

      if (response.success) {
        this.showSuccessNotification('信息已快速保存');
        await this.recordUserAction('quick_save_accepted', pageContent.url);
      } else {
        throw new Error(response.error || 'Quick save failed');
      }

    } catch (error) {
      console.error('Quick save failed:', error);
      this.showErrorNotification('保存失败，请稍后重试');
    } finally {
      this.hideRelevanceIndicator();
    }
  }

  /**
   * 隐藏相关性指示器
   */
  private hideRelevanceIndicator(): void {
    if (this.indicatorElement) {
      this.indicatorElement.remove();
      this.indicatorElement = undefined;
    }
  }

  /**
   * 显示分析进度
   */
  private showAnalysisProgress(): void {
    // 更新指示器内容显示分析进度
    if (this.indicatorElement) {
      const body = this.indicatorElement.querySelector('.indicator-body');
      if (body) {
        body.innerHTML = `
          <div class="progress-container">
            <div class="progress-spinner"></div>
            <div class="progress-text">正在深度分析...</div>
          </div>
        `;
      }
    }
  }

  /**
   * 显示成功通知
   */
  private showSuccessNotification(message: string): void {
    this.showNotification(message, 'success');
  }

  /**
   * 显示错误通知
   */
  private showErrorNotification(message: string): void {
    this.showNotification(message, 'error');
  }

  /**
   * 显示通知
   */
  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    const notification = document.createElement('div');
    notification.className = `brain-system-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="message">${message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    // 自动消失
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * 设置内容变化观察器
   */
  private setupContentObserver(): void {
    this.contentObserver = new MutationObserver((mutations) => {
      // 防抖处理
      if (this.analysisDebounceTimer) {
        clearTimeout(this.analysisDebounceTimer);
      }

      this.analysisDebounceTimer = setTimeout(() => {
        this.handleContentChange(mutations);
      }, this.config.analysisDelay);
    });

    this.contentObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  /**
   * 处理内容变化
   */
  private handleContentChange(mutations: MutationRecord[]): void {
    // 检查是否有重要内容变化
    let hasSignificantChange = false;
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const textContent = element.textContent || '';
            if (textContent.length > 50) { // 只关注有意义的内容变化
              hasSignificantChange = true;
              break;
            }
          }
        }
      }
      if (hasSignificantChange) break;
    }

    if (hasSignificantChange && !this.state.isAnalyzing) {
      // 重新分析页面
      this.performInitialAnalysis();
    }
  }

  /**
   * 设置用户交互监听器
   */
  private setupUserInteractionListeners(): void {
    // 监听用户与指示器的交互
    document.addEventListener('click', (e) => {
      if ((e.target as Element).closest('.brain-system-relevance-indicator')) {
        this.state.hasUserInteracted = true;
      }
    });
  }

  /**
   * 设置消息监听器
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'ANALYZE_CURRENT_PAGE':
          this.performInitialAnalysis();
          sendResponse({ success: true });
          break;
          
        case 'UPDATE_CONFIG':
          this.config = { ...this.config, ...message.config };
          sendResponse({ success: true });
          break;
          
        case 'GET_PAGE_ANALYSIS_STATE':
          sendResponse({
            isAnalyzing: this.state.isAnalyzing,
            relevanceScore: this.state.relevanceScore,
            lastAnalysis: this.state.lastAnalysis
          });
          break;
      }
    });
  }

  /**
   * 是否应该跳过分析
   */
  private shouldSkipAnalysis(): boolean {
    const url = window.location.href;
    
    // 跳过某些类型的页面
    const skipPatterns = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'about:',
      'file://',
      'data:',
      'javascript:'
    ];
    
    return skipPatterns.some(pattern => url.startsWith(pattern));
  }

  /**
   * 记录分析结果
   */
  private async recordAnalysisResult(url: string, result: WebAnalysisResult): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'RECORD_ANALYSIS_RESULT',
        data: {
          url,
          result,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.warn('Failed to record analysis result:', error);
    }
  }

  /**
   * 记录用户行为
   */
  private async recordUserAction(action: string, url: string): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'RECORD_USER_ACTION',
        data: {
          action,
          url,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.warn('Failed to record user action:', error);
    }
  }

  /**
   * 添加指示器样式
   */
  private addIndicatorStyles(): void {
    if (document.getElementById('brain-system-indicator-styles')) {
      return; // 样式已存在
    }

    const style = document.createElement('style');
    style.id = 'brain-system-indicator-styles';
    style.textContent = `
      .brain-system-relevance-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        border: 1px solid #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: slideInRight 0.3s ease-out;
        max-width: 400px;
        overflow: hidden;
      }

      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      .indicator-header {
        display: flex;
        align-items: center;
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .brain-icon {
        font-size: 20px;
        margin-right: 8px;
      }

      .indicator-header .title {
        flex: 1;
        font-weight: 600;
        font-size: 16px;
      }

      .confidence {
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        margin-right: 8px;
      }

      .close-btn {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 18px;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.7;
      }

      .close-btn:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.1);
      }

      .indicator-body {
        padding: 16px;
      }

      .extracted-info {
        margin-bottom: 16px;
      }

      .info-items {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .info-item {
        padding: 8px 12px;
        background: #f8f9fa;
        border-radius: 6px;
        font-size: 14px;
        color: #495057;
      }

      .no-specific-info {
        padding: 8px 12px;
        background: #e3f2fd;
        border-radius: 6px;
        font-size: 14px;
        color: #1976d2;
        text-align: center;
      }

      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .actions button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }

      .analyze-btn {
        background: #1976d2;
        color: white;
        flex: 1;
      }

      .analyze-btn:hover {
        background: #1565c0;
        transform: translateY(-1px);
      }

      .quick-save-btn {
        background: #388e3c;
        color: white;
        flex: 1;
      }

      .quick-save-btn:hover {
        background: #2e7d32;
        transform: translateY(-1px);
      }

      .dismiss-btn {
        background: #f5f5f5;
        color: #666;
        padding: 8px 12px;
      }

      .dismiss-btn:hover {
        background: #e0e0e0;
      }

      .progress-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 20px;
      }

      .progress-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #1976d2;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .progress-text {
        font-size: 14px;
        color: #666;
      }

      .brain-system-notification {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10001;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: slideInRight 0.3s ease-out;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }

      .brain-system-notification.success {
        background: #4caf50;
        color: white;
      }

      .brain-system-notification.error {
        background: #f44336;
        color: white;
      }

      .brain-system-notification.info {
        background: #2196f3;
        color: white;
      }

      .notification-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .notification-content .icon {
        font-size: 16px;
      }

      .notification-content .message {
        font-size: 14px;
        font-weight: 500;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }
    
    if (this.analysisDebounceTimer) {
      clearTimeout(this.analysisDebounceTimer);
    }
    
    if (this.indicatorElement) {
      this.indicatorElement.remove();
    }

    // 清理样式
    const styleElement = document.getElementById('brain-system-indicator-styles');
    if (styleElement) {
      styleElement.remove();
    }
  }
}

// 初始化内容脚本
const universalContentScript = new UniversalContentScript();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    universalContentScript.initialize();
  });
} else {
  universalContentScript.initialize();
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  universalContentScript.cleanup();
});

export default UniversalContentScript;