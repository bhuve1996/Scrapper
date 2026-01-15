import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import JSZip from "jszip";
import sanitizeHtml from "sanitize-html";
import path from "path";
import { execSync } from "child_process";

const BASE_URL = process.argv[2];
const visited = new Set();
let pageText = {};
let allText = new Set();

async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    return data;
  } catch {
    return null;
  }
}

function cleanText(str) {
  return sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

function extractText($) {
  const elements = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "li", "span", "strong", "em", "blockquote"
  ];

  let textChunks = [];

  elements.forEach(tag => {
    $(tag).each((_, el) => {
      const text = cleanText($(el).text());
      if (text && text.length > 4) {
        textChunks.push(text);
      }
    });
  });

  return textChunks;
}

function extractLinks($, base) {
  let links = [];
  $("a[href]").each((_, el) => {
    let href = $(el).attr("href");
    if (!href) return;

    if (href.startsWith("#")) return;
    if (!href.startsWith("http")) href = base + (href.startsWith("/") ? href : "/" + href);

    if (href.startsWith(base)) links.push(href);
  });
  return links;
}

async function crawl(url, base) {
  if (visited.has(url)) return;
  visited.add(url);

  console.log("🔍 Crawling:", url);

  const html = await fetchHTML(url);
  if (!html) return;

  const $ = cheerio.load(html);

  // Extract text
  const extracted = extractText($);
  const filtered = extracted.filter(
    t => !t.toLowerCase().includes("copyright")
  );

  pageText[url] = filtered;

  filtered.forEach(t => allText.add(t));

  // Extract links
  const links = extractLinks($, base);
  for (const link of links) {
    await crawl(link, base);
  }
}

async function saveResults() {
  await fs.ensureDir("./output");

  await fs.writeJSON("./output/page-text.json", pageText, { spaces: 2 });
  await fs.writeJSON("./output/all-text.json", [...allText], { spaces: 2 });

  // zip everything
  const zip = new JSZip();
  zip.file("page-text.json", JSON.stringify(pageText, null, 2));
  zip.file("all-text.json", JSON.stringify([...allText], null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile("./output/website-text.zip", buffer);

  console.log("\n📦 Created: output/website-text.zip");
}

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

async function main() {
  if (!BASE_URL) {
    console.log("❗ Usage: node scrape-text.js https://example.com");
    process.exit(1);
  }

  // Check and install dependencies if needed
  await checkAndInstallDependencies();

  const root = BASE_URL.endsWith("/") ? BASE_URL : BASE_URL + "/";

  console.log("🚀 Starting text extractor for:", root);

  await crawl(root, root);
  await saveResults();

  console.log("🎉 Finished!");
}

main();


