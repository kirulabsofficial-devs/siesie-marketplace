const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');
const brainDir = 'C:\\Users\\LEE\\.gemini\\antigravity-ide\\brain\\d54c6dc3-e0e2-4d85-a829-913fb4887143';

async function generate() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 2 });

  // Read SVG contents
  const kenteSvg = fs.readFileSync(path.join(publicDir, 'siesie-kente.svg'), 'utf8');
  const symbolSvg = fs.readFileSync(path.join(publicDir, 'siesie-symbol.svg'), 'utf8');
  const faviconSvg = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8');

  // Load font base64 for standalone rendering of wordmark if needed
  const fontPath = path.join(publicDir, 'fonts', 'dela-gothic-one-latin.woff2');
  let fontBase64 = '';
  if (fs.existsSync(fontPath)) {
    fontBase64 = fs.readFileSync(fontPath).toString('base64');
  }

  const targets = [
    {
      name: 'siesie-logo-kente.png',
      width: 600,
      height: 960,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; align-items: center; justify-content: center; background: transparent; width: 600px; height: 960px; }
            svg { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          ${kenteSvg}
        </body>
        </html>
      `
    },
    {
      name: 'siesie-logo-kente-square.png',
      width: 1024,
      height: 1024,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; align-items: center; justify-content: center; background: transparent; width: 1024px; height: 1024px; }
            svg { height: 900px; width: auto; }
          </style>
        </head>
        <body>
          ${kenteSvg}
        </body>
        </html>
      `
    },
    {
      name: 'siesie-logo-monochrome.png',
      width: 600,
      height: 960,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; align-items: center; justify-content: center; background: transparent; width: 600px; height: 960px; }
            svg { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          ${symbolSvg}
        </body>
        </html>
      `
    },
    {
      name: 'siesie-app-icon.png',
      width: 512,
      height: 512,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { display: flex; align-items: center; justify-content: center; background: transparent; width: 512px; height: 512px; }
            svg { width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          ${faviconSvg}
        </body>
        </html>
      `
    },
    {
      name: 'siesie-logo-lockup.png',
      width: 900,
      height: 260,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @font-face {
              font-family: 'Dela Gothic One';
              src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
              font-weight: 400;
              font-style: normal;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              background: transparent;
              width: 900px;
              height: 260px;
            }
            .brand-signature {
              display: inline-flex;
              align-items: center;
              gap: 28px;
            }
            .symbol {
              height: 140px;
              width: 88px;
              flex: 0 0 88px;
            }
            .symbol svg {
              width: 88px;
              height: 140px;
              display: block;
            }
            .wordmark {
              font-family: 'Dela Gothic One', sans-serif;
              font-size: 110px;
              line-height: 1;
              color: #17130e;
              letter-spacing: -0.045em;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="brand-signature">
            <div class="symbol">${kenteSvg}</div>
            <div class="wordmark">Siesie</div>
          </div>
        </body>
        </html>
      `
    },
    {
      name: 'siesie-logo-lockup-dark.png',
      width: 900,
      height: 260,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @font-face {
              font-family: 'Dela Gothic One';
              src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
              font-weight: 400;
              font-style: normal;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              background: #142e43;
              border-radius: 20px;
              width: 900px;
              height: 260px;
            }
            .brand-signature {
              display: inline-flex;
              align-items: center;
              gap: 28px;
            }
            .symbol {
              height: 140px;
              width: 88px;
              flex: 0 0 88px;
            }
            .symbol svg {
              width: 88px;
              height: 140px;
              display: block;
            }
            .wordmark {
              font-family: 'Dela Gothic One', sans-serif;
              font-size: 110px;
              line-height: 1;
              color: #f7f9fa;
              letter-spacing: -0.045em;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="brand-signature">
            <div class="symbol">${kenteSvg}</div>
            <div class="wordmark">Siesie</div>
          </div>
        </body>
        </html>
      `
    }
  ];

  for (const t of targets) {
    await page.setViewportSize({ width: t.width, height: t.height });
    await page.setContent(t.html, { waitUntil: 'load' });
    await page.waitForTimeout(100);

    const publicOut = path.join(publicDir, t.name);
    await page.screenshot({ path: publicOut, omitBackground: true });
    console.log(`Saved ${publicOut}`);

    if (fs.existsSync(brainDir)) {
      const brainOut = path.join(brainDir, t.name);
      fs.copyFileSync(publicOut, brainOut);
      console.log(`Copied to brain: ${brainOut}`);
    }
  }

  await browser.close();
  console.log('Finished generating logo PNGs!');
}

generate().catch(console.error);
