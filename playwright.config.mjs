// Les vérifications du site : Playwright contre le site servi en local, comme GitHub Pages le sert.
// Le Chromium et la commande du serveur sont ceux de tests/outils/environnement.mjs, comme pour Lighthouse et les captures.
import { defineConfig } from '@playwright/test';
import { CHROMIUM, commandeServeur } from './tests/outils/environnement.mjs';

const port = Number(process.env.PW_PORT) || 4173;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    launchOptions: { executablePath: CHROMIUM },
  },
  webServer: {
    command: commandeServeur(port).map((morceau) => JSON.stringify(morceau)).join(' '),
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
