/**
 * 增强鱼骨时间线组件
 * 支持任务拖拽、添加任务、阶段管理等功能
 */

class EnhancedFishboneTimeline {
    constructor(container, project, options = {}) {
        this.container = container;
        this.project = project;
        this.options = {
            enableDragDrop: true,
            enableTaskCreation: true,
            enableMilestoneEdit: true,
            ...options
        };
        
        this.dragState = {
            isDragging: false,
            draggedTask: null,
            draggedElement: null,
            dragOffset: { x: 0, y: 0 }
        };

        this.init();
    }

    init() {
        this.render();
        if (this.options.enableDragDrop) {
            this.initializeDragDrop();
        }
        this.attachEventListeners();
    }

    render() {
        const timelineHTML = this.generateTimelineHTML();
        this.container.innerHTML = timelineHTML;
        
        // 添加CSS样式
        this.injectStyles();
    }

    generateTimelineHTML() {
        const { milestones, tasks } = this.project;
        
        // 生成里程碑时间线
        const milestonesHTML = this.generateMilestonesHTML(milestones);
        
        // 生成任务泳道
        const tasksHTML = this.generateTasksHTML(tasks, milestones);
        
        return `
            <div class="enhanced-fishbone-timeline">
                <div class="timeline-header">
                    <h3>${this.project.name}</h3>
                    <div class="timeline-controls">
                        <button class="btn-add-milestone" onclick="timeline.addMilestone()">
                            ➕ 添加阶段
                        </button>
                        <button class="btn-add-task" onclick="timeline.addTask()">
                            ➕ 添加任务
                        </button>
                    </div>
                </div>
                
                <div class="timeline-content">
                    <div class="milestones-track">
                        ${milestonesHTML}
                    </div>
                    
                    <div class="tasks-track">
                        ${tasksHTML}
                    </div>
                </div>
                
                <!-- 拖拽放置区域 -->
                <div class="drop-zones">
                    ${milestones.map(milestone => `
                        <div class="drop-zone" data-milestone-id="${milestone.id}">
                            <div class="drop-indicator">放置到 ${milestone.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    generateMilestonesHTML(milestones) {
        return milestones.map(milestone => `
            <div class="milestone-marker" data-milestone-id="${milestone.id}">
                <div class="milestone-dot"></div>
                <div class="milestone-label" 
                     contenteditable="${this.options.enableMilestoneEdit}"
                     onblur="timeline.updateMilestone('${milestone.id}', this.textContent)">
                    ${milestone.label}
                </div>
                <div class="milestone-date">
                    ${milestone.date ? new Date(milestone.date).toLocaleDateString('zh-CN') : '未设定'}
                </div>
                <button class="milestone-delete" onclick="timeline.deleteMilestone('${milestone.id}')">
                    ×
                </button>
            </div>
        `).join('');
    }

    generateTasksHTML(tasks, milestones) {
        // 按平台分组任务
        const platformGroups = this.groupTasksByPlatform(tasks);
        
        return Object.entries(platformGroups).map(([platform, platformTasks]) => `
            <div class="platform-lane" data-platform="${platform}">
                <div class="platform-label">${this.getPlatformDisplayName(platform)}</div>
                <div class="platform-tasks">
                    ${platformTasks.map(task => this.generateTaskCard(task, milestones)).join('')}
                    <div class="task-add-zone" onclick="timeline.addTaskToPlatform('${platform}')">
                        <div class="add-task-btn">+ 添加任务</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    generateTaskCard(task, milestones) {
        const position = this.calculateTaskPosition(task, milestones);
        const statusColor = this.getStatusColor(task.status);
        
        return `
            <div class="task-card ${this.options.enableDragDrop ? 'draggable' : ''}" 
                 data-task-id="${task.id}"
                 data-task-type="${task.type}"
                 style="left: ${position.left}%; width: ${position.width}%;"
                 draggable="${this.options.enableDragDrop}">
                
                <div class="task-header" style="background-color: ${statusColor}">
                    <span class="task-type-icon">${this.getTaskTypeIcon(task.type)}</span>
                    <span class="task-title">${task.title}</span>
                    <button class="task-edit-btn" onclick="timeline.editTask('${task.id}')">✏️</button>
                </div>
                
                <div class="task-body">
                    ${task.desc ? `<p class="task-desc">${task.desc}</p>` : ''}
                    <div class="task-meta">
                        ${task.eta ? `<span class="task-eta">📅 ${task.eta}</span>` : ''}
                        ${task.jira && task.jira.length > 0 ? 
                            `<span class="task-jira">🎫 ${task.jira.length} issues</span>` : ''}
                    </div>
                </div>
                
                <div class="task-platforms">
                    ${Object.entries(task.platforms || {}).map(([platform, state]) => `
                        <div class="platform-state" data-platform="${platform}">
                            <span class="platform-name">${platform.toUpperCase()}</span>
                            <span class="platform-status ${state.status}">${state.status}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 辅助方法
    groupTasksByPlatform(tasks) {
        const groups = {
            'design': [],
            'backend': [],
            'frontend': [],
            'mobile': [],
            'qa': []
        };

        tasks.forEach(task => {
            // 根据任务类型或平台信息分组
            if (task.type === 'design') {
                groups.design.push(task);
            } else if (task.type === 'dep') {
                groups.backend.push(task);
            } else if (task.platforms) {
                // 如果有平台信息，按平台分配
                Object.keys(task.platforms).forEach(platform => {
                    if (platform === 'ios' || platform === 'android') {
                        groups.mobile.push(task);
                    } else if (platform === 'qa') {
                        groups.qa.push(task);
                    } else {
                        groups.frontend.push(task);
                    }
                });
            } else {
                // 默认分配到前端
                groups.frontend.push(task);
            }
        });

        // 移除空组
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        });

        return groups;
    }

    calculateTaskPosition(task, milestones) {
        // 简单的位置计算，基于里程碑分布
        const totalWidth = 100;
        const taskWidth = 20; // 基础宽度
        
        // 找到任务最适合的位置（这里简化处理）
        const milestoneIndex = Math.floor(Math.random() * milestones.length);
        const left = (milestoneIndex / milestones.length) * (totalWidth - taskWidth);
        
        return {
            left: Math.max(0, left),
            width: taskWidth
        };
    }

    getPlatformDisplayName(platform) {
        const names = {
            'design': '设计',
            'backend': '后端',
            'frontend': '前端',
            'mobile': '移动端',
            'qa': '测试'
        };
        return names[platform] || platform;
    }

    getTaskTypeIcon(type) {
        const icons = {
            'dep': '🔗',
            'task': '📋',
            'design': '🎨'
        };
        return icons[type] || '📋';
    }

    getStatusColor(status) {
        const colors = {
            'todo': '#95a5a6',
            'progress': '#3498db',
            'testBuild': '#f39c12',
            'rollout': '#e74c3c',
            'done': '#27ae60',
            'blocked': '#e74c3c'
        };
        return colors[status] || '#95a5a6';
    }

    // 拖拽功能
    initializeDragDrop() {
        this.container.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.container.addEventListener('dragover', this.handleDragOver.bind(this));
        this.container.addEventListener('drop', this.handleDrop.bind(this));
        this.container.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    handleDragStart(e) {
        if (!e.target.classList.contains('task-card')) return;
        
        this.dragState.isDragging = true;
        this.dragState.draggedElement = e.target;
        this.dragState.draggedTask = e.target.dataset.taskId;
        
        e.target.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        
        // 显示放置区域
        this.showDropZones();
    }

    handleDragOver(e) {
        if (!this.dragState.isDragging) return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // 高亮放置区域
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) {
            this.highlightDropZone(dropZone);
        }
    }

    handleDrop(e) {
        if (!this.dragState.isDragging) return;
        
        e.preventDefault();
        
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) {
            const milestoneId = dropZone.dataset.milestoneId;
            this.moveTaskToMilestone(this.dragState.draggedTask, milestoneId);
        }
    }

    handleDragEnd(e) {
        if (!this.dragState.isDragging) return;
        
        e.target.style.opacity = '1';
        this.hideDropZones();
        this.resetDragState();
    }

    showDropZones() {
        const dropZones = this.container.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            zone.style.display = 'block';
            zone.classList.add('active');
        });
    }

    hideDropZones() {
        const dropZones = this.container.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            zone.style.display = 'none';
            zone.classList.remove('active', 'highlighted');
        });
    }

    highlightDropZone(dropZone) {
        // 移除其他高亮
        this.container.querySelectorAll('.drop-zone.highlighted').forEach(zone => {
            zone.classList.remove('highlighted');
        });
        
        // 高亮当前区域
        dropZone.classList.add('highlighted');
    }

    resetDragState() {
        this.dragState = {
            isDragging: false,
            draggedTask: null,
            draggedElement: null,
            dragOffset: { x: 0, y: 0 }
        };
    }

    // 交互方法
    async moveTaskToMilestone(taskId, milestoneId) {
        try {
            console.log('🚀 移动任务到里程碑:', { taskId, milestoneId });
            
            // 调用后端API更新任务的里程碑
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_PROJECT_ITEM',
                projectId: this.project.id,
                itemType: 'task',
                itemId: taskId,
                changes: {
                    milestoneId: milestoneId,
                    updatedAt: new Date().toISOString()
                }
            });

            if (response && response.success) {
                console.log('✅ 任务移动成功');
                this.showSuccessMessage('任务已移动到新阶段');
                // 重新渲染时间线
                await this.refreshProject();
                this.render();
            } else {
                throw new Error(response?.error || '移动任务失败');
            }
        } catch (error) {
            console.error('❌ 移动任务失败:', error);
            this.showErrorMessage('移动任务失败: ' + error.message);
        }
    }

    async addTask() {
        const taskData = await this.showTaskCreationDialog();
        if (!taskData) return;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_PROJECT_ITEM',
                projectId: this.project.id,
                itemType: 'task',
                itemId: 'new',
                changes: taskData
            });

            if (response && response.success) {
                console.log('✅ 任务创建成功');
                this.showSuccessMessage('任务创建成功');
                await this.refreshProject();
                this.render();
            } else {
                throw new Error(response?.error || '创建任务失败');
            }
        } catch (error) {
            console.error('❌ 创建任务失败:', error);
            this.showErrorMessage('创建任务失败: ' + error.message);
        }
    }

    async addTaskToPlatform(platform) {
        const taskData = await this.showTaskCreationDialog({ platform });
        if (!taskData) return;

        // 设置平台相关属性
        taskData.platforms = taskData.platforms || {};
        taskData.platforms[platform] = {
            status: 'todo',
            assignee: '',
            jira: ''
        };

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_PROJECT_ITEM',
                projectId: this.project.id,
                itemType: 'task',
                itemId: 'new',
                changes: taskData
            });

            if (response && response.success) {
                console.log('✅ 平台任务创建成功');
                this.showSuccessMessage(`${this.getPlatformDisplayName(platform)}任务创建成功`);
                await this.refreshProject();
                this.render();
            } else {
                throw new Error(response?.error || '创建任务失败');
            }
        } catch (error) {
            console.error('❌ 创建平台任务失败:', error);
            this.showErrorMessage('创建任务失败: ' + error.message);
        }
    }

    async addMilestone() {
        const name = prompt('请输入里程碑名称:', '');
        if (!name) return;

        const date = prompt('请输入预计日期 (YYYY-MM-DD):', '');
        
        const milestoneData = {
            id: `milestone-${Date.now()}`,
            label: name,
            date: date || undefined
        };

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_PROJECT_ITEM',
                projectId: this.project.id,
                itemType: 'milestone',
                itemId: 'new',
                changes: milestoneData
            });

            if (response && response.success) {
                console.log('✅ 里程碑创建成功');
                this.showSuccessMessage('里程碑创建成功');
                await this.refreshProject();
                this.render();
            } else {
                throw new Error(response?.error || '创建里程碑失败');
            }
        } catch (error) {
            console.error('❌ 创建里程碑失败:', error);
            this.showErrorMessage('创建里程碑失败: ' + error.message);
        }
    }

    async editTask(taskId) {
        console.log('📝 编辑任务:', taskId);
        // 触发主仪表盘的任务编辑功能
        if (window.dashboard) {
            window.dashboard.editTask(this.project.id, taskId);
        }
    }

    async updateMilestone(milestoneId, newLabel) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_PROJECT_ITEM',
                projectId: this.project.id,
                itemType: 'milestone',
                itemId: milestoneId,
                changes: { label: newLabel }
            });

            if (response && response.success) {
                console.log('✅ 里程碑更新成功');
            }
        } catch (error) {
            console.error('❌ 更新里程碑失败:', error);
        }
    }

    async deleteMilestone(milestoneId) {
        if (!confirm('确定要删除这个里程碑吗？')) return;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_PROJECT_ITEM',
                projectId: this.project.id,
                itemType: 'milestone',
                itemId: milestoneId,
                changes: { _delete: true }
            });

            if (response && response.success) {
                console.log('✅ 里程碑删除成功');
                this.showSuccessMessage('里程碑删除成功');
                await this.refreshProject();
                this.render();
            }
        } catch (error) {
            console.error('❌ 删除里程碑失败:', error);
            this.showErrorMessage('删除里程碑失败: ' + error.message);
        }
    }

    async showTaskCreationDialog(defaults = {}) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'task-creation-modal';
            modal.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal">
                        <div class="modal-header">
                            <h3>创建新任务</h3>
                            <button class="modal-close">×</button>
                        </div>
                        <form class="task-form">
                            <div class="form-group">
                                <label>任务标题 *</label>
                                <input type="text" name="title" required placeholder="输入任务标题...">
                            </div>
                            <div class="form-group">
                                <label>任务描述</label>
                                <textarea name="desc" placeholder="任务描述..."></textarea>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>任务类型</label>
                                    <select name="type">
                                        <option value="task">普通任务</option>
                                        <option value="dep">依赖任务</option>
                                        <option value="design">设计任务</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>状态</label>
                                    <select name="status">
                                        <option value="todo">待办</option>
                                        <option value="progress">进行中</option>
                                        <option value="testing">测试中</option>
                                        <option value="rollout">发布中</option>
                                        <option value="done">已完成</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>预计完成时间</label>
                                <input type="date" name="eta">
                            </div>
                            <div class="modal-actions">
                                <button type="button" class="btn btn-secondary cancel-btn">取消</button>
                                <button type="submit" class="btn btn-primary">创建任务</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const form = modal.querySelector('.task-form');
            const closeBtn = modal.querySelector('.modal-close');
            const cancelBtn = modal.querySelector('.cancel-btn');

            const cleanup = () => {
                document.body.removeChild(modal);
            };

            closeBtn.onclick = cancelBtn.onclick = () => {
                cleanup();
                resolve(null);
            };

            form.onsubmit = (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const taskData = {
                    id: `task-${Date.now()}`,
                    title: formData.get('title'),
                    desc: formData.get('desc'),
                    type: formData.get('type'),
                    status: formData.get('status'),
                    eta: formData.get('eta'),
                    platforms: {},
                    ...defaults
                };
                cleanup();
                resolve(taskData);
            };
        });
    }

    async refreshProject() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_PROJECT_DATA',
                projectId: this.project.id
            });

            if (response && response.success && response.projects.length > 0) {
                this.project = response.projects[0];
            }
        } catch (error) {
            console.error('❌ 刷新项目数据失败:', error);
        }
    }

    // 样式注入
    injectStyles() {
        if (document.getElementById('enhanced-fishbone-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'enhanced-fishbone-styles';
        styles.textContent = `
            .enhanced-fishbone-timeline {
                background: white;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }

            .timeline-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 2px solid #e1e8ed;
            }

            .timeline-controls {
                display: flex;
                gap: 8px;
            }

            .btn-add-milestone, .btn-add-task {
                background: #3498db;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 0.9em;
                cursor: pointer;
                transition: background 0.2s ease;
            }

            .btn-add-milestone:hover, .btn-add-task:hover {
                background: #2980b9;
            }

            .timeline-content {
                position: relative;
                min-height: 300px;
            }

            .milestones-track {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                padding: 10px 0;
                border-bottom: 1px solid #e1e8ed;
            }

            .milestone-marker {
                position: relative;
                text-align: center;
                flex: 1;
            }

            .milestone-dot {
                width: 12px;
                height: 12px;
                background: #3498db;
                border-radius: 50%;
                margin: 0 auto 8px;
            }

            .milestone-label {
                font-weight: 600;
                color: #2c3e50;
                font-size: 0.9em;
                margin-bottom: 4px;
                min-height: 20px;
                padding: 2px 4px;
                border-radius: 4px;
            }

            .milestone-label:focus {
                background: #f8f9fa;
                outline: 1px solid #3498db;
            }

            .milestone-date {
                font-size: 0.8em;
                color: #7f8c8d;
            }

            .milestone-delete {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #e74c3c;
                color: white;
                border: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                font-size: 12px;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .milestone-marker:hover .milestone-delete {
                opacity: 1;
            }

            .tasks-track {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .platform-lane {
                display: flex;
                align-items: center;
                min-height: 60px;
                border: 1px solid #e1e8ed;
                border-radius: 8px;
                padding: 8px;
            }

            .platform-label {
                min-width: 80px;
                font-weight: 600;
                color: #2c3e50;
                text-align: center;
                border-right: 1px solid #e1e8ed;
                padding-right: 12px;
                margin-right: 12px;
            }

            .platform-tasks {
                flex: 1;
                position: relative;
                display: flex;
                align-items: center;
                gap: 8px;
                min-height: 40px;
            }

            .task-card {
                position: relative;
                background: white;
                border: 1px solid #ddd;
                border-radius: 6px;
                min-width: 150px;
                max-width: 250px;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }

            .task-card:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            }

            .task-card.draggable {
                cursor: grab;
            }

            .task-card.dragging {
                opacity: 0.5;
                cursor: grabbing;
            }

            .task-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 8px;
                background: #f8f9fa;
                border-bottom: 1px solid #e1e8ed;
                border-radius: 5px 5px 0 0;
            }

            .task-type-icon {
                font-size: 0.9em;
                margin-right: 4px;
            }

            .task-title {
                flex: 1;
                font-weight: 500;
                font-size: 0.85em;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .task-edit-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 2px;
                border-radius: 2px;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .task-card:hover .task-edit-btn {
                opacity: 1;
            }

            .task-body {
                padding: 6px 8px;
            }

            .task-desc {
                font-size: 0.8em;
                color: #666;
                margin: 0 0 4px 0;
                line-height: 1.2;
            }

            .task-meta {
                display: flex;
                gap: 8px;
                font-size: 0.75em;
                color: #7f8c8d;
            }

            .task-platforms {
                padding: 4px 8px;
                border-top: 1px solid #e1e8ed;
                background: #fafbfc;
            }

            .platform-state {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.75em;
            }

            .platform-status {
                padding: 1px 4px;
                border-radius: 3px;
                font-weight: 500;
            }

            .platform-status.todo { background: #f8f9fa; color: #6c757d; }
            .platform-status.progress { background: #cce7ff; color: #0066cc; }
            .platform-status.done { background: #d4edda; color: #155724; }

            .task-add-zone {
                border: 2px dashed #ddd;
                border-radius: 6px;
                padding: 12px;
                text-align: center;
                color: #7f8c8d;
                cursor: pointer;
                transition: all 0.2s ease;
                min-width: 120px;
            }

            .task-add-zone:hover {
                border-color: #3498db;
                color: #3498db;
                background: #f8f9fa;
            }

            .drop-zones {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: none;
                pointer-events: none;
            }

            .drop-zone {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 20%;
                background: rgba(52, 152, 219, 0.1);
                border: 2px dashed #3498db;
                display: none;
                align-items: center;
                justify-content: center;
                pointer-events: all;
                transition: all 0.2s ease;
            }

            .drop-zone.active {
                display: flex;
            }

            .drop-zone.highlighted {
                background: rgba(52, 152, 219, 0.2);
                border-color: #2980b9;
            }

            .drop-indicator {
                background: rgba(52, 152, 219, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.9em;
                font-weight: 500;
            }

            .task-creation-modal .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }

            .task-creation-modal .modal {
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            }

            .task-creation-modal .form-group {
                margin-bottom: 16px;
            }

            .task-creation-modal .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .task-creation-modal label {
                display: block;
                font-weight: 500;
                margin-bottom: 6px;
                color: #2c3e50;
            }

            .task-creation-modal input, 
            .task-creation-modal textarea, 
            .task-creation-modal select {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
                box-sizing: border-box;
            }

            .task-creation-modal textarea {
                resize: vertical;
                min-height: 60px;
            }
        `;
        document.head.appendChild(styles);
    }

    // 消息显示
    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    showErrorMessage(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 2000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        `;

        document.body.appendChild(toast);

        setTimeout(() => toast.style.transform = 'translateX(0)', 10);
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

// 导出给全局使用
window.EnhancedFishboneTimeline = EnhancedFishboneTimeline;
