import puppeteer from "puppeteer";
import fs from "fs-extra";

const SEARCH_QUERY = process.argv[2];
const MAX_IMAGES = parseInt(process.argv[3]) || 50;
const OUTPUT_DIR = "./google-images";

async function scrapeGoogleImages(query, maxImages) {
  console.log(`🔍 Searching Google Images for: "${query}"`);
  console.log(`📸 Max images to fetch: ${maxImages}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
  await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Scroll to load more images
  let previousHeight = 0;
  let scrollAttempts = 0;
  const maxScrolls = 10;

  while (scrollAttempts < maxScrolls) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === previousHeight) break;
    previousHeight = newHeight;
    scrollAttempts++;

    // Check if we have enough images
    const imageCount = await page.evaluate(() => 
      document.querySelectorAll('img[data-src], img[src*="encrypted"]').length
    );
    if (imageCount >= maxImages) break;

    console.log(`📜 Scrolling... (found ${imageCount} images)`);
  }

  // Extract image URLs
  const imageUrls = await page.evaluate((max) => {
    const images = [];
    const imgElements = document.querySelectorAll('img');

    for (const img of imgElements) {
      if (images.length >= max) break;

      const src = img.src || img.dataset.src;
      if (src && src.startsWith('http') && !src.includes('google.com/images')) {
        // Filter out small icons and Google UI elements
        if (img.width > 50 && img.height > 50) {
          images.push({
            src: src,
            alt: img.alt || '',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          });
        }
      }
    }

    return images;
  }, maxImages);

  // Click on images to get full resolution URLs
  console.log(`\n🖼️ Extracting high-res URLs from ${imageUrls.length} thumbnails...`);

  const highResUrls = [];
  const thumbnails = await page.$$('img[data-src], div[data-id] img');

  for (let i = 0; i < Math.min(thumbnails.length, maxImages); i++) {
    try {
      await thumbnails[i].click();
      await new Promise(resolve => setTimeout(resolve, 800));

      const highResUrl = await page.evaluate(() => {
        const sidePanel = document.querySelector('img[data-noaft="1"]');
        if (sidePanel && sidePanel.src && sidePanel.src.startsWith('http')) {
          return sidePanel.src;
        }
        // Fallback: look for large images in the panel
        const largeImg = document.querySelector('a[target="_blank"] img');
        if (largeImg && largeImg.src) return largeImg.src;
        return null;
      });

      if (highResUrl && !highResUrl.includes('google.com')) {
        highResUrls.push(highResUrl);
        console.log(`✔ [${highResUrls.length}/${maxImages}] Found high-res image`);
      }
    } catch (err) {
      // Skip failed clicks
    }

    if (highResUrls.length >= maxImages) break;
  }

  await browser.close();

  // Combine results
  const allUrls = [...new Set([...highResUrls, ...imageUrls.map(i => i.src)])].slice(0, maxImages);

  return allUrls;
}

async function downloadImages(urls) {
  await fs.ensureDir(OUTPUT_DIR);

  console.log(`\n⬇️ Downloading ${urls.length} images...\n`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let downloaded = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const response = await page.goto(url, { timeout: 15000 });
      const buffer = await response.buffer();

      // Get extension from content-type or URL
      const contentType = response.headers()['content-type'] || '';
      let ext = 'jpg';
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('gif')) ext = 'gif';
      else if (contentType.includes('webp')) ext = 'webp';
      else if (contentType.includes('svg')) ext = 'svg';

      const filename = `image_${i + 1}.${ext}`;
      await fs.writeFile(`${OUTPUT_DIR}/${filename}`, buffer);
      downloaded++;
      console.log(`✔ Saved: ${filename}`);
    } catch (err) {
      console.log(`❌ Failed: ${url.substring(0, 60)}...`);
    }
  }

  await browser.close();
  return downloaded;
}

async function main() {
  if (!SEARCH_QUERY) {
    console.log("❗ Usage: node scrape-google-images.js \"search query\" [max_images]");
    console.log("   Example: node scrape-google-images.js \"cute cats\" 20");
    process.exit(1);
  }

  console.log("🚀 Google Images Scraper\n");

  const urls = await scrapeGoogleImages(SEARCH_QUERY, MAX_IMAGES);

  // Save URL list
  await fs.ensureDir(OUTPUT_DIR);
  await fs.writeJSON(`${OUTPUT_DIR}/image-urls.json`, urls, { spaces: 2 });
  console.log(`\n📄 Saved URL list: ${OUTPUT_DIR}/image-urls.json`);

  // Download images
  const count = await downloadImages(urls);

  console.log(`\n🎉 Done! Downloaded ${count} images to ${OUTPUT_DIR}/`);
}

main().catch(console.error);

