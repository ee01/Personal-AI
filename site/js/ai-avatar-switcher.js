// AI 头像版本切换器
class AIAvatarSwitcher {
    constructor() {
        this.currentVersion = localStorage.getItem('ai-avatar-version') || 'v1';
        this.instance = null;
        this.init();
    }
    
    init() {
        this.createSwitcher();
        this.loadVersion(this.currentVersion);
    }
    
    createSwitcher() {
        const container = document.querySelector('.ai-avatar-container');
        if (!container) return;
        
        // 创建版本切换器
        const switcher = document.createElement('div');
        switcher.className = 'avatar-version-switcher';
        switcher.innerHTML = `
            <div class="version-label">头像版本:</div>
            <div class="version-buttons">
                <button class="version-btn ${this.currentVersion === 'v1' ? 'active' : ''}" data-version="v1" title="优化粒子系统">
                    <span>V1</span>
                    <small>粒子</small>
                </button>
                <button class="version-btn ${this.currentVersion === 'v2' ? 'active' : ''}" data-version="v2" title="简单球体">
                    <span>V2</span>
                    <small>球体</small>
                </button>
                <button class="version-btn ${this.currentVersion === 'v5' ? 'active' : ''}" data-version="v5" title="对话气泡">
                    <span>V5</span>
                    <small>气泡</small>
                </button>
            </div>
        `;
        
        container.appendChild(switcher);
        
        // 绑定切换事件
        switcher.querySelectorAll('.version-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const version = btn.dataset.version;
                this.switchVersion(version);
            });
        });
    }
    
    switchVersion(version) {
        if (version === this.currentVersion) return;
        
        // 销毁当前实例
        if (this.instance && this.instance.destroy) {
            this.instance.destroy();
        }
        
        // 更新按钮状态
        document.querySelectorAll('.version-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.version === version);
        });
        
        // 加载新版本
        this.currentVersion = version;
        localStorage.setItem('ai-avatar-version', version);
        this.loadVersion(version);
    }
    
    loadVersion(version) {
        const canvasId = 'ai-avatar';
        
        // 根据版本加载对应的实现
        switch(version) {
            case 'v1':
                if (typeof AIAvatarV1 !== 'undefined') {
                    this.instance = new AIAvatarV1(canvasId);
                }
                break;
            case 'v2':
                if (typeof AIAvatarV2 !== 'undefined') {
                    this.instance = new AIAvatarV2(canvasId);
                }
                break;
            case 'v5':
                if (typeof AIAvatarV5 !== 'undefined') {
                    this.instance = new AIAvatarV5(canvasId);
                }
                break;
            default:
                console.warn('Unknown avatar version:', version);
                // 默认加载v1
                if (typeof AIAvatarV1 !== 'undefined') {
                    this.instance = new AIAvatarV1(canvasId);
                }
        }
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const avatarCanvas = document.getElementById('ai-avatar');
    if (avatarCanvas) {
        window.avatarSwitcher = new AIAvatarSwitcher();
    }
});

