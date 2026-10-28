import DefaultTheme from 'vitepress/theme';
import { defineComponent, h, onMounted, watch } from 'vue';
import { useData } from 'vitepress';
import PageStatus from './PageStatus.vue';
import HomePage from './HomePage.vue';
import AiBoundary from './AiBoundary.vue';
import './custom.css';
import './home.css';
import './viewer.css';

const Layout = defineComponent({
  setup() {
    const { page } = useData();
    onMounted(() => {
      // The generated 404 bypasses page frontmatter. Own its tag explicitly so
      // it cannot remain on a normal page after client-side navigation.
      watch(() => page.value.isNotFound, (missing) => {
        const existing = document.head.querySelector('meta[data-uwmd-not-found]');
        if (!missing) {
          existing?.remove();
        } else if (!existing) {
          const tag = document.createElement('meta');
          tag.name = 'robots';
          tag.content = 'noindex';
          tag.setAttribute('data-uwmd-not-found', '');
          document.head.appendChild(tag);
        }
      }, { immediate: true });
    });
    return () => h(DefaultTheme.Layout, null, { 'doc-before': () => h(PageStatus) });
  },
});

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage);
    app.component('AiBoundary', AiBoundary);
  },
};
