import { bootstrapApplication } from '@angular/platform-browser';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import { appConfig } from './app/app.config';
import { App } from './app/app';

polyfillCountryFlagEmojis(
  'Twemoji Country Flags',
  new URL('fonts/TwemojiCountryFlags.woff2', document.baseURI).href,
);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
