// Measures the real built app's signal at AudioDestinationNode, including restored patches.
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFileSync, statSync } = require('node:fs');
const { resolve, extname } = require('node:path');
const assert = require('node:assert/strict');
const prefix = '/Markov-Stochastic-Pattern-Generator/';
(async () => {
  const { makePreset } = await import('../src/state/project.ts');
  const server = createServer((req, res) => {
    try {
      const name = decodeURIComponent(req.url.split('?')[0]).replace(prefix, '');
      let path = resolve('dist', name || 'index.html');
      if (!path.startsWith(resolve('dist') + '/')) throw Error('Invalid path');
      if (statSync(path).isDirectory()) path += '/index.html';
      res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(path)] || 'text/html');
      res.end(readFileSync(path));
    } catch { res.statusCode = 404; res.end('Not found'); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || undefined, args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'] });
    for (const mode of ['fresh', 'muted', 'zero-volume', 'test-sound']) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      // Network-free regression: optional fonts are unrelated to sound.
      await page.route('https://fonts.**/*', route => route.abort());
      const project = makePreset();
      if (mode === 'muted' || mode === 'test-sound') project.config.monitor = false;
      if (mode === 'zero-volume' || mode === 'test-sound') project.config.volume = 0;
      if (mode === 'test-sound') project.config.density = 0;
      await page.addInitScript(project => {
        localStorage.setItem('markov-project-v1', JSON.stringify(project));
        window.audioProbe = { peak: 0, contexts: [] };
        const Native = window.AudioContext;
        window.AudioContext = class extends Native {
          constructor(...args) {
            super(...args); window.audioProbe.contexts.push(this);
            const analyser = this.createAnalyser(), destination = this.destination;
            const connect = AudioNode.prototype.connect;
            AudioNode.prototype.connect = function (to, ...rest) {
              if (to === destination) connect.call(this, analyser);
              return connect.call(this, to, ...rest);
            };
            const samples = new Float32Array(2048);
            setInterval(() => {
              analyser.getFloatTimeDomainData(samples);
              for (const v of samples) window.audioProbe.peak = Math.max(window.audioProbe.peak, Math.abs(v));
            }, 10);
          }
        };
      }, project);
      await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
      await page.getByRole('button', { name: mode === 'test-sound' ? 'Test sound' : 'Start playback', exact: true }).click();
      await page.waitForFunction(() => window.audioProbe.peak > .001, null, { timeout: 5000 });
      const peak = await page.evaluate(() => window.audioProbe.peak);
      assert(peak > .001 && peak < 1, `${mode}: expected audible, bounded output; got ${peak}`);
      assert.deepEqual(errors, []);
      assert.equal(await page.getByRole('link', { name: '← CDL home', exact: true }).getAttribute('href'), 'https://djshellshoxxx.github.io/circuitdriftlabs/');
      if (mode !== 'test-sound') {
        await page.getByRole('button', { name: 'Stop playback', exact: true }).click();
        await page.waitForTimeout(200);
        await page.evaluate(() => { window.audioProbe.peak = 0; });
        await page.waitForTimeout(200);
        assert.equal(await page.evaluate(() => window.audioProbe.peak), 0, 'Stop silences audio');
        // Closing a context must not permanently break a subsequent Play.
        await page.evaluate(() => window.audioProbe.contexts[0].close());
        await page.getByRole('button', { name: 'Start playback', exact: true }).click();
        await page.waitForFunction(() => window.audioProbe.peak > .001);
      }
      console.log(`${mode}: audible signal peak ${peak.toFixed(5)}; stop/restart verified where applicable`);
      await page.close();
    }
  } finally { await browser?.close(); await new Promise(done => server.close(done)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
