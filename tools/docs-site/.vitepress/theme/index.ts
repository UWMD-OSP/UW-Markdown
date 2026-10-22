import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import PageStatus from './PageStatus.vue';
import HomePage from './HomePage.vue';
import AiBoundary from './AiBoundary.vue';
import './custom.css';
import './home.css';
import './viewer.css';

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { 'doc-before': () => h(PageStatus) }),
  enhanceApp({ app }) {
    app.component('HomePage', HomePage);
    app.component('AiBoundary', AiBoundary);
  },
};
