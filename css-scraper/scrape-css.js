import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import JSZip from "jszip";
import path from "path";

const args = process.argv.slice(2);
const KEEP_OLD_DATA = args.includes('--keep');
const BASE_URL = args.filter(a => !a.startsWith('--'))[0];
const OUTPUT_DIR = "./css-output";
const VISITED = new Set();
let allCSS = {
  inline: [],
  internal: [],
  external: [],
  computed: {},
  stylesheets: []
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

async function extractCSSFromPage(url, baseUrl) {
  if (VISITED.has(url)) return;
  VISITED.add(url);

  console.log(`🔍 Scraping CSS from: ${url}`);

  const html = await fetchHTML(url);
  if (!html) return;

  const $ = cheerio.load(html);

  // Extract inline styles
  $("[style]").each((_, el) => {
    const style = $(el).attr("style");
    const selector = el.name + (el.attribs.id ? `#${el.attribs.id}` : '') + 
                     (el.attribs.class ? `.${el.attribs.class.split(' ')[0]}` : '');
    if (style && style.trim()) {
      allCSS.inline.push({
        url,
        selector,
        styles: style.trim()
      });
    }
  });

  // Extract internal <style> tags
  $("style").each((_, el) => {
    const css = $(el).html();
    if (css && css.trim()) {
      allCSS.internal.push({
        url,
        css: css.trim()
      });
    }
  });

  // Extract external stylesheet links
  $("link[rel='stylesheet'], link[rel='preload'][as='style']").each((_, el) => {
    let href = $(el).attr("href");
    if (!href) return;

    try {
      if (!href.startsWith("http")) {
        href = new URL(href, baseUrl).href;
      }
      if (!allCSS.external.includes(href)) {
        allCSS.external.push(href);
      }
    } catch (e) {}
  });

  // Extract links for crawling
  const links = extractLinks($, baseUrl);
  return links;
}

async function downloadCSSFile(cssUrl, baseUrl, index) {
  try {
    const response = await axios.get(cssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 30000
    });

    const cssContent = response.data;
    const filename = path.basename(new URL(cssUrl).pathname) || `stylesheet_${index}.css`;
    
    allCSS.stylesheets.push({
      url: cssUrl,
      filename,
      content: cssContent,
      size: cssContent.length
    });

    console.log(`✔ Downloaded: ${filename}`);
    return true;
  } catch (err) {
    console.log(`❌ Failed to download: ${cssUrl}`);
    return false;
  }
}

async function scrapeWithPuppeteer(url) {
  console.log(`\n🌐 Using Puppeteer for advanced CSS extraction...\n`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Get all stylesheets
    const stylesheets = await page.evaluate(() => {
      const sheets = [];
      Array.from(document.styleSheets).forEach((sheet, index) => {
        try {
          if (sheet.href) {
            sheets.push({
              href: sheet.href,
              rules: sheet.cssRules ? Array.from(sheet.cssRules).length : 0
            });
          }
        } catch (e) {
          // Cross-origin stylesheet
        }
      });
      return sheets;
    });

    // Extract computed styles for common elements
    const computedStyles = await page.evaluate(() => {
      const styles = {};
      const selectors = ['body', 'h1', 'h2', 'h3', 'p', 'a', 'button', 'input', '.container', '#header', '#footer'];
      
      selectors.forEach(selector => {
        try {
          const element = document.querySelector(selector);
          if (element) {
            const computed = window.getComputedStyle(element);
            styles[selector] = {
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              fontSize: computed.fontSize,
              fontFamily: computed.fontFamily,
              fontWeight: computed.fontWeight,
              margin: computed.margin,
              padding: computed.padding,
              display: computed.display,
              width: computed.width,
              height: computed.height
            };
          }
        } catch (e) {}
      });
      
      return styles;
    });

    allCSS.computed = computedStyles;

    // Get all CSS from style tags
    const internalCSS = await page.evaluate(() => {
      const styles = [];
      document.querySelectorAll('style').forEach((style, index) => {
        if (style.textContent) {
          styles.push({
            index,
            css: style.textContent.trim()
          });
        }
      });
      return styles;
    });

    // Get inline styles
    const inlineStyles = await page.evaluate(() => {
      const styles = [];
      document.querySelectorAll('[style]').forEach((el, index) => {
        if (el.getAttribute('style')) {
          styles.push({
            selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + 
                     (el.className ? `.${el.className.split(' ')[0]}` : ''),
            style: el.getAttribute('style')
          });
        }
      });
      return styles;
    });

    // Update allCSS with puppeteer data
    allCSS.internal = internalCSS.map(s => ({ url, css: s.css }));
    allCSS.inline = inlineStyles.map(s => ({ url, selector: s.selector, styles: s.style }));

    await browser.close();
    return stylesheets;
  } catch (err) {
    console.log(`❌ Puppeteer error: ${err.message}`);
    await browser.close();
    return [];
  }
}

