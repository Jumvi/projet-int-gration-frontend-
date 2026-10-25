'use strict';

const net = require('node:net');
const { launch } = require('./browser');

const freePort = () =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

// Score Lighthouse « Accessibilité » (0–100) sur le premier lancement, au format ordinateur.
const runLighthouse = async (url) => {
  const port = await freePort();
  const browser = await launch({ args: [`--remote-debugging-port=${port}`] });
  try {
    const { default: lighthouse } = await import('lighthouse');
    const result = await lighthouse(
      url,
      { port, output: 'json', logLevel: 'error', onlyCategories: ['accessibility'] },
      { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { disabled: true }, throttlingMethod: 'provided' } },
    );
    const lhr = result.lhr;
    const category = lhr.categories.accessibility;
    const failing = category.auditRefs
      .map((ref) => lhr.audits[ref.id])
      .filter((a) => a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'manual')
      .map((a) => a.title);
    return { ok: true, score: Math.round((category.score || 0) * 100), failing };
  } catch (e) {
    return { ok: false, score: null, failing: [], error: String(e.message || e).split('\n')[0] };
  } finally {
    await browser.close();
  }
};

module.exports = { runLighthouse };
