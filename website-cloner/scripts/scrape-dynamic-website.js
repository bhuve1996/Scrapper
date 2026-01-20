import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check and install dependencies if needed
async function checkAndInstallDependencies() {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!await fs.pathExists(nodeModulesPath)) {
    console.log("📦 Installing dependencies...");
    try {
      execSync('npm install', { stdio: 'inherit', cwd: process.cwd() });
      console.log("✅ Dependencies installed!\n");
    } catch (err) {
      console.log("❌ Failed to install dependencies. Please run 'npm install' manually.");
      process.exit(1);
    }
  }
}

const BASE_URL = process.argv[2];
const OUTPUT_DIR = path.join(__dirname, "../scraped-data");
const VISITED = new Set();
const NETWORK_ASSETS = {
  images: new Set(),
  css: new Set(),
  js: new Set(),
  fonts: new Set()
};

let websiteData = {
  pages: [],
  assets: {
    images: [],
    css: [],
    js: [],
    fonts: []
  },
  structure: {
    components: [],
    routes: []
  }
};

// Enhanced Puppeteer scraper for JavaScript-heavy sites
async function scrapeWithPuppeteer(url) {
  console.log(`🌐 Launching browser for: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Monitor network requests to capture all assets
  const networkAssets = {
    images: new Set(),
    css: new Set(),
    js: new Set(),
    fonts: new Set()
  };

  page.on('request', (request) => {
    const url = request.url();
    const resourceType = request.resourceType();
    
    if (resourceType === 'image') {
      networkAssets.images.add(url);
    } else if (resourceType === 'stylesheet') {
      networkAssets.css.add(url);
    } else if (resourceType === 'script') {
      networkAssets.js.add(url);
    } else if (resourceType === 'font') {
      networkAssets.fonts.add(url);
    }
  });

  // Monitor response headers for additional assets
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    
    if (contentType.includes('image/')) {
      networkAssets.images.add(url);
    } else if (contentType.includes('text/css')) {
      networkAssets.css.add(url);
    } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
      networkAssets.js.add(url);
    } else if (contentType.includes('font/') || contentType.includes('application/font')) {
      networkAssets.fonts.add(url);
    }
  });

  try {
    console.log(`   ⏳ Loading page and waiting for JavaScript execution...`);
    
    // Navigate and wait for network to be idle
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait additional time for dynamic content
    console.log(`   ⏳ Waiting for dynamic content to load...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Wait for images to load
    console.log(`   ⏳ Waiting for images to load...`);
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // Resolve even on error to not block
            setTimeout(resolve, 2000); // Timeout after 2s
          });
        })
      );
    });

    // Scroll to trigger lazy-loaded content
    console.log(`   ⏳ Scrolling to trigger lazy-loaded content...`);
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait a bit more after scrolling
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract all styles (including inline and computed)
    console.log(`   📝 Extracting styles and computed CSS...`);
    const styles = await page.evaluate(() => {
      const allStyles = [];
      
      // Extract inline styles
      document.querySelectorAll('[style]').forEach((el) => {
        const className = el.className;
        const classStr = typeof className === 'string' ? className : (className?.baseVal || '');
        const classSelector = classStr ? '.' + classStr.split(' ').filter(c => c).join('.') : '';
        allStyles.push({
          type: 'inline',
          selector: el.tagName.toLowerCase() + classSelector,
          styles: el.getAttribute('style')
        });
      });

      // Extract computed styles for key elements
      const keyElements = document.querySelectorAll('body, header, nav, main, footer, [class*="container"], [class*="wrapper"]');
      keyElements.forEach((el) => {
        try {
          const computed = window.getComputedStyle(el);
          const className = el.className;
          const classStr = typeof className === 'string' ? className : (className?.baseVal || '');
          const classSelector = classStr ? '.' + classStr.split(' ').filter(c => c).join('.') : '';
          allStyles.push({
            type: 'computed',
            selector: el.tagName.toLowerCase() + classSelector,
            styles: Object.fromEntries(
              Array.from(computed).map((prop) => [prop, computed.getPropertyValue(prop)])
            )
          });
        } catch (e) {
          // Skip elements that can't be styled
        }
      });

      return allStyles;
    });

    // Get the final HTML after JavaScript execution
    const html = await page.content();
    
    // Extract all images from the DOM (including dynamically added ones)
    const images = await page.evaluate(() => {
      const imgElements = [];
      document.querySelectorAll('img, [style*="background-image"], [style*="background:"]').forEach((el) => {
        if (el.tagName === 'IMG') {
          const src = el.src || el.getAttribute('src') || el.getAttribute('data-src');
          if (src) {
            imgElements.push({
              url: src,
              alt: el.alt || '',
              width: el.width || el.getAttribute('width') || '',
              height: el.height || el.getAttribute('height') || ''
            });
          }
        } else {
          // Extract background images
          const style = el.getAttribute('style') || window.getComputedStyle(el).backgroundImage;
          const bgMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (bgMatch && bgMatch[1]) {
            imgElements.push({
              url: bgMatch[1],
              alt: el.getAttribute('alt') || '',
              type: 'background'
            });
          }
        }
      });
      return imgElements;
    });

    // Extract all CSS links and style tags
    const cssLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
        if (el.tagName === 'LINK') {
          links.push({
            url: el.href,
            type: 'external'
          });
        } else {
          links.push({
            content: el.textContent,
            type: 'inline'
          });
        }
      });
      return links;
    });

    // Extract all script tags
    const scripts = await page.evaluate(() => {
      const scriptTags = [];
      document.querySelectorAll('script[src]').forEach((el) => {
        scriptTags.push({
          url: el.src,
          type: el.type || 'text/javascript'
        });
      });
      return scriptTags;
    });

    // Extract all links for crawling
    const links = await page.evaluate((baseUrl) => {
      const linkElements = [];
      document.querySelectorAll('a[href]').forEach((el) => {
        try {
          const href = el.href;
          if (href && href.startsWith(baseUrl)) {
            linkElements.push(href);
          }
        } catch (e) {}
      });
      return [...new Set(linkElements)];
    }, BASE_URL);

    // Extract metadata
    const metadata = await page.evaluate(() => {
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
        ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
        ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
        ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
        ogUrl: document.querySelector('meta[property="og:url"]')?.content || '',
        twitterCard: document.querySelector('meta[name="twitter:card"]')?.content || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        favicon: document.querySelector('link[rel="icon"]')?.href || 
                 document.querySelector('link[rel="shortcut icon"]')?.href || ''
      };
    });

    await browser.close();

    // Combine network assets with DOM assets
    const allImages = new Set([
      ...images.map(img => img.url),
      ...Array.from(networkAssets.images)
    ]);

    const allCSS = new Set([
      ...cssLinks.filter(css => css.type === 'external').map(css => css.url),
      ...Array.from(networkAssets.css)
    ]);

    const allJS = new Set([
      ...scripts.map(script => script.url),
      ...Array.from(networkAssets.js)
    ]);

    const allFonts = new Set(Array.from(networkAssets.fonts));

    return {
      html,
      images: Array.from(allImages).map(url => {
        const imgData = images.find(img => img.url === url);
        return {
          url,
          alt: imgData?.alt || '',
          page: url
        };
      }),
      css: Array.from(allCSS).map(url => ({ url, page: url })),
      js: Array.from(allJS).map(url => ({ url, page: url })),
      fonts: Array.from(allFonts).map(url => ({ url, page: url })),
      inlineCSS: cssLinks.filter(css => css.type === 'inline'),
      computedStyles: styles,
      links,
      metadata
    };
  } catch (error) {
    console.error(`❌ Error scraping ${url}:`, error.message);
    await browser.close();
    return null;
  }
}

