/**
 * Background Script Alarm 修复验证脚本
 * 
 * 使用方法：
 * 1. 打开 Chrome 扩展的 Background Service Worker DevTools
 * 2. 复制这个脚本到 Console 中执行
 * 3. 根据输出结果判断修复是否生效
 */

console.log('🔍 开始验证 Alarm 修复...\n');

// 测试 1: 检查监听器是否正确设置
console.log('📋 测试 1: 检查顶层监听器');
console.log('期望在启动日志中看到: "✅ Alarm 监听器已设置（顶层同步）"');
console.log('如果看到这条日志，说明监听器在顶层正确设置\n');

// 测试 2: 检查所有 alarm
console.log('📋 测试 2: 检查现有 alarm');
chrome.alarms.getAll().then(alarms => {
    if (alarms.length === 0) {
        console.log('⚠️  未找到任何 alarm，可能需要初始化 TaskScheduler');
    } else {
        console.log(`✅ 找到 ${alarms.length} 个 alarm:`);
        console.table(alarms.map(a => ({
            名称: a.name,
            下次触发: new Date(a.scheduledTime).toLocaleString(),
            周期分钟: a.periodInMinutes,
            距离现在: Math.round((a.scheduledTime - Date.now()) / 1000 / 60) + ' 分钟'
        })));
    }
    console.log('');
});

// 测试 3: 检查 TaskScheduler 初始化状态
console.log('📋 测试 3: 检查 TaskScheduler 状态');
if (typeof taskScheduler !== 'undefined') {
    console.log('✅ TaskScheduler 已加载');
    console.log('初始化状态:', taskScheduler.isInitialized);
    
    chrome.runtime.sendMessage({
        type: 'GET_TASK_SCHEDULER_STATUS'
    }, response => {
        if (response && response.success) {
            const enabledTasks = response.tasks.filter(t => t.enabled);
            const disabledTasks = response.tasks.filter(t => !t.enabled);
            
            console.log(`\n📊 任务状态统计:`);
            console.log(`  - 启用的任务: ${enabledTasks.length}`);
            console.log(`  - 禁用的任务: ${disabledTasks.length}`);
            console.log(`  - 总任务数: ${response.tasks.length}`);
            
            if (enabledTasks.length > 0) {
                console.log('\n✅ 启用的任务:');
                console.table(enabledTasks.map(t => ({
                    ID: t.id,
                    名称: t.name,
                    间隔分钟: t.intervalMinutes,
                    状态: t.status,
                    上次运行: t.lastRun ? new Date(t.lastRun).toLocaleString() : '未运行',
                    下次运行: t.nextRun ? new Date(t.nextRun).toLocaleString() : '未设置'
                })));
            }
            
            if (disabledTasks.length > 0) {
                console.log('\n⚠️  禁用的任务:');
                console.table(disabledTasks.map(t => ({
                    ID: t.id,
                    名称: t.name,
                    间隔分钟: t.intervalMinutes
                })));
            }
        }
        console.log('');
    });
} else {
    console.log('❌ TaskScheduler 未加载');
}

// 测试 4: 创建测试 alarm
console.log('\n📋 测试 4: 创建测试 alarm（1分钟后触发）');
chrome.alarms.create('test-alarm-verification', {
    delayInMinutes: 1
});
console.log('✅ 测试 alarm 已创建，1分钟后应该看到日志:');
console.log('   🔔 收到 alarm 事件: test-alarm-verification');
console.log('   ⚡ 其他 alarm 事件: test-alarm-verification\n');

// 测试 5: 验证配置
console.log('📋 测试 5: 检查环境配置');
chrome.storage.local.get(['envConfig'], result => {
    if (result.envConfig) {
        const config = result.envConfig;
        console.log('✅ 环境配置已加载:');
        console.log(`  - MESSAGE_ANALYSIS_INTERVAL: ${config.MESSAGE_ANALYSIS_INTERVAL || config.SCHEDULED_INTERVAL || '未设置'} 分钟`);
        console.log(`  - MESSAGE_CONTEXT_WINDOW: ${config.MESSAGE_CONTEXT_WINDOW || '未设置'} 分钟`);
    } else {
        console.log('⚠️  未找到环境配置');
    }
    console.log('');
});

// 总结
console.log('\n' + '='.repeat(60));
console.log('📝 验证总结');
console.log('='.repeat(60));
console.log('\n如果看到以下内容，说明修复成功:');
console.log('✅ 启动日志中有 "Alarm 监听器已设置（顶层同步）"');
console.log('✅ chrome.alarms.getAll() 返回了 alarm 列表');
console.log('✅ TaskScheduler.isInitialized 为 true');
console.log('✅ 有启用的任务列表');
console.log('✅ 1分钟后能看到测试 alarm 的触发日志\n');

console.log('⚠️  如果有问题:');
console.log('1. 确保扩展已重新加载');
console.log('2. 确保 TaskScheduler 已初始化（可能需要等待 5 秒）');
console.log('3. 检查是否有错误日志');
console.log('4. 尝试手动启用任务:\n');
console.log('   chrome.runtime.sendMessage({');
console.log('       type: "CONTROL_TASK",');
console.log('       taskId: "message_analysis",');
console.log('       action: "toggle",');
console.log('       enabled: true');
console.log('   }, console.log);\n');

console.log('📚 详细文档: docs/progressing/background-script-alarm-fix.md');
console.log('='.repeat(60) + '\n');

// 设置一个定时器，提醒查看测试结果
setTimeout(() => {
    console.log('\n⏰ 测试 alarm 应该在此时触发！');
    console.log('请查看控制台是否有以下日志:');
    console.log('  🔔 收到 alarm 事件: test-alarm-verification');
    
    // 清理测试 alarm
    chrome.alarms.clear('test-alarm-verification', wasCleared => {
        if (wasCleared) {
            console.log('✅ 测试 alarm 已清理');
        }
    });
}, 61000); // 61 秒后

