// AI 助理头像 - 版本5：对话气泡风格（参考logo）
class AIAvatarV5 {
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
        const particleCount = this.isMobile() ? 300 : 600;
        
        // 生成对话气泡形状
        const bubbleShape = this.generateChatBubbleShape();
        
        for (let i = 0; i < particleCount; i++) {
            const targetPoint = bubbleShape[Math.floor(Math.random() * bubbleShape.length)];
            this.particles.push(new ChatBubbleParticle(
                this.canvas.width,
                this.canvas.height,
                targetPoint,
                this.centerX,
                this.centerY
            ));
        }
    }
    
    generateChatBubbleShape() {
        const points = [];
        const scale = Math.min(this.canvas.width, this.canvas.height) * 0.32;
        
        // 主圆形部分
        for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
            const x = this.centerX + Math.cos(angle) * scale;
            const y = this.centerY + Math.sin(angle) * scale;
            points.push({ x, y, importance: 0.8 });
        }
        
        // 左眼
        const leftEyeX = this.centerX - scale * 0.35;
        const leftEyeY = this.centerY - scale * 0.15;
        const eyeRadius = scale * 0.15;
        for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const x = leftEyeX + Math.cos(angle) * eyeRadius;
            const y = leftEyeY + Math.sin(angle) * eyeRadius;
            points.push({ x, y, importance: 1.5 });
        }
        
        // 右眼
        const rightEyeX = this.centerX + scale * 0.35;
        const rightEyeY = this.centerY - scale * 0.15;
        for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const x = rightEyeX + Math.cos(angle) * eyeRadius;
            const y = rightEyeY + Math.sin(angle) * eyeRadius;
            points.push({ x, y, importance: 1.5 });
        }
        
        // 嘴巴 - 微笑曲线
        for (let i = 0; i < 20; i++) {
            const t = i / 20;
            const angle = Math.PI * 0.2 + t * Math.PI * 0.6; // 从左到右的弧度
            const radius = scale * 0.5;
            const x = this.centerX + Math.cos(angle) * radius * 0.8;
            const y = this.centerY + Math.sin(angle) * radius * 0.6 + scale * 0.1;
            points.push({ x, y, importance: 1.2 });
        }
        
        // 底部尖角（对话气泡的尾巴）
        const tailStartX = this.centerX - scale * 0.4;
        const tailStartY = this.centerY + scale * 0.7;
        const tailEndX = this.centerX - scale * 0.55;
        const tailEndY = this.centerY + scale * 1.1;
        
        for (let i = 0; i < 15; i++) {
            const t = i / 15;
            const x = tailStartX + (tailEndX - tailStartX) * t;
            const y = tailStartY + (tailEndY - tailStartY) * t;
            points.push({ x, y, importance: 0.9 });
        }
        
        // 尾巴的另一边
        const tailStart2X = this.centerX - scale * 0.2;
        const tailStart2Y = this.centerY + scale * 0.8;
        for (let i = 0; i < 10; i++) {
            const t = i / 10;
            const x = tailStart2X + (tailEndX - tailStart2X) * t;
            const y = tailStart2Y + (tailEndY - tailStart2Y) * t;
            points.push({ x, y, importance: 0.9 });
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
        
        // 绘制连接线
        if (!this.isMobile()) {
            this.connectParticles();
        }
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    connectParticles() {
        const maxDistance = 60;
        const maxConnections = 3;
        
        for (let i = 0; i < this.particles.length; i++) {
            let connections = 0;
            for (let j = i + 1; j < this.particles.length && connections < maxConnections; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    const opacity = (1 - distance / maxDistance) * 0.25;
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(26, 188, 156, ${opacity})`; // 绿色
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

class ChatBubbleParticle {
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
        
        // 绿色主题 (类似logo)
        this.hue = 160 + Math.random() * 20; // 绿色范围
        this.brightness = 50 + Math.random() * 20;
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
            this.brightness = 50 + Math.sin(this.glowPhase) * 15;
        }
    }
    
    draw(ctx) {
        const glowSize = this.size * (this.isEye ? 3 : 1.5);
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, glowSize
        );
        
        const alpha = this.isEye ? 0.7 : 0.5;
        gradient.addColorStop(0, `hsla(${this.hue}, 70%, ${this.brightness}%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${this.hue}, 70%, ${this.brightness}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // 绿色核心
        ctx.fillStyle = `hsl(${this.hue}, 70%, ${this.brightness + 20}%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

