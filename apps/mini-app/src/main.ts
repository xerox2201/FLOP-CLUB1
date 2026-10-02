import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { initI18n } from './i18n';

const target = document.getElementById('app');
if (!target) throw new Error('#app not found');

// Resolve the language and direction before the first paint, so the app never
// flashes English. A failure still mounts the app in English.
const app = initI18n()
  .catch((error) => {
    console.error('[i18n] init failed', error);
  })
  .then(() => mount(App, { target }));

export default app;
