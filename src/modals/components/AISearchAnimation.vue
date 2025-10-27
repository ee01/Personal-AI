<template>
  <transition name="fade">
    <div v-if="show" class="ai-search-overlay">
      <div class="ai-search-container">
        <!-- 中心主圆环 -->
        <div class="central-orb">
          <div class="orb-core"></div>
          <div class="orb-ring ring-1"></div>
          <div class="orb-ring ring-2"></div>
          <div class="orb-ring ring-3"></div>
        </div>
        
        <!-- 浮动粒子 -->
        <div class="particles">
          <div 
            v-for="i in 20" 
            :key="i" 
            class="particle"
            :style="getParticleStyle(i)"
          ></div>
        </div>
        
        <!-- 扫描线 -->
        <div class="scan-lines">
          <div class="scan-line" v-for="i in 3" :key="i"></div>
        </div>
        
        <!-- 文字提示 -->
        <div class="ai-text">
          <div class="ai-icon">🤖</div>
          <div class="ai-message">{{ message }}</div>
          <div class="ai-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        
        <!-- 数据流 -->
        <div class="data-streams">
          <div 
            v-for="i in 8" 
            :key="i" 
            class="data-stream"
            :style="getStreamStyle(i)"
          >
            <div class="stream-dot"></div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  show: boolean;
  message?: string;
}>();

const message = computed(() => props.message || 'AI 正在智能分析...');

const getParticleStyle = (index: number) => {
  const angle = (index / 20) * 360;
  const distance = 150 + Math.random() * 100;
  const size = 4 + Math.random() * 6;
  const duration = 3 + Math.random() * 2;
  
  return {
    '--angle': `${angle}deg`,
    '--distance': `${distance}px`,
    '--size': `${size}px`,
    '--duration': `${duration}s`,
    '--delay': `${Math.random() * 2}s`
  };
};

const getStreamStyle = (index: number) => {
  const angle = (index / 8) * 360;
  const duration = 2 + Math.random() * 1;
  
  return {
    '--stream-angle': `${angle}deg`,
    '--stream-duration': `${duration}s`,
    '--stream-delay': `${index * 0.2}s`
  };
};
</script>

<style scoped>
.ai-search-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(12, 12, 12, 0.95);
  backdrop-filter: blur(20px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.ai-search-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 中心主圆环 */
.central-orb {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.orb-core {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa, #60a5fa);
  background-size: 200% 200%;
  animation: gradientShift 3s ease infinite, pulse 2s ease-in-out infinite;
  box-shadow: 
    0 0 40px rgba(96, 165, 250, 0.6),
    0 0 80px rgba(167, 139, 250, 0.4),
    inset 0 0 20px rgba(255, 255, 255, 0.3);
  position: relative;
  z-index: 2;
}

.orb-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid;
  animation: rotate 10s linear infinite;
}

.orb-ring.ring-1 {
  width: 100px;
  height: 100px;
  border-color: rgba(96, 165, 250, 0.4);
  animation-duration: 8s;
}

.orb-ring.ring-2 {
  width: 140px;
  height: 140px;
  border-color: rgba(167, 139, 250, 0.3);
  animation-duration: 12s;
  animation-direction: reverse;
}

.orb-ring.ring-3 {
  width: 180px;
  height: 180px;
  border-color: rgba(96, 165, 250, 0.2);
  animation-duration: 15s;
}

/* 浮动粒子 */
.particles {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  animation: float var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
  opacity: 0;
  box-shadow: 0 0 10px rgba(96, 165, 250, 0.8);
}

@keyframes float {
  0%, 100% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(0);
    opacity: 0;
  }
  50% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance)) scale(1);
    opacity: 1;
  }
}

/* 扫描线 */
.scan-lines {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  overflow: hidden;
  pointer-events: none;
}

.scan-line {
  position: absolute;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, 
    transparent, 
    rgba(96, 165, 250, 0.8), 
    transparent
  );
  animation: scan 3s linear infinite;
}

.scan-line:nth-child(2) {
  animation-delay: 1s;
}

.scan-line:nth-child(3) {
  animation-delay: 2s;
}

@keyframes scan {
  0% {
    top: 0;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}

/* AI 文字提示 */
.ai-text {
  position: absolute;
  top: 60%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 10;
}

.ai-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  animation: bounce 1.5s ease-in-out infinite;
}

.ai-message {
  font-size: 1.25rem;
  font-weight: 500;
  color: #e2e8f0;
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(96, 165, 250, 0.5);
}

.ai-dots {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.ai-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #60a5fa;
  animation: dotPulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 10px rgba(96, 165, 250, 0.8);
}

.ai-dots span:nth-child(2) {
  animation-delay: 0.3s;
}

.ai-dots span:nth-child(3) {
  animation-delay: 0.6s;
}

/* 数据流 */
.data-streams {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
}

.data-stream {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 100px;
  transform-origin: center;
  transform: translate(-50%, -50%) rotate(var(--stream-angle));
  animation: streamMove var(--stream-duration) ease-in-out infinite;
  animation-delay: var(--stream-delay);
  opacity: 0;
}

.stream-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  box-shadow: 0 0 15px rgba(96, 165, 250, 0.9);
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

@keyframes streamMove {
  0% {
    transform: translate(-50%, -50%) rotate(var(--stream-angle)) translateY(0);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--stream-angle)) translateY(300px);
    opacity: 0;
  }
}

/* 基础动画 */
@keyframes gradientShift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes dotPulse {
  0%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

