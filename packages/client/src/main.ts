import '@fontsource/limelight/400.css';
import '@fontsource/libre-franklin/400.css';
import '@fontsource/libre-franklin/600.css';
import '@fontsource/libre-franklin/700.css';
import '@fontsource/libre-franklin/800.css';
import '@fontsource/old-standard-tt/400.css';
import '@fontsource/old-standard-tt/400-italic.css';
import '@fontsource/old-standard-tt/700.css';
import './style.css';
import { App } from './app/App';

async function boot() {
  // building signs are painted onto canvases, so the fonts must be ready first
  try {
    await Promise.all([
      document.fonts.load('800 10px "Libre Franklin"'),
      document.fonts.load('700 10px "Libre Franklin"'),
      document.fonts.load('400 10px "Limelight"'),
      document.fonts.load('400 10px "Old Standard TT"'),
    ]);
  } catch { /* fall back to system fonts */ }
  const root = document.getElementById('app')!;
  const app = new App(root);
  (window as unknown as { bg: App }).bg = app;
}
void boot();