async function crawl(url, baseUrl, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth || VISITED.has(url)) return;
  
  VISITED.add(url);
  console.log(`\n🔍 Scraping: ${url}`);

  const scraped = await scrapeWithPuppeteer(url);
  if (!scraped) return;

  // Add page data
  const pageData = {
    url,
    path: new URL(url).pathname,
    html: scraped.html,
    renderedHTML: scraped.html,
    metadata: scraped.metadata,
    inlineCSS: scraped.inlineCSS,
    computedStyles: scraped.computedStyles
  };

  websiteData.pages.push(pageData);

  // Add assets
  scraped.images.forEach(img => {
    if (!websiteData.assets.images.find(i => i.url === img.url)) {
      websiteData.assets.images.push(img);
    }
  });

  scraped.css.forEach(css => {
    if (!websiteData.assets.css.find(c => c.url === css.url)) {
      websiteData.assets.css.push(css);
    }
  });

  scraped.js.forEach(js => {
    if (!websiteData.assets.js.find(j => j.url === js.url)) {
      websiteData.assets.js.push(js);
    }
  });

  scraped.fonts.forEach(font => {
    if (!websiteData.assets.fonts.find(f => f.url === font.url)) {
      websiteData.assets.fonts.push(font);
    }
  });

  // Save page HTML
  const pageFilename = url.replace(/^https?:\/\//, '').replace(/\//g, '_').replace(/[^a-z0-9_]/gi, '_') + '.html';
  await fs.writeFile(path.join(OUTPUT_DIR, "pages", pageFilename), scraped.html);

  // Crawl linked pages
  if (currentDepth < maxDepth) {
    for (const link of scraped.links.slice(0, 10)) { // Limit to 10 links per page
      if (!VISITED.has(link) && link.startsWith(baseUrl)) {
        await crawl(link, baseUrl, maxDepth, currentDepth + 1);
      }
    }
  }
}

