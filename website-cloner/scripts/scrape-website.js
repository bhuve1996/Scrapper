import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

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

async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 30000
    });
    return data;
  } catch (e) {
    console.log(`❌ Failed to fetch: ${url}`);
    return null;
  }
}

function extractLinks($, baseUrl) {
  const links = [];
  $("a[href]").each((_, el) => {
    let href = $(el).attr("href");
    if (!href) return;
    
    try {
      if (!href.startsWith("http")) {
        href = new URL(href, baseUrl).href;
      }
      if (href.startsWith(baseUrl) && !VISITED.has(href)) {
        links.push(href);
      }
    } catch (e) {}
  });
  return links;
}

async function extractAssets($, baseUrl, pageUrl) {
  // Extract images
  $("img[src]").each((_, el) => {
    let src = $(el).attr("src");
    if (!src) return;
    
    try {
      if (!src.startsWith("http")) {
        src = new URL(src, baseUrl).href;
      }
      if (!websiteData.assets.images.find(img => img.url === src)) {
        websiteData.assets.images.push({
          url: src,
          alt: $(el).attr("alt") || "",
          page: pageUrl
        });
      }
    } catch (e) {}
  });

  // Extract CSS
  $("link[rel='stylesheet']").each((_, el) => {
    let href = $(el).attr("href");
    if (!href) return;
    
    try {
      if (!href.startsWith("http")) {
        href = new URL(href, baseUrl).href;
      }
      if (!websiteData.assets.css.find(c => c.url === href)) {
        websiteData.assets.css.push({
          url: href,
          page: pageUrl
        });
      }
    } catch (e) {}
  });

  // Extract JS
  $("script[src]").each((_, el) => {
    let src = $(el).attr("src");
    if (!src) return;
    
    try {
      if (!src.startsWith("http")) {
        src = new URL(src, baseUrl).href;
      }
      if (!websiteData.assets.js.find(j => j.url === src)) {
        websiteData.assets.js.push({
          url: src,
          page: pageUrl
        });
      }
    } catch (e) {}
  });
}

async function analyzePageStructure($, url) {
  const structure = {
    url,
    title: $("title").text().trim(),
    meta: {
      description: $('meta[name="description"]').attr("content") || "",
      keywords: $('meta[name="keywords"]').attr("content") || "",
      ogTitle: $('meta[property="og:title"]').attr("content") || "",
      ogDescription: $('meta[property="og:description"]').attr("content") || "",
      ogImage: $('meta[property="og:image"]').attr("content") || ""
    },
    sections: [],
    components: []
  };

  // Extract main sections
  $("header, nav, main, section, article, aside, footer").each((_, el) => {
    const tag = el.name;
    const id = $(el).attr("id") || "";
    const className = $(el).attr("class") || "";
    const text = $(el).text().trim().substring(0, 200);
    
    structure.sections.push({
      tag,
      id,
      className,
      text,
      children: $(el).children().length
    });
  });

  // Identify common components
  const componentPatterns = {
    navbar: ['nav', '.navbar', '.navigation', '#nav'],
    header: ['header', '.header', '#header'],
    hero: ['.hero', '.banner', '.jumbotron'],
    footer: ['footer', '.footer', '#footer'],
    card: ['.card', '.product-card', '.item-card'],
    button: ['button', '.btn', '.button'],
    form: ['form', '.form', '#contact-form']
  };

  Object.entries(componentPatterns).forEach(([name, selectors]) => {
    selectors.forEach(selector => {
      if ($(selector).length > 0) {
        structure.components.push({
          name,
          selector,
          count: $(selector).length
        });
      }
    });
  });

  return structure;
}

async function scrapePage(url, baseUrl) {
  if (VISITED.has(url)) return;
  VISITED.add(url);

  console.log(`🔍 Scraping: ${url}`);

  const html = await fetchHTML(url);
  if (!html) return;

  const $ = cheerio.load(html);

  // Extract assets
  await extractAssets($, baseUrl, url);

  // Analyze structure
  const structure = await analyzePageStructure($, url);

  // Get rendered HTML with Puppeteer
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    const renderedHTML = await page.content();
    
    websiteData.pages.push({
      url,
      originalHTML: html,
      renderedHTML,
      structure
    });

    websiteData.structure.routes.push({
      url,
      path: new URL(url).pathname,
      title: structure.title
    });
  } catch (err) {
    console.log(`⚠️ Puppeteer error for ${url}: ${err.message}`);
    websiteData.pages.push({
      url,
      originalHTML: html,
      renderedHTML: html,
      structure
    });
  }
  
  await browser.close();

  // Extract links for crawling
  const links = extractLinks($, baseUrl);
  return links;
}

