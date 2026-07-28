import DefaultTheme from 'vitepress/theme';
import HomePage from './HomePage.vue';
import './custom.css';
import './home.css';
import './viewer.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage);
  },
};
