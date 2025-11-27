// AI 助理头像 - 版本1：优化的粒子系统（性能优化版）
class AIAvatarV1 {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 80 };
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
        // 大幅降低粒子数量以提升性能
        const particleCount = this.isMobile() ? 300 : 600;
        
        const headShape = this.generateHeadShape();
        
        for (let i = 0; i < particleCount; i++) {
            const targetPoint = headShape[Math.floor(Math.random() * headShape.length)];
            this.particles.push(new ParticleV1(
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
        
        // 头部轮廓
        for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const x = this.centerX + Math.cos(angle) * scale;
            const y = this.centerY + Math.sin(angle) * (scale * 1.2);
            points.push({ x, y, importance: 0.8 });
        }
        
        // 左眼
        const leftEyeX = this.centerX - scale * 0.3;
        const leftEyeY = this.centerY - scale * 0.2;
        for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
            const x = leftEyeX + Math.cos(angle) * (scale * 0.15);
            const y = leftEyeY + Math.sin(angle) * (scale * 0.1);
            points.push({ x, y, importance: 1.5 });
        }
        
        // 右眼
        const rightEyeX = this.centerX + scale * 0.3;
        const rightEyeY = this.centerY - scale * 0.2;
        for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
            const x = rightEyeX + Math.cos(angle) * (scale * 0.15);
            const y = rightEyeY + Math.sin(angle) * (scale * 0.1);
            points.push({ x, y, importance: 1.5 });
        }
        
        return points;
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
            this.createParticles();
        });
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            particle.update(this.mouse);
            particle.draw(this.ctx);
        });
        
        // 减少连线以提升性能
        if (!this.isMobile()) {
            this.connectParticles();
        }
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    connectParticles() {
        const maxDistance = 60;
        const maxConnections = 3; // 限制每个粒子的最大连接数
        
        for (let i = 0; i < this.particles.length; i++) {
            let connections = 0;
            for (let j = i + 1; j < this.particles.length && connections < maxConnections; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    const opacity = (1 - distance / maxDistance) * 0.2;
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                    connections++;
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

class ParticleV1 {
    constructor(canvasWidth, canvasHeight, target, centerX, centerY) {
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;
        this.targetX = target.x;
        this.targetY = target.y;
        this.importance = target.importance || 1;
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 1.5 + 1;
        this.baseSize = this.size;
        this.breathPhase = Math.random() * Math.PI * 2;
        this.breathSpeed = 0.015;
        this.hue = 180 + Math.random() * 40;
        this.brightness = 70 + Math.random() * 30;
        this.isEye = this.importance > 1;
        this.glowPhase = Math.random() * Math.PI * 2;
    }
    
    update(mouse) {
        const breath = Math.sin(this.breathPhase) * 0.5 + 0.5;
        this.breathPhase += this.breathSpeed;
        
        let dx = this.targetX - this.x + Math.sin(this.breathPhase) * 1.5;
        let dy = this.targetY - this.y + Math.cos(this.breathPhase) * 1.5;
        
        if (mouse.x !== null && mouse.y !== null) {
            const mouseDx = mouse.x - this.x;
            const mouseDy = mouse.y - this.y;
            const mouseDistance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
            
            if (mouseDistance < mouse.radius) {
                const force = (mouse.radius - mouseDistance) / mouse.radius;
                const angle = Math.atan2(mouseDy, mouseDx);
                const pushDistance = force * 25;
                
                dx -= Math.cos(angle) * pushDistance;
                dy -= Math.sin(angle) * pushDistance;
                this.size = this.baseSize * (1 + force * 0.3);
            } else {
                this.size = this.baseSize;
            }
        } else {
            this.size = this.baseSize;
        }
        
        this.vx += dx * 0.015;
        this.vy += dy * 0.015;
        this.vx *= 0.92;
        this.vy *= 0.92;
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.isEye) {
            this.glowPhase += 0.025;
            this.brightness = 70 + Math.sin(this.glowPhase) * 25;
        }
    }
    
    draw(ctx) {
        const glowSize = this.size * (this.isEye ? 3 : 1.5);
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, glowSize
        );
        
        const alpha = this.isEye ? 0.7 : 0.5;
        gradient.addColorStop(0, `hsla(${this.hue}, 100%, ${this.brightness}%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${this.hue}, 100%, ${this.brightness}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = `hsl(${this.hue}, 100%, ${this.brightness}%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

