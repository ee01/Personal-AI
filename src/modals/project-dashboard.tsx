import * as React from 'react';
import * as ReactDOM from 'react-dom';
import ProjectDashboard from '../components/dashboard/ProjectDashboard';

// 项目仪表盘模态入口文件
// 将 React 组件渲染到 project-dashboard.html 页面中

console.log('🚀 项目仪表盘入口文件已加载');
console.log('查找挂载点:', document.getElementById('dashboard-root'));

const dashboardRoot = document.getElementById('dashboard-root');
if (dashboardRoot) {
    console.log('✅ 找到挂载点，开始渲染React组件');
    
    // 隐藏静态加载内容
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
        console.log('🙈 隐藏静态加载界面');
    }
    
    ReactDOM.render(
        <ProjectDashboard />,
        dashboardRoot
    );
    
    console.log('✅ React组件渲染完成');
} else {
    console.error('❌ 无法找到 dashboard-root 挂载点');
}