// AI 助理头像 - 版本2：简单球体砖块（无五官）
class AIAvatarV2 {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.bricks = [];
        this.mouse = { x: null, y: null, radius: 100 };
        this.animationId = null;
        this.time = 0;
        this.rotationY = 0;
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        this.resizeCanvas();
        this.createBricks();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, 500);
        this.canvas.width = size;
        this.canvas.height = size;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }
    
    createBricks() {
        this.bricks = [];
        const scale = Math.min(this.canvas.width, this.canvas.height) * 0.35;
        
        // 砖块尺寸
        const brickWidth = this.isMobile() ? 16 : 12;
        const brickHeight = this.isMobile() ? 8 : 6;
        const gap = this.isMobile() ? 4 : 3;
        
        // 创建简单球体的砖块网格
        const thetaSteps = this.isMobile() ? 12 : 18; // 纬度步数
        const phiSteps = this.isMobile() ? 16 : 24;   // 经度步数
        
        for (let i = 0; i < thetaSteps; i++) {
            for (let j = 0; j < phiSteps; j++) {
                const theta = (i / thetaSteps) * Math.PI; // 0 到 π
                const phi = (j / phiSteps) * Math.PI * 2; // 0 到 2π
                
                // 球面坐标转换
                const radius = scale;
                const x = Math.sin(theta) * Math.cos(phi) * radius;
                const y = Math.cos(theta) * radius;
                const z = Math.sin(theta) * Math.sin(phi) * radius;
                
                this.bricks.push(new SphereBrick(
                    x, y, z,
                    brickWidth,
                    brickHeight,
                    gap,
                    this.centerX,
                    this.centerY,
                    i, j
                ));
            }
        }
    }
    
    isMobile() {
        return window.innerWidth < 768;
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
        
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.createBricks();
        });
    }
    
    animate() {
        this.time += 0.008;
        
        // 缓慢自动旋转
        this.rotationY = Math.sin(this.time * 0.3) * 0.4;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 更新所有砖块
        this.bricks.forEach(brick => {
            brick.update(this.mouse, this.rotationY, this.time);
        });
        
        // 按深度排序（后面的先画）
        const sortedBricks = [...this.bricks].sort((a, b) => a.screenZ - b.screenZ);
        
        // 绘制扫描线效果
        this.drawScanlines();
        
        // 绘制砖块
        sortedBricks.forEach(brick => {
            brick.draw(this.ctx);
        });
        
        // 绘制全息投影边框
        this.drawHologramBorder();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    drawScanlines() {
        const scanlineY = (this.time * 60) % this.canvas.height;
        
        this.ctx.save();
        const gradient = this.ctx.createLinearGradient(0, scanlineY - 40, 0, scanlineY + 40);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.08)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, scanlineY - 40, this.canvas.width, 80);
        this.ctx.restore();
    }
    
    drawHologramBorder() {
        const scale = Math.min(this.canvas.width, this.canvas.height) * 0.4;
        
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(0, 212, 255, ${0.25 + Math.sin(this.time * 2) * 0.08})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([8, 8]);
        this.ctx.lineDashOffset = -this.time * 15;
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, scale, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

class SphereBrick {
    constructor(x, y, z, width, height, gap, centerX, centerY, gridI, gridJ) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.width = width;
        this.height = height;
        this.gap = gap;
        this.centerX = centerX;
        this.centerY = centerY;
        this.gridI = gridI;
        this.gridJ = gridJ;
        
        this.screenX = 0;
        this.screenY = 0;
        this.screenZ = 0;
        this.screenWidth = 0;
        this.screenHeight = 0;
        
        this.opacity = 0.7;
        this.hue = 185 + Math.random() * 15;
        this.flickerPhase = Math.random() * Math.PI * 2;
        this.flickerSpeed = 0.02 + Math.random() * 0.03;
    }
    
    update(mouse, rotationY, time) {
        // 应用Y轴旋转
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        
        const rotatedX = this.x * cosY - this.z * sinY;
        const rotatedZ = this.x * sinY + this.z * cosY;
        
        // 轻微的呼吸效果
        const breathScale = 1 + Math.sin(time + this.gridI * 0.1 + this.gridJ * 0.1) * 0.03;
        
        // 3D透视投影
        const perspective = 700;
        const scale = perspective / (perspective + rotatedZ);
        
        this.screenX = this.centerX + rotatedX * scale * breathScale;
        this.screenY = this.centerY + this.y * scale * breathScale;
        this.screenZ = rotatedZ;
        this.screenWidth = this.width * scale;
        this.screenHeight = this.height * scale;
        
        // 闪烁效果
        this.flickerPhase += this.flickerSpeed;
        const flicker = Math.sin(this.flickerPhase) * 0.15 + 0.85;
        
        // 根据深度调整透明度
        const depthOpacity = Math.max(0.2, Math.min(0.9, (rotatedZ + 300) / 600));
        this.opacity = depthOpacity * flicker * 0.7;
        
        // 鼠标交互
        if (mouse.x !== null && mouse.y !== null) {
            const dx = mouse.x - this.screenX;
            const dy = mouse.y - this.screenY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mouse.radius) {
                const force = (mouse.radius - distance) / mouse.radius;
                this.screenX -= dx * force * 0.2;
                this.screenY -= dy * force * 0.2;
                this.opacity = Math.min(1, this.opacity + force * 0.3);
            }
        }
    }
    
    draw(ctx) {
        // 背面剔除
        if (this.screenZ < -100) return;
        
        ctx.save();
        
        const alpha = this.opacity;
        
        // 砖块主体填充
        ctx.fillStyle = `hsla(${this.hue}, 100%, 55%, ${alpha})`;
        ctx.fillRect(
            this.screenX - this.screenWidth / 2,
            this.screenY - this.screenHeight / 2,
            this.screenWidth,
            this.screenHeight
        );
        
        // 砖块边框
        ctx.strokeStyle = `hsla(${this.hue}, 100%, 75%, ${alpha * 0.8})`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(
            this.screenX - this.screenWidth / 2,
            this.screenY - this.screenHeight / 2,
            this.screenWidth,
            this.screenHeight
        );
        
        ctx.restore();
    }
}

