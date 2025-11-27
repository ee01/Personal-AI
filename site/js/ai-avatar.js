// AI 助理头像 - 粒子系统实现
class AIAvatar {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 100 };
        this.animationId = null;
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        this.resizeCanvas();
        this.createParticles();
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, 500);
        this.canvas.width = size;
        this.canvas.height = size;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }
    
    createParticles() {
        this.particles = [];
        const particleCount = this.isMobile() ? 800 : 1500;
        
        // 定义头像轮廓关键点
        const headShape = this.generateHeadShape();
        
        for (let i = 0; i < particleCount; i++) {
            const targetPoint = headShape[Math.floor(Math.random() * headShape.length)];
            this.particles.push(new Particle(
                this.canvas.width,
                this.canvas.height,
                targetPoint,
                this.centerX,
                this.centerY
            ));
        }
    }
    
    generateHeadShape() {
        const points = [];
        const scale = Math.min(this.canvas.width, this.canvas.height) * 0.35;
        
        // 头部轮廓 (椭圆)
        for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
            const x = this.centerX + Math.cos(angle) * scale;
            const y = this.centerY + Math.sin(angle) * (scale * 1.2);
            points.push({ x, y, importance: 0.8 });
        }
        
        // 左眼轮廓
        const leftEyeX = this.centerX - scale * 0.3;
        const leftEyeY = this.centerY - scale * 0.2;
        for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const x = leftEyeX + Math.cos(angle) * (scale * 0.15);
            const y = leftEyeY + Math.sin(angle) * (scale * 0.1);
            points.push({ x, y, importance: 1.5 });
        }
        
        // 右眼轮廓
        const rightEyeX = this.centerX + scale * 0.3;
        const rightEyeY = this.centerY - scale * 0.2;
        for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const x = rightEyeX + Math.cos(angle) * (scale * 0.15);
            const y = rightEyeY + Math.sin(angle) * (scale * 0.1);
            points.push({ x, y, importance: 1.5 });
        }
        
        // 额头到下巴的中心线
        for (let i = 0; i < 20; i++) {
            const y = this.centerY - scale + (i / 20) * (scale * 2.4);
            points.push({ x: this.centerX, y, importance: 0.5 });
        }
        
        return points;
    }
    
    isMobile() {
        return window.innerWidth < 768;
    }
    
    setupEventListeners() {
        // 鼠标移动事件
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
        
        // 响应式调整
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.createParticles();
        });
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 更新和绘制粒子
        this.particles.forEach(particle => {
            particle.update(this.mouse);
            particle.draw(this.ctx);
        });
        
        // 绘制粒子间的连线
        this.connectParticles();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    connectParticles() {
        const maxDistance = 80;
        
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    const opacity = (1 - distance / maxDistance) * 0.3;
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

class Particle {
    constructor(canvasWidth, canvasHeight, target, centerX, centerY) {
        // 初始位置（随机）
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;
        
        // 目标位置
        this.targetX = target.x;
        this.targetY = target.y;
        this.importance = target.importance || 1;
        
        // 速度
        this.vx = 0;
        this.vy = 0;
        
        // 属性
        this.size = Math.random() * 2 + 1;
        this.baseSize = this.size;
        this.density = (Math.random() * 30) + 1;
        
        // 呼吸效果
        this.breathPhase = Math.random() * Math.PI * 2;
        this.breathSpeed = 0.02;
        
        // 颜色
        this.hue = 180 + Math.random() * 40; // 青色到蓝色
        this.brightness = 70 + Math.random() * 30;
        
        // 眼睛发光效果
        this.isEye = this.importance > 1;
        this.glowPhase = Math.random() * Math.PI * 2;
    }
    
    update(mouse) {
        // 呼吸效果
        const breath = Math.sin(this.breathPhase) * 0.5 + 0.5;
        this.breathPhase += this.breathSpeed;
        
        // 计算到目标位置的距离
        let dx = this.targetX - this.x + Math.sin(this.breathPhase) * 2;
        let dy = this.targetY - this.y + Math.cos(this.breathPhase) * 2;
        
        // 鼠标交互 - 水波效果
        if (mouse.x !== null && mouse.y !== null) {
            const mouseDx = mouse.x - this.x;
            const mouseDy = mouse.y - this.y;
            const mouseDistance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
            
            if (mouseDistance < mouse.radius) {
                // 产生涟漪推开效果
                const force = (mouse.radius - mouseDistance) / mouse.radius;
                const angle = Math.atan2(mouseDy, mouseDx);
                const pushDistance = force * 30;
                
                dx -= Math.cos(angle) * pushDistance;
                dy -= Math.sin(angle) * pushDistance;
                
                // 放大粒子
                this.size = this.baseSize * (1 + force * 0.5);
            } else {
                this.size = this.baseSize;
            }
        } else {
            this.size = this.baseSize;
        }
        
        // 弹性移动到目标位置
        this.vx += dx * 0.02;
        this.vy += dy * 0.02;
        
        // 阻尼
        this.vx *= 0.9;
        this.vy *= 0.9;
        
        // 更新位置
        this.x += this.vx;
        this.y += this.vy;
        
        // 眼睛发光动画
        if (this.isEye) {
            this.glowPhase += 0.03;
            this.brightness = 70 + Math.sin(this.glowPhase) * 30;
        }
    }
    
    draw(ctx) {
        // 发光效果
        const glowSize = this.size * (this.isEye ? 4 : 2);
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, glowSize
        );
        
        const alpha = this.isEye ? 0.8 : 0.6;
        gradient.addColorStop(0, `hsla(${this.hue}, 100%, ${this.brightness}%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${this.hue}, 100%, ${this.brightness}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // 核心粒子
        ctx.fillStyle = `hsl(${this.hue}, 100%, ${this.brightness}%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const avatarCanvas = document.getElementById('ai-avatar');
    if (avatarCanvas) {
        new AIAvatar('ai-avatar');
    }
});

