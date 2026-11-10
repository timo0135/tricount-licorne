import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource-variable/inter';
import App from './App.vue';
import router from './router';
import { listenForInstall } from './utils/install';
import './styles/main.css';

listenForInstall();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
