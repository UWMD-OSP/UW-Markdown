<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

const field = ref(null);
let dispose = () => {};

onMounted(() => {
  const element = field.value;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const events = new AbortController();
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

  const updateScroll = () => {
    const range = document.documentElement.scrollHeight - window.innerHeight;
    targetScroll = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
  };
  const move = (event) => {
    if (!pointer.matches || motion.matches) return;
    targetX = event.clientX / window.innerWidth;
    targetY = event.clientY / window.innerHeight;
  };
  const paint = (time) => {
    frame = 0;
    if (motion.matches || document.hidden) return;
    if (time - lastPaint >= 32) {
      elapsed += lastTime ? Math.min(time - lastTime, 64) : 0;
      lastTime = time;
      lastPaint = time;
      x += (targetX - x) * 0.09;
      y += (targetY - y) * 0.09;
      scroll += (targetScroll - scroll) * 0.07;
      element.style.setProperty('--ambient-x', String(x - 0.5));
      element.style.setProperty('--ambient-y', String(y - 0.5));
      element.style.setProperty('--ambient-scroll', String(scroll));
      element.style.setProperty('--ambient-drift', String(Math.sin(elapsed / 11000)));
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
  window.addEventListener('resize', updateScroll, { passive: true, signal: events.signal });
  document.addEventListener('visibilitychange', syncMotion, { signal: events.signal });
  motion.addEventListener('change', syncMotion, { signal: events.signal });
  updateScroll();
  syncMotion();
  dispose = () => {
    events.abort();
    cancelAnimationFrame(frame);
  };
});

onUnmounted(() => dispose());
</script>

<template>
  <div ref="field" class="uw-ambient" aria-hidden="true">
    <div class="uw-aurora uw-aurora-mint" />
    <div class="uw-aurora uw-aurora-violet" />
    <div class="uw-aurora uw-aurora-blue" />
    <div class="uw-ambient-grid" />
    <div class="uw-ambient-shade" />
  </div>
</template>
