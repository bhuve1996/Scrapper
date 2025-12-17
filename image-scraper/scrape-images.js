import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs-extra";
import JSZip from "jszip";
import fetch from "node-fetch";

const BASE_URL = process.argv[2]; // website passed as command
const OUTPUT_DIR = "./images";
const VISITED = new Set();
let imageList = [];

async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (e) {
    console.log("❌ Failed:", url);
    return null;
  }
}

function extractLinks($, baseUrl) {
  const links = [];
  $("a[href]").each((_, el) => {
    let href = $(el).attr("href");
    if (!href.startsWith("http")) href = baseUrl + href;
    if (href.startsWith(baseUrl)) links.push(href);
  });
  return links;
}

function extractImages($, baseUrl) {
  $("img").each((_, el) => {
    let src = $(el).attr("src");
    if (!src) return;

    if (!src.startsWith("http")) src = `${baseUrl}${src}`;
    if (!imageList.includes(src)) imageList.push(src);
  });
}

async function crawl(url, baseUrl) {
  if (VISITED.has(url)) return;
  VISITED.add(url);

  console.log("🔍 Crawling:", url);

  const html = await fetchHTML(url);
  if (!html) return;

  const $ = cheerio.load(html);
  extractImages($, baseUrl);

  const links = extractLinks($, baseUrl);
  for (const link of links) {
    await crawl(link, baseUrl);
  }
}

async function downloadImages() {
  await fs.ensureDir(OUTPUT_DIR);

  console.log(`\n📸 Downloading ${imageList.length} images...\n`);

  for (let i = 0; i < imageList.length; i++) {
    const imgUrl = imageList[i];

    try {
      const res = await fetch(imgUrl);
      const buffer = await res.buffer();

      const filename = imgUrl.split("/").pop().split("?")[0];
      const filepath = `${OUTPUT_DIR}/${filename}`;

      await fs.writeFile(filepath, buffer);

      console.log(`✔ Saved: ${filename}`);
    } catch (err) {
      console.log(`❌ Failed: ${imgUrl}`);
    }
  }
}

async function zipImages() {
  const zip = new JSZip();
  const files = await fs.readdir(OUTPUT_DIR);

  for (const file of files) {
    const content = await fs.readFile(`${OUTPUT_DIR}/${file}`);
    zip.file(file, content);
  }

  const zipContent = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile("./website-images.zip", zipContent);

  console.log("\n🎉 ZIP file created: website-images.zip");
}

async function main() {
  if (!BASE_URL) {
    console.log("❗ Usage: node scrape-images.js https://example.com");
    process.exit(1);
  }

  const root = BASE_URL.endsWith("/") ? BASE_URL : BASE_URL + "/";

  console.log("🚀 Starting Image Scraper for:", root);

  await crawl(root, root);
  await downloadImages();

  // Save JSON list
  await fs.writeJSON("./image-list.json", imageList, { spaces: 2 });
  console.log("\n📄 JSON saved: image-list.json");

  await zipImages();
}

main();