async function crawl(url, baseUrl, maxPages = 10) {
  const links = await extractCSSFromPage(url, baseUrl);
  
  if (links.length > 0 && VISITED.size < maxPages) {
    for (const link of links.slice(0, 5)) {
      if (VISITED.size >= maxPages) break;
      await crawl(link, baseUrl, maxPages);
    }
  }
}

async function main() {
  if (!BASE_URL) {
    console.log("❗ Usage: node scrape-css.js <website_url> [--keep]");
    console.log("");
    console.log("   Options:");
    console.log("     --keep    Keep old scraped data (don't delete)");
    console.log("");
    console.log("   Example: node scrape-css.js https://example.com");
    console.log("   Example: node scrape-css.js https://example.com --keep");
    process.exit(1);
  }

  await fs.ensureDir(OUTPUT_DIR);

  // Delete old data unless --keep flag is passed
  if (!KEEP_OLD_DATA) {
    console.log("🗑️ Deleting old scraped data...\n");
    await fs.emptyDir(OUTPUT_DIR);
  } else {
    console.log("📂 Keeping old data (--keep flag detected)\n");
  }

  console.log("🚀 CSS Scraper\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`🌐 Target URL: ${BASE_URL}\n`);

  const baseUrl = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

  // Crawl pages to extract CSS
  console.log("📄 Crawling pages for CSS...\n");
  await crawl(baseUrl, baseUrl, 10);

  // Use Puppeteer for advanced extraction
  const stylesheets = await scrapeWithPuppeteer(baseUrl);

  // Download external CSS files
  console.log(`\n⬇️ Downloading ${allCSS.external.length} external stylesheets...\n`);
  for (let i = 0; i < allCSS.external.length; i++) {
    await downloadCSSFile(allCSS.external[i], baseUrl, i);
  }

  // Compile all CSS data
  const cssData = {
    url: BASE_URL,
    scrapedAt: new Date().toISOString(),
    summary: {
      inlineStyles: allCSS.inline.length,
      internalStyles: allCSS.internal.length,
      externalStylesheets: allCSS.external.length,
      downloadedStylesheets: allCSS.stylesheets.length,
      computedStyles: Object.keys(allCSS.computed).length
    },
    inline: allCSS.inline,
    internal: allCSS.internal,
    external: allCSS.external,
    stylesheets: allCSS.stylesheets.map(s => ({
      url: s.url,
      filename: s.filename,
      size: s.size
    })),
    computed: allCSS.computed
  };

  // Save JSON data
  await fs.writeJSON(`${OUTPUT_DIR}/css-data.json`, cssData, { spaces: 2 });
  console.log(`\n📄 Saved: ${OUTPUT_DIR}/css-data.json`);

  // Save all CSS content to files
  await fs.ensureDir(`${OUTPUT_DIR}/stylesheets`);
  
  // Save downloaded stylesheets
  for (const sheet of allCSS.stylesheets) {
    await fs.writeFile(`${OUTPUT_DIR}/stylesheets/${sheet.filename}`, sheet.content);
  }

  // Save internal CSS
  if (allCSS.internal.length > 0) {
    let internalCSS = allCSS.internal.map((s, i) => 
      `/* Internal Style Tag #${i + 1} from ${s.url} */\n${s.css}\n`
    ).join('\n\n');
    await fs.writeFile(`${OUTPUT_DIR}/internal-styles.css`, internalCSS);
    console.log(`📄 Saved: ${OUTPUT_DIR}/internal-styles.css`);
  }

  // Save inline styles
  if (allCSS.inline.length > 0) {
    let inlineCSS = allCSS.inline.map((s, i) => 
      `/* Inline Style #${i + 1} - ${s.selector} from ${s.url} */\n${s.selector} {\n  ${s.styles.replace(/;/g, ';\n  ')}\n}\n`
    ).join('\n');
    await fs.writeFile(`${OUTPUT_DIR}/inline-styles.css`, inlineCSS);
    console.log(`📄 Saved: ${OUTPUT_DIR}/inline-styles.css`);
  }

  // Create comprehensive report
  let report = `
╔══════════════════════════════════════════════════════════════════╗
║                      CSS SCRAPER REPORT                           ║
╚══════════════════════════════════════════════════════════════════╝

URL: ${BASE_URL}
Scraped At: ${new Date().toISOString()}

════════════════════════════════════════════════════════════════════
                            SUMMARY
════════════════════════════════════════════════════════════════════

Inline Styles:        ${allCSS.inline.length}
Internal <style> Tags: ${allCSS.internal.length}
External Stylesheets:  ${allCSS.external.length}
Downloaded CSS Files:  ${allCSS.stylesheets.length}
Computed Styles:       ${Object.keys(allCSS.computed).length}

════════════════════════════════════════════════════════════════════
                        EXTERNAL STYLESHEETS
════════════════════════════════════════════════════════════════════

${allCSS.external.map((url, i) => `${i + 1}. ${url}`).join('\n') || 'None found'}

════════════════════════════════════════════════════════════════════
                         COMPUTED STYLES
════════════════════════════════════════════════════════════════════

${Object.entries(allCSS.computed).map(([selector, styles]) => 
  `${selector}:\n${Object.entries(styles).map(([prop, val]) => `  ${prop}: ${val}`).join('\n')}`
).join('\n\n') || 'None extracted'}

════════════════════════════════════════════════════════════════════
                        INTERNAL STYLES
════════════════════════════════════════════════════════════════════

${allCSS.internal.map((s, i) => `\n/* Style Tag #${i + 1} from ${s.url} */\n${s.css}`).join('\n\n') || 'None found'}

════════════════════════════════════════════════════════════════════
                         INLINE STYLES
════════════════════════════════════════════════════════════════════

${allCSS.inline.slice(0, 20).map((s, i) => `\n/* ${s.selector} from ${s.url} */\n${s.styles}`).join('\n\n') || 'None found'}
${allCSS.inline.length > 20 ? `\n... and ${allCSS.inline.length - 20} more inline styles` : ''}
`;

  await fs.writeFile(`${OUTPUT_DIR}/css-report.txt`, report);
  console.log(`📄 Saved: ${OUTPUT_DIR}/css-report.txt`);

  // Create ZIP archive
  console.log(`\n📦 Creating ZIP archive...`);
  
  const zip = new JSZip();
  const domain = new URL(BASE_URL).hostname.replace(/[^a-zA-Z0-9]/g, '_');
  
  // Add JSON data
  zip.file('css-data.json', JSON.stringify(cssData, null, 2));
  
  // Add text report
  zip.file('css-report.txt', report);
  
  // Add CSS files
  if (allCSS.internal.length > 0) {
    let internalCSS = allCSS.internal.map((s, i) => 
      `/* Internal Style Tag #${i + 1} from ${s.url} */\n${s.css}\n`
    ).join('\n\n');
    zip.file('internal-styles.css', internalCSS);
  }

  if (allCSS.inline.length > 0) {
    let inlineCSS = allCSS.inline.map((s, i) => 
      `/* Inline Style #${i + 1} - ${s.selector} from ${s.url} */\n${s.selector} {\n  ${s.styles.replace(/;/g, ';\n  ')}\n}\n`
    ).join('\n');
    zip.file('inline-styles.css', inlineCSS);
  }

  // Add downloaded stylesheets
  const stylesheetsFolder = zip.folder('stylesheets');
  for (const sheet of allCSS.stylesheets) {
    stylesheetsFolder.file(sheet.filename, sheet.content);
  }

  // Add all other files
  const files = await fs.readdir(OUTPUT_DIR);
  for (const file of files) {
    const filePath = path.join(OUTPUT_DIR, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isFile() && !file.endsWith('.zip') && !file.endsWith('.json') && !file.endsWith('.txt') && !file.endsWith('.css')) {
      const content = await fs.readFile(filePath);
      zip.file(file, content);
    }
  }
  
  // Generate and save ZIP
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const zipFileName = `${domain}_css_data.zip`;
  await fs.writeFile(`${OUTPUT_DIR}/${zipFileName}`, zipBuffer);
  console.log(`📦 Saved: ${OUTPUT_DIR}/${zipFileName}`);

  console.log(`\n🎉 Complete! All CSS data saved to ${OUTPUT_DIR}/`);
  console.log(`\n📊 Summary:`);
  console.log(`   • Inline Styles: ${allCSS.inline.length}`);
  console.log(`   • Internal Styles: ${allCSS.internal.length}`);
  console.log(`   • External Stylesheets: ${allCSS.external.length}`);
  console.log(`   • Downloaded CSS Files: ${allCSS.stylesheets.length}`);
  console.log(`   • ZIP Archive: ${zipFileName}`);
}

main().catch(console.error);
