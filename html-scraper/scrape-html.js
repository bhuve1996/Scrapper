import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import JSZip from "jszip";
import path from "path";

const args = process.argv.slice(2);
const KEEP_OLD_DATA = args.includes('--keep');
const BASE_URL = args.filter(a => !a.startsWith('--'))[0];
const OUTPUT_DIR = "./html-output";
const VISITED = new Set();
let allHTML = {
  pages: [],
  structure: {},
  elements: {},
  metadata: []
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

async function extractHTMLFromPage(url, baseUrl) {
  if (VISITED.has(url)) return;
  VISITED.add(url);

  console.log(`🔍 Scraping HTML from: ${url}`);

  const html = await fetchHTML(url);
  if (!html) return;

  const $ = cheerio.load(html);

  // Extract page metadata
  const metadata = {
    url,
    title: $("title").text().trim(),
    description: $('meta[name="description"]').attr("content") || "",
    keywords: $('meta[name="keywords"]').attr("content") || "",
    author: $('meta[name="author"]').attr("content") || "",
    ogTitle: $('meta[property="og:title"]').attr("content") || "",
    ogDescription: $('meta[property="og:description"]').attr("content") || "",
    ogImage: $('meta[property="og:image"]').attr("content") || "",
    canonical: $('link[rel="canonical"]').attr("href") || "",
    lang: $("html").attr("lang") || "",
    charset: $('meta[charset]').attr("charset") || ""
  };

  // Extract structure
  const structure = {
    headings: {
      h1: $("h1").length,
      h2: $("h2").length,
      h3: $("h3").length,
      h4: $("h4").length,
      h5: $("h5").length,
      h6: $("h6").length
    },
    links: $("a").length,
    images: $("img").length,
    forms: $("form").length,
    tables: $("table").length,
    lists: $("ul, ol").length,
    scripts: $("script").length,
    stylesheets: $("link[rel='stylesheet']").length
  };

  // Extract specific elements
  const elements = {
    headings: [],
    links: [],
    images: [],
    forms: [],
    tables: []
  };

  // Extract headings with text
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      elements.headings.push({
        tag: el.name,
        text: text.substring(0, 200),
        id: $(el).attr("id") || "",
        class: $(el).attr("class") || ""
      });
    }
  });

  // Extract links
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (href && text) {
      elements.links.push({
        text: text.substring(0, 100),
        href: href,
        title: $(el).attr("title") || ""
      });
    }
  });

  // Extract images
  $("img").each((_, el) => {
    elements.images.push({
      src: $(el).attr("src") || "",
      alt: $(el).attr("alt") || "",
      title: $(el).attr("title") || "",
      width: $(el).attr("width") || "",
      height: $(el).attr("height") || ""
    });
  });

  // Extract forms
  $("form").each((_, el) => {
    const form = {
      action: $(el).attr("action") || "",
      method: $(el).attr("method") || "get",
      inputs: []
    };
    
    $(el).find("input, textarea, select").each((_, input) => {
      form.inputs.push({
        type: $(input).attr("type") || input.name,
        name: $(input).attr("name") || "",
        id: $(input).attr("id") || "",
        placeholder: $(input).attr("placeholder") || "",
        required: $(input).attr("required") ? true : false
      });
    });
    
    elements.forms.push(form);
  });

  // Extract tables
  $("table").each((_, el) => {
    const table = {
      rows: $("tr", el).length,
      headers: []
    };
    
    $("th", el).each((_, th) => {
      table.headers.push($(th).text().trim());
    });
    
    elements.tables.push(table);
  });

  // Save full HTML
  allHTML.pages.push({
    url,
    metadata,
    structure,
    elements,
    html: html
  });

  allHTML.metadata.push(metadata);

  // Extract links for crawling
  const links = extractLinks($, baseUrl);
  return links;
}

async function scrapeWithPuppeteer(url) {
  console.log(`\n🌐 Using Puppeteer for advanced HTML extraction...\n`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Get rendered HTML
    const renderedHTML = await page.content();

    // Get page dimensions
    const dimensions = await page.evaluate(() => {
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });

    // Get all text content
    const textContent = await page.evaluate(() => {
      return document.body.innerText || "";
    });

    // Get DOM structure
    const domStructure = await page.evaluate(() => {
      const getElementInfo = (el) => {
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || "",
          class: el.className || "",
          children: Array.from(el.children).map(child => getElementInfo(child))
        };
      };
      return getElementInfo(document.body);
    });

    // Get performance metrics
    const performance = await page.evaluate(() => {
      const perf = window.performance;
      if (perf && perf.timing) {
        return {
          loadTime: perf.timing.loadEventEnd - perf.timing.navigationStart,
          domContentLoaded: perf.timing.domContentLoadedEventEnd - perf.timing.navigationStart,
          firstPaint: perf.timing.responseStart - perf.timing.navigationStart
        };
      }
      return null;
    });

    await browser.close();

    return {
      renderedHTML,
      dimensions,
      textContent: textContent.substring(0, 10000), // Limit size
      domStructure,
      performance
    };
  } catch (err) {
    console.log(`❌ Puppeteer error: ${err.message}`);
    await browser.close();
    return null;
  }
}

