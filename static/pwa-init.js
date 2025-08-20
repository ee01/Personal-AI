// PWA 功能初始化脚本
// 完整的PWA安装和管理功能

// PWA 安装功能
let deferredPrompt;
let installBanner;
let installBtn;
let dismissBtn;
const loadingOverlay = document.getElementById('loading-overlay');

// 创建PWA安装横幅的HTML结构
function createInstallBanner() {
    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    
    banner.innerHTML = `
        <div class="pwa-banner-content">
            <div class="pwa-banner-icon">📱</div>
            <div class="pwa-banner-text">
                <div class="pwa-banner-title">安装到主屏幕</div>
                <div class="pwa-banner-subtitle">更快访问您的记忆系统</div>
            </div>
        </div>
        <div class="pwa-banner-actions">
            <button id="pwa-install-btn" class="pwa-btn install">安装</button>
            <button id="pwa-dismiss-btn" class="pwa-btn dismiss">稍后</button>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .pwa-install-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(90deg, #60a5fa, #a78bfa);
            color: white;
            padding: 0.75rem;
            display: none;
            align-items: center;
            justify-content: space-between;
            z-index: 1000;
            animation: slideDown 0.3s ease-out;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .pwa-install-banner.show {
            display: flex;
        }

        .pwa-banner-content {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .pwa-banner-icon {
            font-size: 1.5rem;
        }

        .pwa-banner-text {
            flex: 1;
        }

        .pwa-banner-title {
            font-weight: 600;
            margin-bottom: 0.25rem;
        }

        .pwa-banner-subtitle {
            font-size: 0.875rem;
            opacity: 0.9;
        }

        .pwa-banner-actions {
            display: flex;
            gap: 0.5rem;
        }

        .pwa-btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s ease;
            font-size: 0.875rem;
        }

        .pwa-btn.install {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .pwa-btn.install:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-1px);
        }

        .pwa-btn.dismiss {
            background: transparent;
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .pwa-btn.dismiss:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        @keyframes slideDown {
            from {
                transform: translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        @media (max-width: 768px) {
            .pwa-install-banner {
                padding: 0.5rem;
            }
            
            .pwa-banner-content {
                gap: 0.75rem;
            }
            
            .pwa-banner-icon {
                font-size: 1.25rem;
            }
            
            .pwa-banner-title {
                font-size: 0.875rem;
            }
            
            .pwa-banner-subtitle {
                font-size: 0.75rem;
            }
            
            .pwa-btn {
                padding: 0.375rem 0.75rem;
                font-size: 0.75rem;
            }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(banner);
    
    return banner;
}

// 初始化PWA安装横幅
function initInstallBanner() {
    installBanner = createInstallBanner();
    installBtn = document.getElementById('pwa-install-btn');
    dismissBtn = document.getElementById('pwa-dismiss-btn');
}

// 监听 PWA 安装提示
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('🎯 PWA安装提示触发！');
    console.log('   - 事件对象:', e);
    e.preventDefault();
    deferredPrompt = e;
    
    // 确保横幅已初始化
    if (!installBanner) {
        console.log('🔧 初始化安装横幅...');
        initInstallBanner();
        bindEventListeners();
    }
    
    // 检查是否之前已经拒绝过
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    console.log('   - 用户是否曾拒绝:', dismissed);
    
    if (!dismissed) {
        console.log('✅ 自动显示安装横幅');
        showInstallBanner();
    } else {
        console.log('⏭️ 用户曾拒绝，不自动显示横幅');
    }
});

// 显示安装横幅
function showInstallBanner() {
    installBanner.classList.add('show');
}

// 隐藏安装横幅
function hideInstallBanner() {
    installBanner.classList.remove('show');
}

// 绑定事件监听器
function bindEventListeners() {
    if (installBtn && dismissBtn) {
        // 安装按钮点击
        installBtn.addEventListener('click', async () => {
            console.log('🔘 用户点击安装按钮');
            console.log('   - deferredPrompt状态:', deferredPrompt ? '可用' : '不可用');
            
            hideInstallBanner();
            
            if (deferredPrompt) {
                try {
                    console.log('📱 触发PWA安装提示...');
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`✅ PWA安装结果: ${outcome}`);
                    
                    if (outcome === 'accepted') {
                        localStorage.setItem('pwa-install-accepted', 'true');
                        console.log('🎉 用户接受安装');
                    } else {
                        console.log('❌ 用户拒绝安装');
                    }
                } catch (error) {
                    console.error('❌ PWA安装过程中出错:', error);
                } finally {
                    deferredPrompt = null;
                }
            } else {
                console.error('❌ 无法安装：deferredPrompt不可用');
                alert('PWA安装不可用。请确保:\n1. 访问HTTPS页面\n2. 页面满足PWA安装条件\n3. 检查浏览器控制台错误信息');
            }
        });

        // 拒绝按钮点击
        dismissBtn.addEventListener('click', () => {
            console.log('⏭️ 用户点击稍后');
            hideInstallBanner();
            localStorage.setItem('pwa-install-dismissed', 'true');
        });
    } else {
        console.error('❌ 安装按钮未找到，无法绑定事件');
    }
}

// 监听 PWA 安装成功
window.addEventListener('appinstalled', (e) => {
    console.log('PWA 安装成功');
    hideInstallBanner();
    localStorage.setItem('pwa-installed', 'true');
});

// 页面加载完成后的处理
window.addEventListener('load', () => {
    // 初始化PWA功能
    initPWA();
});

// PWA安装条件诊断
function diagnosePWAInstallability() {
    console.log('🔍 PWA安装条件诊断:');
    
    // 检查基本条件
    console.log('1. Service Worker支持:', 'serviceWorker' in navigator);
    console.log('2. 当前协议:', window.location.protocol);
    console.log('3. 当前域名:', window.location.hostname);
    
    // 检查manifest
    const manifestLink = document.querySelector('link[rel="manifest"]');
    console.log('4. Manifest链接:', manifestLink ? manifestLink.href : '未找到');
    
    // 检查Service Worker状态
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            console.log('5. Service Worker注册状态:', registration ? '已注册' : '未注册');
            if (registration) {
                console.log('   - Scope:', registration.scope);
                console.log('   - 状态:', registration.active ? '激活' : '未激活');
            }
        });
    }
    
    // 检查localStorage状态
    console.log('6. 安装历史状态:');
    console.log('   - 已安装:', localStorage.getItem('pwa-installed'));
    console.log('   - 已接受:', localStorage.getItem('pwa-install-accepted'));
    console.log('   - 已拒绝:', localStorage.getItem('pwa-install-dismissed'));
    
    // 检查deferredPrompt状态
    console.log('7. deferredPrompt状态:', deferredPrompt ? '已获取' : '未获取');
    
    // 尝试获取manifest内容
    if (manifestLink) {
        fetch(manifestLink.href)
            .then(response => response.json())
            .then(manifest => {
                console.log('8. Manifest内容检查:');
                console.log('   - 名称:', manifest.name);
                console.log('   - 启动URL:', manifest.start_url);
                console.log('   - 显示模式:', manifest.display);
                console.log('   - 图标数量:', manifest.icons ? manifest.icons.length : 0);
            })
            .catch(error => {
                console.error('   - Manifest获取失败:', error);
            });
    }
}



// 全局函数：供React组件调用来隐藏加载遮罩
window.hideLoadingOverlay = function() {
    loadingOverlay.classList.add('hidden');
    console.log('📱 加载遮罩已隐藏');
};

// 备用：如果10秒后React应用还没有隐藏加载遮罩，自动隐藏
setTimeout(() => {
    if (!loadingOverlay.classList.contains('hidden')) {
        console.warn('⚠️ React应用加载超时，强制隐藏加载遮罩');
        loadingOverlay.classList.add('hidden');
    }
}, 10000);

// 注册 Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('🔧 Service Worker 注册成功: ', registration.scope);
                
                // 监听Service Worker更新
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('🔄 Service Worker 有新版本可用');
                                // 可以在这里提示用户刷新页面
                            }
                        });
                    }
                });
            })
            .catch((registrationError) => {
                console.error('❌ Service Worker 注册失败: ', registrationError);
            });
    }
}

// 在initPWA中调用注册Service Worker
function initPWA() {
    console.log('🚀 初始化PWA功能...');
    
    // 运行诊断
    setTimeout(() => {
        diagnosePWAInstallability();
    }, 1000);
    
    // 注册Service Worker
    registerServiceWorker();
    
    // 确保横幅已初始化
    if (!installBanner) {
        initInstallBanner();
        bindEventListeners();
    }
    
    // 如果支持PWA且未安装，显示提示（延迟启动）
    if ('serviceWorker' in navigator && !localStorage.getItem('pwa-installed') && !localStorage.getItem('pwa-install-accepted')) {
        setTimeout(() => {
            console.log('⏰ 检查是否显示安装横幅...');
            console.log('   - 已拒绝状态:', localStorage.getItem('pwa-install-dismissed'));
            console.log('   - deferredPrompt状态:', deferredPrompt ? '可用' : '不可用');
            
            if (!localStorage.getItem('pwa-install-dismissed') && deferredPrompt) {
                console.log('✅ 显示安装横幅');
                showInstallBanner();
            } else if (!deferredPrompt) {
                console.log('❌ beforeinstallprompt事件未触发，PWA可能不满足安装条件');
            }
        }, 5000); // 5秒后显示安装提示，给React应用加载时间
    }
}

// 处理错误
window.addEventListener('error', (e) => {
    console.error('页面错误:', e.error);
    loadingOverlay.classList.add('hidden');
});

// 处理未捕获的 Promise 错误
window.addEventListener('unhandledrejection', (e) => {
    console.error('未处理的 Promise 错误:', e.reason);
    e.preventDefault();
});

// === 调试功能 ===
// 全局调试函数，可在控制台手动调用

// 强制显示安装横幅（调试用）
window.debugShowInstallBanner = function() {
    console.log('🔧 调试：强制显示安装横幅');
    if (!installBanner) {
        initInstallBanner();
        bindEventListeners();
    }
    showInstallBanner();
};

// 重置PWA安装状态（调试用）
window.debugResetPWAState = function() {
    console.log('🔄 调试：重置PWA状态');
    localStorage.removeItem('pwa-installed');
    localStorage.removeItem('pwa-install-accepted');
    localStorage.removeItem('pwa-install-dismissed');
    deferredPrompt = null;
    console.log('✅ PWA状态已重置');
};

// 运行PWA诊断（调试用）
window.debugPWADiagnose = function() {
    diagnosePWAInstallability();
};

// 手动触发安装（调试用）
window.debugForceInstall = function() {
    console.log('🔧 调试：尝试强制安装');
    if (deferredPrompt) {
        deferredPrompt.prompt().then(() => {
            return deferredPrompt.userChoice;
        }).then((result) => {
            console.log('安装结果:', result.outcome);
        });
    } else {
        console.error('❌ deferredPrompt不可用，无法强制安装');
    }
};

console.log('🔧 PWA调试功能已加载，可用函数:');
console.log('   - debugShowInstallBanner(): 强制显示安装横幅');
console.log('   - debugResetPWAState(): 重置PWA状态');
console.log('   - debugPWADiagnose(): 运行PWA诊断');
console.log('   - debugForceInstall(): 强制触发安装');