async function downloadAssets() {
  console.log(`\n⬇️ Downloading assets...`);
  
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "images"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "css"));
  await fs.ensureDir(path.join(OUTPUT_DIR, "assets", "js"));

  // Download images
  for (let i = 0; i < websiteData.assets.images.length; i++) {
    const img = websiteData.assets.images[i];
    try {
      const response = await axios.get(img.url, { responseType: 'arraybuffer', timeout: 30000 });
      
      // Get content type from response header (most reliable)
      const contentType = response.headers['content-type'] || '';
      let ext = '';
      
      // Prioritize Content-Type header over URL extension (more reliable)
      if (contentType.includes('image/svg+xml')) {
        ext = '.svg';
      } else if (contentType.includes('image/png')) {
        ext = '.png';
      } else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) {
        ext = '.jpg';
      } else if (contentType.includes('image/webp')) {
        ext = '.webp';
      } else if (contentType.includes('image/gif')) {
        ext = '.gif';
      } else if (contentType.includes('image/x-icon') || contentType.includes('image/vnd.microsoft.icon')) {
        ext = '.ico';
      } else {
        // Fallback to URL extension if Content-Type is not available
        ext = path.extname(new URL(img.url).pathname) || '.jpg';
      }
      
      const filename = `image_${i}${ext}`;
      await fs.writeFile(path.join(OUTPUT_DIR, "assets", "images", filename), response.data);
      img.localPath = `assets/images/${filename}`;
      console.log(`✔ Downloaded: ${filename} (${contentType || 'unknown type'})`);
    } catch (err) {
      console.log(`❌ Failed: ${img.url}`);
    }
  }

  // Download CSS
  for (let i = 0; i < websiteData.assets.css.length; i++) {
    const css = websiteData.assets.css[i];
    try {
      const response = await axios.get(css.url, { timeout: 30000 });
      const filename = `style_${i}.css`;
      await fs.writeFile(path.join(OUTPUT_DIR, "assets", "css", filename), response.data);
      css.localPath = `assets/css/${filename}`;
      console.log(`✔ Downloaded: ${filename}`);
    } catch (err) {
      console.log(`❌ Failed: ${css.url}`);
    }
  }
}

async function crawl(url, baseUrl, maxPages = 10) {
  const links = await scrapePage(url, baseUrl);
  
  if (links.length > 0 && VISITED.size < maxPages) {
    for (const link of links.slice(0, 5)) {
      if (VISITED.size >= maxPages) break;
      await crawl(link, baseUrl, maxPages);
    }
  }
}

async function main() {
  if (!BASE_URL) {
    console.log("❗ Usage: node scripts/scrape-website.js <website_url>");
    console.log("   Example: node scripts/scrape-website.js https://example.com");
    process.exit(1);
  }

  // Check and install dependencies if needed
  await checkAndInstallDependencies();

  console.log("🚀 Website Cloner - Scraper\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`🌐 Target URL: ${BASE_URL}\n`);

  const baseUrl = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

  // Clean output directory
  await fs.emptyDir(OUTPUT_DIR);

  // Crawl website
  console.log("📄 Crawling website...\n");
  await crawl(baseUrl, baseUrl, 10);

  // Download assets
  await downloadAssets();

  // Save all data
  await fs.writeJSON(path.join(OUTPUT_DIR, "website-data.json"), websiteData, { spaces: 2 });
  console.log(`\n📄 Saved: ${OUTPUT_DIR}/website-data.json`);

  // Save individual pages
  await fs.ensureDir(path.join(OUTPUT_DIR, "pages"));
  for (const page of websiteData.pages) {
    const filename = page.url
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 100) + '.html';
    
    await fs.writeFile(path.join(OUTPUT_DIR, "pages", filename), page.renderedHTML);
  }

  console.log(`\n🎉 Scraping complete!`);
  console.log(`   • Pages: ${websiteData.pages.length}`);
  console.log(`   • Images: ${websiteData.assets.images.length}`);
  console.log(`   • CSS Files: ${websiteData.assets.css.length}`);
  console.log(`   • JS Files: ${websiteData.assets.js.length}`);
}

main().catch(console.error);
