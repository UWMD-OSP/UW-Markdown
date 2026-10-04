import DefaultTheme from 'vitepress/theme';
import HomePage from './HomePage.vue';
import AiBoundary from './AiBoundary.vue';
import './custom.css';
import './home.css';
import './viewer.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage);
    app.component('AiBoundary', AiBoundary);
  },
};
