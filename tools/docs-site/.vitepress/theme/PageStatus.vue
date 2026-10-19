<script setup>
import { computed } from 'vue';
import { useData } from 'vitepress';
import { PAGE_STATUS, pageStatus } from '../page-status.mjs';

const { page, frontmatter } = useData();
const status = computed(() => pageStatus(page.value.relativePath, frontmatter.value.status));
const label = computed(() => PAGE_STATUS[status.value]);
</script>

<template>
  <aside v-if="page.relativePath !== 'index.md'" class="uw-page-status" :data-status="status" aria-label="Page classification">
    <strong>{{ label.label }}</strong>
    <p>{{ label.description }} <a href="/spec/format">Format</a> and <a href="/spec/protocol">Protocol</a>.</p>
  </aside>
</template>
