<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

const field = ref(null);
const pixels = ref(null);
let dispose = () => {};

onMounted(() => {
  const element = field.value;
  const canvas = pixels.value;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const events = new AbortController();
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  let frame = 0;
  let lastPaint = 0;
  let elapsed = 0;
  let lastTime = 0;
  let x = 0.5;
  let y = 0.35;
  let targetX = x;
  let targetY = y;
  let scroll = 0;
  let targetScroll = 0;
  let colors = [];
  let strength = 0;

  const rgba = (hex, alpha) => {
    const color = Number.parseInt(hex.replace('#', ''), 16);
    return `rgba(${color >> 16}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;
  };
  const draw = () => {
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    const drift = Math.sin(elapsed / 11000);
    const lights = [
      [0.12 + (x - 0.5) * 0.34 + drift * 0.07, -0.08 + (y - 0.5) * 0.22 - scroll * 0.16, 0.74, 1],
      [0.94 - (x - 0.5) * 0.26 - drift * 0.06, 0.2 - (y - 0.5) * 0.18 + scroll * 0.2, 0.61, 0.64],
      [0.45 + (x - 0.5) * 0.14, 1.42 - scroll * 0.28, 0.66, 0.48],
    ];
    lights.forEach(([cx, cy, radius, intensity], index) => {
      const gradient = context.createRadialGradient(cx * width, cy * height, 0, cx * width, cy * height, Math.max(width, height) * radius);
      gradient.addColorStop(0, rgba(colors[index], strength * intensity));
      gradient.addColorStop(0.38, rgba(colors[index], strength * intensity * 0.54));
      gradient.addColorStop(1, rgba(colors[index], 0));
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    });
    const image = context.getImageData(0, 0, width, height);
    // The fixed ordered pattern keeps the small cells crisp without random flicker.
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const offset = (row * width + column) * 4;
        const alpha = image.data[offset + 3];
        if (!alpha) continue;
        const threshold = bayer[(row % 4) * 4 + (column % 4)] - 7.5;
        image.data[offset + 3] = Math.max(0, Math.round((alpha + threshold * 1.8) / 18) * 18);
      }
    }
    context.putImageData(image, 0, 0);
  };
  const updateScroll = () => {
    const range = document.documentElement.scrollHeight - window.innerHeight;
    targetScroll = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
  };
  const refresh = () => {
    const style = getComputedStyle(element);
    colors = ['one', 'two', 'three'].map((name) => style.getPropertyValue(`--uw-field-${name}`).trim());
    strength = Number(style.getPropertyValue('--uw-field-strength'));
    const cell = Math.max(4, Math.ceil(Math.sqrt(window.innerWidth * window.innerHeight / 110000)));
    canvas.width = Math.ceil(window.innerWidth / cell);
    canvas.height = Math.ceil(window.innerHeight / cell);
    updateScroll();
    draw();
  };
  const move = (event) => {
    if (!pointer.matches || motion.matches) return;
    targetX = event.clientX / window.innerWidth;
    targetY = event.clientY / window.innerHeight;
  };
  const paint = (time) => {
    frame = 0;
    if (motion.matches || document.hidden) return;
    if (time - lastPaint >= 48) {
      elapsed += lastTime ? Math.min(time - lastTime, 96) : 0;
      lastTime = time;
      lastPaint = time;
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      scroll += (targetScroll - scroll) * 0.1;
      draw();
    }
    frame = requestAnimationFrame(paint);
  };
  const syncMotion = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (!motion.matches && !document.hidden) frame = requestAnimationFrame(paint);
  };

  window.addEventListener('pointermove', move, { passive: true, signal: events.signal });
  window.addEventListener('scroll', updateScroll, { passive: true, signal: events.signal });
  window.addEventListener('resize', refresh, { passive: true, signal: events.signal });
  document.addEventListener('visibilitychange', syncMotion, { signal: events.signal });
  motion.addEventListener('change', syncMotion, { signal: events.signal });
  const theme = new MutationObserver(refresh);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  refresh();
  syncMotion();
  dispose = () => {
    events.abort();
    theme.disconnect();
    cancelAnimationFrame(frame);
  };
});

onUnmounted(() => dispose());
</script>

<template>
  <div ref="field" class="uw-ambient" aria-hidden="true">
    <canvas ref="pixels" class="uw-pixel-field" />
    <div class="uw-ambient-grid" />
    <div class="uw-ambient-shade" />
  </div>
</template>
