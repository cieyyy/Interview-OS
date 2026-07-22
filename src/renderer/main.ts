import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import '../design-system/index.css';
import './styles/global.css';

createApp(App).use(router).mount('#app');
