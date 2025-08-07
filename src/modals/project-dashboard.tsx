import * as React from 'react';
import * as ReactDOM from 'react-dom';
import ProjectDashboard from '../components/dashboard/ProjectDashboard';

// 项目仪表盘模态入口文件
// 将 React 组件渲染到 project-dashboard.html 页面中

ReactDOM.render(
    <ProjectDashboard />,
    document.getElementById('dashboard-root')
);