const { chromium, devices } = require('playwright');
const path = require('path');

const outDir = 'C:\\Users\\LEE\\.gemini\\antigravity-ide\\brain\\87d84e27-d72f-48b6-9d89-e16c8b72c717';

async function capture() {
  const browser = await chromium.launch({ headless: true });

  // 1. Mobile iPhone 14 view
  const mobileContext = await browser.newContext({
    ...devices['iPhone 14'],
    deviceScaleFactor: 2,
  });
  const mobilePage = await mobileContext.newPage();

  console.log('Navigating to Home (Mobile)...');
  await mobilePage.goto('http://localhost:5178/', { waitUntil: 'networkidle' });
  await mobilePage.screenshot({
    path: path.join(outDir, 'mobile_home_top.png'),
  });

  await mobilePage.evaluate(() => window.scrollBy(0, 500));
  await mobilePage.waitForTimeout(400);
  await mobilePage.screenshot({
    path: path.join(outDir, 'mobile_home_categories.png'),
  });

  await mobilePage.evaluate(() => window.scrollBy(0, 550));
  await mobilePage.waitForTimeout(400);
  await mobilePage.screenshot({
    path: path.join(outDir, 'mobile_home_services.png'),
  });

  console.log('Navigating to Detail Service Page (Mobile)...');
  await mobilePage.goto('http://localhost:5178/workers/w_kwame', { waitUntil: 'networkidle' });
  await mobilePage.screenshot({
    path: path.join(outDir, 'mobile_detail_service.png'),
  });

  await mobilePage.evaluate(() => window.scrollBy(0, 480));
  await mobilePage.waitForTimeout(400);
  await mobilePage.screenshot({
    path: path.join(outDir, 'mobile_packages_detail.png'),
  });

  console.log('Navigating to Search Page (Mobile)...');
  await mobilePage.goto('http://localhost:5178/search', { waitUntil: 'networkidle' });
  await mobilePage.screenshot({
    path: path.join(outDir, 'mobile_search_explore.png'),
  });

  // 2. Desktop View
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 840 },
    deviceScaleFactor: 2,
  });
  const desktopPage = await desktopContext.newPage();

  console.log('Navigating to Home (Desktop)...');
  await desktopPage.goto('http://localhost:5178/', { waitUntil: 'networkidle' });
  await desktopPage.screenshot({
    path: path.join(outDir, 'desktop_home.png'),
  });

  console.log('Navigating to Detail Service (Desktop)...');
  await desktopPage.goto('http://localhost:5178/workers/w_kwame', { waitUntil: 'networkidle' });
  await desktopPage.screenshot({
    path: path.join(outDir, 'desktop_detail_service.png'),
  });

  console.log('Navigating to Search (Desktop)...');
  await desktopPage.goto('http://localhost:5178/search', { waitUntil: 'networkidle' });
  await desktopPage.screenshot({
    path: path.join(outDir, 'desktop_search.png'),
  });

  await browser.close();
  console.log('All Playwright screenshots saved successfully!');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