async function downloadAssets() {
  console.log(`\n⬇️ Downloading assets...`);

  // Create asset directories
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "images"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "css"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "js"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "fonts"));

  // Download images
  for (let i = 0; i < websiteData.assets.images.length; i++) {
    const img = websiteData.assets.images[i];
    try {
      const response = await axios.get(img.url, { 
        responseType: 'arraybuffer', 
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const contentType = response.headers['content-type'] || '';
      let ext = '';
      
      if (contentType.includes('image/svg+xml')) ext = '.svg';
      else if (contentType.includes('image/png')) ext = '.png';
      else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) ext = '.jpg';
      else if (contentType.includes('image/webp')) ext = '.webp';
      else if (contentType.includes('image/gif')) ext = '.gif';
      else if (contentType.includes('image/x-icon') || contentType.includes('image/vnd.microsoft.icon')) ext = '.ico';
      else {
        ext = path.extname(new URL(img.url).pathname);
        if (!ext) ext = '.jpg';
      }
      
      const filename = `image_${i}${ext}`;
      await fs.writeFile(path.join(OUTPUT_DIR, "assets", "images", filename), response.data);
      img.localPath = `assets/images/${filename}`;
      console.log(`   ✔ Downloaded: ${filename}`);
    } catch (err) {
      console.log(`   ❌ Failed: ${img.url}`);
    }
  }

  // Download CSS
  for (let i = 0; i < websiteData.assets.css.length; i++) {
    const css = websiteData.assets.css[i];
    try {
      const response = await axios.get(css.url, { 
        responseType: 'text', 
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const filename = `style_${i}.css`;
      await fs.writeFile(path.join(OUTPUT_DIR, "assets", "css", filename), response.data);
      css.localPath = `assets/css/${filename}`;
      console.log(`   ✔ Downloaded: ${filename}`);
    } catch (err) {
      console.log(`   ❌ Failed: ${css.url}`);
    }
  }

  // Download JS
  for (let i = 0; i < websiteData.assets.js.length; i++) {
    const js = websiteData.assets.js[i];
    try {
      const response = await axios.get(js.url, { 
        responseType: 'text', 
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const filename = `script_${i}.js`;
      await fs.writeFile(path.join(OUTPUT_DIR, "assets", "js", filename), response.data);
      js.localPath = `assets/js/${filename}`;
      console.log(`   ✔ Downloaded: ${filename}`);
    } catch (err) {
      console.log(`   ❌ Failed: ${js.url}`);
    }
  }

  // Download fonts
  for (let i = 0; i < websiteData.assets.fonts.length; i++) {
    const font = websiteData.assets.fonts[i];
    try {
      const response = await axios.get(font.url, { 
        responseType: 'arraybuffer', 
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const contentType = response.headers['content-type'] || '';
      let ext = '.woff2'; // Default
      
      if (contentType.includes('font/woff2')) ext = '.woff2';
      else if (contentType.includes('font/woff')) ext = '.woff';
      else if (contentType.includes('font/ttf')) ext = '.ttf';
      else if (contentType.includes('font/otf')) ext = '.otf';
      else {
        ext = path.extname(new URL(font.url).pathname);
        if (!ext) ext = '.woff2';
      }
      
      const filename = `font_${i}${ext}`;
      await fs.writeFile(path.join(OUTPUT_DIR, "assets", "fonts", filename), response.data);
      font.localPath = `assets/fonts/${filename}`;
      console.log(`   ✔ Downloaded: ${filename}`);
    } catch (err) {
      console.log(`   ❌ Failed: ${font.url}`);
    }
  }
}

async function generateReadme() {
  const imageCounts = {
    svg: websiteData.assets.images.filter(img => img.url.includes('.svg') || img.localPath?.endsWith('.svg')).length,
    png: websiteData.assets.images.filter(img => img.url.includes('.png') || img.localPath?.endsWith('.png')).length,
    webp: websiteData.assets.images.filter(img => img.url.includes('.webp') || img.localPath?.endsWith('.webp')).length,
    jpg: websiteData.assets.images.filter(img => img.url.includes('.jpg') || img.url.includes('.jpeg') || img.localPath?.endsWith('.jpg')).length
  };

  const readmeContent = `# Scraped Website Data (Dynamic/JavaScript-Heavy Site)

## 📊 Scraping Summary

**Website:** ${BASE_URL}
**Scraped Date:** ${new Date().toISOString()}
**Scraper Type:** Dynamic/JavaScript-Heavy Website Scraper

### ✅ What's Done

- ✅ **Pages Scraped:** ${websiteData.pages.length} pages
- ✅ **Images Downloaded:** ${websiteData.assets.images.length} images
  - SVG: ${imageCounts.svg}
  - PNG: ${imageCounts.png}
  - WebP: ${imageCounts.webp}
  - JPG: ${imageCounts.jpg}
- ✅ **CSS Files:** ${websiteData.assets.css.length} stylesheets
- ✅ **JS Files:** ${websiteData.assets.js.length} JavaScript files
- ✅ **Fonts:** ${websiteData.assets.fonts.length} font files
- ✅ **Metadata Extracted:** All page metadata, SEO tags, Open Graph tags
- ✅ **HTML Pages:** All pages saved with fully rendered HTML (after JavaScript execution)
- ✅ **Dynamic Content:** Waited for JavaScript execution, lazy-loaded images, and network requests
- ✅ **Inline Styles:** Extracted inline and computed CSS styles
- ✅ **Website Data JSON:** Complete structured data in website-data.json

### 📋 What's Included

1. **website-data.json** - Complete structured data:
   - All pages with fully rendered HTML content
   - All assets (images, CSS, JS, fonts) with metadata
   - Inline CSS and computed styles
   - Page structure and components
   - SEO and metadata information

2. **pages/** - Individual HTML files for each scraped page (fully rendered)

3. **assets/images/** - All downloaded images with correct file extensions

4. **assets/css/** - All stylesheets (external and inline)

5. **assets/js/** - All JavaScript files

6. **assets/fonts/** - All font files

### ⚠️ What's Missing / Pending

- ⚠️ **Client-side JavaScript Execution:** Some interactive features may need additional implementation
- ⚠️ **Interactive Features:** Forms, dropdowns, modals need client-side JS implementation
- ⚠️ **Authentication/Login:** Login functionality not implemented
- ⚠️ **Dynamic Routes:** Some client-side routing may not be fully captured
- ⚠️ **External APIs:** Some external API calls may not be included
- ⚠️ **WebSocket Connections:** Real-time features may not work

### 🔧 Next Steps

1. **Build the Site:**
   \`\`\`bash
   npm install
   npm run build
   npm run preview
   \`\`\`

2. **Review Scraped Data:**
   - Check \`website-data.json\` for complete structure
   - Verify all images are in \`assets/images/\`
   - Check CSS files in \`assets/css/\`
   - Review inline CSS in page data

3. **Implement Missing Features:**
   - Add client-side JavaScript for interactive elements
   - Implement form handling
   - Add dropdown/modal functionality
   - Handle dynamic content loading

### 📁 File Structure

\`\`\`
scraped-data/
├── website-data.json          # Complete structured data
├── pages/                      # Individual HTML pages (fully rendered)
│   └── *.html
├── assets/
│   ├── images/                 # All images (SVG, PNG, WebP, JPG)
│   ├── css/                    # All stylesheets
│   ├── js/                      # JavaScript files
│   └── fonts/                   # Font files
└── README.md                   # This file
\`\`\`

### 📝 Notes

- This scraper is specifically designed for JavaScript-heavy websites (Framer, React, Vue, etc.)
- All images are saved with correct file extensions based on Content-Type headers
- Pages are fully rendered using Puppeteer with JavaScript execution
- Network requests are monitored to capture all dynamically loaded assets
- Lazy-loaded content is triggered by scrolling
- Inline and computed styles are extracted for better CSS reconstruction
- Metadata includes: title, description, Open Graph tags, Twitter cards, canonical URLs

---
Generated by Dynamic Website Cloner Scraper
`;

  await fs.writeFile(path.join(OUTPUT_DIR, "README.md"), readmeContent);
  console.log(`   ✔ Created: scraped-data/README.md`);
}

async function createZipArchive() {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(__dirname, "../scraped-data.zip");
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }
    });

    output.on("close", () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`\n✅ ZIP created: scraped-data.zip (${sizeMB} MB)`);
      console.log(`   📁 Location: ${zipPath}`);
      console.log(`\n📦 ZIP Contents (scraped data only):`);
      console.log(`   • website-data.json (complete structured data)`);
      console.log(`   • pages/ (${websiteData.pages.length} HTML pages)`);
      console.log(`   • assets/images/ (${websiteData.assets.images.length} images)`);
      console.log(`   • assets/css/ (${websiteData.assets.css.length} stylesheets)`);
      console.log(`   • assets/js/ (${websiteData.assets.js.length} JS files)`);
      console.log(`   • assets/fonts/ (${websiteData.assets.fonts.length} fonts)`);
      console.log(`   • README.md (documentation)\n`);
      resolve();
    });

    archive.on("error", (err) => {
      console.error("❌ ZIP creation error:", err);
      reject(err);
    });

    archive.pipe(output);
    archive.directory(OUTPUT_DIR, false);
    archive.finalize();
  });
}

