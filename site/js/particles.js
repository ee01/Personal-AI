// 背景粒子效果
class ParticlesBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
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
        this.canvas.width = window.innerWidth;
        this.canvas.height = document.documentElement.scrollHeight;
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '0';
    }
    
    createParticles() {
        this.particles = [];
        const particleCount = this.isMobile() ? 50 : 100;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(new BackgroundParticle(this.canvas.width, this.canvas.height));
        }
    }
    
    isMobile() {
        return window.innerWidth < 768;
    }
    
    setupEventListeners() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resizeCanvas();
                this.createParticles();
            }, 250);
        });
        
        // 滚动时更新画布高度
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if (this.canvas.height !== document.documentElement.scrollHeight) {
                    this.canvas.height = document.documentElement.scrollHeight;
                }
            }, 100);
        });
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            particle.update(this.canvas.width, this.canvas.height);
            particle.draw(this.ctx);
        });
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

class BackgroundParticle {
    constructor(canvasWidth, canvasHeight) {
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;
        this.size = Math.random() * 2 + 0.5;
        
        // 速度
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        
        // 颜色（蓝紫色系）
        this.hue = 180 + Math.random() * 80; // 180-260
        this.brightness = 50 + Math.random() * 30;
        this.alpha = Math.random() * 0.5 + 0.2;
        
        // 闪烁效果
        this.twinkleSpeed = 0.01 + Math.random() * 0.02;
        this.twinklePhase = Math.random() * Math.PI * 2;
    }
    
    update(canvasWidth, canvasHeight) {
        // 移动
        this.x += this.speedX;
        this.y += this.speedY;
        
        // 边界检测 - 循环
        if (this.x < 0) this.x = canvasWidth;
        if (this.x > canvasWidth) this.x = 0;
        if (this.y < 0) this.y = canvasHeight;
        if (this.y > canvasHeight) this.y = 0;
        
        // 闪烁效果
        this.twinklePhase += this.twinkleSpeed;
        this.alpha = 0.2 + Math.sin(this.twinklePhase) * 0.3;
    }
    
    draw(ctx) {
        // 发光效果
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size * 3
        );
        
        gradient.addColorStop(0, `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha})`);
        gradient.addColorStop(1, `hsla(${this.hue}, 100%, ${this.brightness}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 核心
        ctx.fillStyle = `hsla(${this.hue}, 100%, ${this.brightness + 20}%, ${this.alpha * 1.5})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const particlesCanvas = document.getElementById('particles-canvas');
    if (particlesCanvas) {
        new ParticlesBackground('particles-canvas');
    }
});

