import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as unknown as { __EUTHOPIAR_DEFERRED_PROMPT__?: Event }).__EUTHOPIAR_DEFERRED_PROMPT__ = e;
  });
}

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