async function main() {
  await checkAndInstallDependencies();

  if (!BASE_URL) {
    console.error("❌ Please provide a URL to scrape");
    console.log("Usage: npm run scrape-dynamic <url>");
    process.exit(1);
  }

  console.log("\n🚀 Website Cloner - Dynamic/JavaScript-Heavy Scraper");
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\n🌐 Target URL: ${BASE_URL}\n`);

  // Clear old data
  console.log("🧹 Clearing old scraped data...");
  await fs.emptyDir(OUTPUT_DIR);
  await fs.ensureDir(path.join(OUTPUT_DIR, "pages"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "images"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "css"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "js"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "fonts"));

  // Scrape website
  console.log("\n📄 Crawling website...\n");
  await crawl(BASE_URL, BASE_URL, 3);

  // Download assets
  await downloadAssets();

  // Save website data
  await fs.writeJSON(path.join(OUTPUT_DIR, "website-data.json"), websiteData, { spaces: 2 });
  console.log(`\n📄 Saved: ${path.join(OUTPUT_DIR, "website-data.json")}`);

  console.log(`\n🎉 Scraping complete!`);
  console.log(`   • Pages: ${websiteData.pages.length}`);
  console.log(`   • Images: ${websiteData.assets.images.length}`);
  console.log(`   • CSS Files: ${websiteData.assets.css.length}`);
  console.log(`   • JS Files: ${websiteData.assets.js.length}`);
  console.log(`   • Fonts: ${websiteData.assets.fonts.length}`);

  // Generate README
  console.log(`\n📝 Generating README...`);
  await generateReadme();

  // Create ZIP
  console.log(`\n📦 Creating ZIP archive...`);
  await createZipArchive();
}

main().catch(console.error);