async function crawl(url, baseUrl, maxPages = 10) {
  const links = await extractHTMLFromPage(url, baseUrl);
  
  if (links.length > 0 && VISITED.size < maxPages) {
    for (const link of links.slice(0, 5)) {
      if (VISITED.size >= maxPages) break;
      await crawl(link, baseUrl, maxPages);
    }
  }
}

async function main() {
  if (!BASE_URL) {
    console.log("❗ Usage: node scrape-html.js <website_url> [--keep]");
    console.log("");
    console.log("   Options:");
    console.log("     --keep    Keep old scraped data (don't delete)");
    console.log("");
    console.log("   Example: node scrape-html.js https://example.com");
    console.log("   Example: node scrape-html.js https://example.com --keep");
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

  console.log("🚀 HTML Scraper\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`🌐 Target URL: ${BASE_URL}\n`);

  const baseUrl = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

  // Crawl pages to extract HTML
  console.log("📄 Crawling pages for HTML...\n");
  await crawl(baseUrl, baseUrl, 10);

  // Use Puppeteer for advanced extraction
  const puppeteerData = await scrapeWithPuppeteer(baseUrl);

  // Compile all HTML data
  const htmlData = {
    url: BASE_URL,
    scrapedAt: new Date().toISOString(),
    summary: {
      pagesScraped: allHTML.pages.length,
      totalHeadings: allHTML.pages.reduce((sum, p) => sum + Object.values(p.structure.headings).reduce((a, b) => a + b, 0), 0),
      totalLinks: allHTML.pages.reduce((sum, p) => sum + p.structure.links, 0),
      totalImages: allHTML.pages.reduce((sum, p) => sum + p.structure.images, 0),
      totalForms: allHTML.pages.reduce((sum, p) => sum + p.structure.forms, 0),
      totalTables: allHTML.pages.reduce((sum, p) => sum + p.structure.tables, 0)
    },
    pages: allHTML.pages.map(p => ({
      url: p.url,
      metadata: p.metadata,
      structure: p.structure,
      elements: p.elements
    })),
    puppeteer: puppeteerData
  };

  // Save JSON data
  await fs.writeJSON(`${OUTPUT_DIR}/html-data.json`, htmlData, { spaces: 2 });
  console.log(`\n📄 Saved: ${OUTPUT_DIR}/html-data.json`);

  // Save individual HTML files
  await fs.ensureDir(`${OUTPUT_DIR}/pages`);
  
  for (const page of allHTML.pages) {
    const filename = page.url
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 100) + '.html';
    
    await fs.writeFile(`${OUTPUT_DIR}/pages/${filename}`, page.html);
  }
  console.log(`📄 Saved ${allHTML.pages.length} HTML files to ${OUTPUT_DIR}/pages/`);

  // Save rendered HTML from Puppeteer
  if (puppeteerData && puppeteerData.renderedHTML) {
    await fs.writeFile(`${OUTPUT_DIR}/rendered-html.html`, puppeteerData.renderedHTML);
    console.log(`📄 Saved: ${OUTPUT_DIR}/rendered-html.html`);
  }

  // Save text content
  if (puppeteerData && puppeteerData.textContent) {
    await fs.writeFile(`${OUTPUT_DIR}/text-content.txt`, puppeteerData.textContent);
    console.log(`📄 Saved: ${OUTPUT_DIR}/text-content.txt`);
  }

  // Create comprehensive report
  let report = `
╔══════════════════════════════════════════════════════════════════╗
║                      HTML SCRAPER REPORT                          ║
╚══════════════════════════════════════════════════════════════════╝

URL: ${BASE_URL}
Scraped At: ${new Date().toISOString()}

════════════════════════════════════════════════════════════════════
                            SUMMARY
════════════════════════════════════════════════════════════════════

Pages Scraped:        ${htmlData.summary.pagesScraped}
Total Headings:       ${htmlData.summary.totalHeadings}
Total Links:           ${htmlData.summary.totalLinks}
Total Images:          ${htmlData.summary.totalImages}
Total Forms:           ${htmlData.summary.totalForms}
Total Tables:          ${htmlData.summary.totalTables}

════════════════════════════════════════════════════════════════════
                        PAGE METADATA
════════════════════════════════════════════════════════════════════

${allHTML.metadata.map((meta, i) => `
Page #${i + 1}: ${meta.url}
  Title: ${meta.title}
  Description: ${meta.description || 'N/A'}
  Language: ${meta.lang || 'N/A'}
  Canonical: ${meta.canonical || 'N/A'}
`).join('\n')}

════════════════════════════════════════════════════════════════════
                      PAGE STRUCTURE
════════════════════════════════════════════════════════════════════

${allHTML.pages.map((page, i) => `
Page #${i + 1}: ${page.url}
  Headings: H1(${page.structure.h1}) H2(${page.structure.h2}) H3(${page.structure.h3})
  Links: ${page.structure.links}
  Images: ${page.structure.images}
  Forms: ${page.structure.forms}
  Tables: ${page.structure.tables}
  Scripts: ${page.structure.scripts}
  Stylesheets: ${page.structure.stylesheets}
`).join('\n')}

${puppeteerData && puppeteerData.dimensions ? `
════════════════════════════════════════════════════════════════════
                      PAGE DIMENSIONS
════════════════════════════════════════════════════════════════════

Document Size: ${puppeteerData.dimensions.width} x ${puppeteerData.dimensions.height}px
Viewport Size: ${puppeteerData.dimensions.viewport.width} x ${puppeteerData.dimensions.viewport.height}px
` : ''}

${puppeteerData && puppeteerData.performance ? `
════════════════════════════════════════════════════════════════════
                      PERFORMANCE METRICS
════════════════════════════════════════════════════════════════════

Load Time: ${puppeteerData.performance.loadTime}ms
DOM Content Loaded: ${puppeteerData.performance.domContentLoaded}ms
First Paint: ${puppeteerData.performance.firstPaint}ms
` : ''}
`;

  await fs.writeFile(`${OUTPUT_DIR}/html-report.txt`, report);
  console.log(`📄 Saved: ${OUTPUT_DIR}/html-report.txt`);

  // Create ZIP archive
  console.log(`\n📦 Creating ZIP archive...`);
  
  const zip = new JSZip();
  const domain = new URL(BASE_URL).hostname.replace(/[^a-zA-Z0-9]/g, '_');
  
  // Add JSON data
  zip.file('html-data.json', JSON.stringify(htmlData, null, 2));
  
  // Add text report
  zip.file('html-report.txt', report);
  
  // Add rendered HTML
  if (puppeteerData && puppeteerData.renderedHTML) {
    zip.file('rendered-html.html', puppeteerData.renderedHTML);
  }

  // Add text content
  if (puppeteerData && puppeteerData.textContent) {
    zip.file('text-content.txt', puppeteerData.textContent);
  }

  // Add all HTML pages
  const pagesFolder = zip.folder('pages');
  for (const page of allHTML.pages) {
    const filename = page.url
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 100) + '.html';
    pagesFolder.file(filename, page.html);
  }

  // Add all other files
  const files = await fs.readdir(OUTPUT_DIR);
  for (const file of files) {
    const filePath = path.join(OUTPUT_DIR, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isFile() && !file.endsWith('.zip') && !file.endsWith('.json') && !file.endsWith('.txt') && !file.endsWith('.html')) {
      const content = await fs.readFile(filePath);
      zip.file(file, content);
    }
  }
  
  // Generate and save ZIP
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const zipFileName = `${domain}_html_data.zip`;
  await fs.writeFile(`${OUTPUT_DIR}/${zipFileName}`, zipBuffer);
  console.log(`📦 Saved: ${OUTPUT_DIR}/${zipFileName}`);

  console.log(`\n🎉 Complete! All HTML data saved to ${OUTPUT_DIR}/`);
  console.log(`\n📊 Summary:`);
  console.log(`   • Pages Scraped: ${htmlData.summary.pagesScraped}`);
  console.log(`   • Total Headings: ${htmlData.summary.totalHeadings}`);
  console.log(`   • Total Links: ${htmlData.summary.totalLinks}`);
  console.log(`   • Total Images: ${htmlData.summary.totalImages}`);
  console.log(`   • ZIP Archive: ${zipFileName}`);
}

main().catch(console.error);
