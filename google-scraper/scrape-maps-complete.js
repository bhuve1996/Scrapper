import puppeteer from "puppeteer";
import fs from "fs-extra";
import JSZip from "jszip";
import path from "path";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const KEEP_OLD_DATA = args.includes('--keep');
const SEARCH_QUERY = args.filter(a => !a.startsWith('--'))[0];
const OUTPUT_DIR = "./maps-complete";

async function scrapeGoogleMapsComplete(query) {
  console.log(`🔍 Searching Google Maps for: "${query}"\n`);

  await fs.ensureDir(OUTPUT_DIR);
  
  // Delete old data unless --keep flag is passed
  if (!KEEP_OLD_DATA) {
    console.log("🗑️ Deleting old scraped data...\n");
    await fs.emptyDir(OUTPUT_DIR);
  } else {
    console.log("📂 Keeping old data (--keep flag detected)\n");
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.setViewport({ width: 1400, height: 900 });

  // Search on Google Maps
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Handle consent dialog
  try {
    const acceptButton = await page.$('button[aria-label*="Accept"]');
    if (acceptButton) {
      await acceptButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (e) {}

  await new Promise(resolve => setTimeout(resolve, 4000));

  // Click on the first result
  try {
    const firstResult = await page.$('a[href*="/maps/place/"]');
    if (firstResult) {
      await firstResult.click();
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } catch (err) {}

  // Save the current URL (Google Maps place URL)
  const placeUrl = page.url();

  // Extract coordinates from URL
  let coordinates = { latitude: null, longitude: null };
  
  // Try to extract from URL pattern: @lat,lng,zoom
  const urlMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (urlMatch) {
    coordinates.latitude = parseFloat(urlMatch[1]);
    coordinates.longitude = parseFloat(urlMatch[2]);
  }

  // Also try to get from the page if URL doesn't have it
  if (!coordinates.latitude) {
    const pageCoords = await page.evaluate(() => {
      // Try to find coordinates in page data
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent || '';
        // Look for coordinate patterns in script data
        const match = text.match(/\[(-?\d+\.\d+),(-?\d+\.\d+)\]/);
        if (match) {
          return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
        }
      }
      return null;
    });
    if (pageCoords) {
      coordinates = pageCoords;
    }
  }

  console.log("📋 Extracting ALL business information...\n");

  // Scroll down the info panel to load all content
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const panel = document.querySelector('div.m6QErb.DxyBCb');
      if (panel) panel.scrollTop = panel.scrollHeight;
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Extract comprehensive business info
  const businessInfo = await page.evaluate(() => {
    const data = {};
    
    // Basic Info
    data.name = document.querySelector('h1.DUwDvf, h1')?.textContent?.trim() || '';
    
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
    data.rating = ratingEl?.textContent?.trim() || '';
    
    const reviewCountEl = document.querySelector('span[aria-label*="reviews"]');
    data.reviewCount = reviewCountEl?.textContent?.match(/[\d,]+/)?.[0] || '0';
    
    data.category = document.querySelector('button[jsaction*="category"]')?.textContent?.trim() || '';
    
    // Price level
    const priceEl = document.querySelector('span[aria-label*="Price"]');
    data.priceLevel = priceEl?.textContent?.trim() || '';
    
    // Address
    data.address = document.querySelector('button[data-item-id="address"]')?.textContent?.trim() || '';
    
    // Phone
    data.phone = document.querySelector('button[data-item-id*="phone"]')?.textContent?.trim() || '';
    
    // Website
    const websiteEl = document.querySelector('a[data-item-id="authority"]');
    data.website = websiteEl?.href || '';
    
    // Plus Code
    data.plusCode = document.querySelector('button[data-item-id="oloc"]')?.textContent?.trim() || '';
    
    // Hours - extract full schedule
    const hoursButton = document.querySelector('div[aria-label*="Hours"], button[data-item-id*="hours"]');
    data.hoursLabel = hoursButton?.getAttribute('aria-label') || hoursButton?.textContent?.trim() || '';
    
    // Try to get expanded hours
    const hoursRows = document.querySelectorAll('table.eK4R0e tr');
    data.hoursDetailed = [];
    hoursRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const day = cells[0]?.textContent?.trim();
        const time = cells[1]?.textContent?.trim();
        if (day && time) {
          data.hoursDetailed.push({ day, time });
        }
      }
    });

    // Service Options
    data.serviceOptions = [];
    document.querySelectorAll('div[aria-label*="Service options"] span, div.LTs0Rc').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 2 && text.length < 50) {
        data.serviceOptions.push(text);
      }
    });

    // Highlights / Amenities
    data.highlights = [];
    document.querySelectorAll('div[aria-label*="Highlights"] span, div.RcCsl span').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 2) {
        data.highlights.push(text);
      }
    });

    // Accessibility
    data.accessibility = [];
    document.querySelectorAll('div[aria-label*="Accessibility"] span').forEach(el => {
      const text = el.textContent?.trim();
      if (text) data.accessibility.push(text);
    });

    // About / Description
    const aboutEl = document.querySelector('div[aria-label*="About"] p, div.WeS02d, div.PYvSYb');
    data.about = aboutEl?.textContent?.trim() || '';

    // Owner's description
    const ownerDescEl = document.querySelector('div.HlvSq');
    data.ownerDescription = ownerDescEl?.textContent?.trim() || '';

    // Get all data items
    data.allDataItems = {};
    document.querySelectorAll('button[data-item-id], div[data-item-id], a[data-item-id]').forEach(el => {
      const id = el.getAttribute('data-item-id');
      const text = el.textContent?.trim();
      if (id && text && !id.includes('action')) {
        data.allDataItems[id] = text;
      }
    });

    return data;
  });

  // Add coordinates to business info
  businessInfo.coordinates = coordinates;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Name: ${businessInfo.name}`);
  console.log(`⭐ Rating: ${businessInfo.rating} (${businessInfo.reviewCount} reviews)`);
  console.log(`📂 Category: ${businessInfo.category}`);
  console.log(`📫 Address: ${businessInfo.address}`);
  console.log(`📞 Phone: ${businessInfo.phone}`);
  console.log(`🌐 Website: ${businessInfo.website}`);
  console.log(`🔗 Plus Code: ${businessInfo.plusCode}`);
  console.log(`🕐 Hours: ${businessInfo.hoursLabel}`);
  console.log(`📍 Coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Save listing screenshot
  await page.screenshot({ path: `${OUTPUT_DIR}/listing-main.png`, fullPage: false });

  // Click on About/Overview tab
  try {
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('button[role="tab"]');
      for (const tab of tabs) {
        if (tab.textContent.toLowerCase().includes('about') || 
            tab.textContent.toLowerCase().includes('overview')) {
          tab.click();
          break;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const aboutInfo = await page.evaluate(() => {
      const info = {};
      document.querySelectorAll('div.iP2t7d, div[class*="section"]').forEach(section => {
        const heading = section.querySelector('h2, h3, div.fontTitleSmall')?.textContent?.trim();
        if (heading) {
          const items = [];
          section.querySelectorAll('li, span.RcCsl, div.hpLkke span').forEach(item => {
            const text = item.textContent?.trim();
            if (text && text.length > 1 && text.length < 100) {
              items.push(text);
            }
          });
          if (items.length > 0) {
            info[heading] = items;
          }
        }
      });
      return info;
    });
    
    businessInfo.aboutSections = aboutInfo;
    await page.screenshot({ path: `${OUTPUT_DIR}/listing-about.png`, fullPage: false });
  } catch (e) {}

  // Extract Photos
  console.log("🖼️ Extracting photos...\n");
  
  let photoUrls = [];
  
  try {
    const photoButton = await page.$('button[aria-label*="photo" i], div.RZ66Rb, img.Xo3Jjf');
    if (photoButton) {
      await photoButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (e) {}

  const photoCategories = await page.evaluate(() => {
    const cats = [];
    document.querySelectorAll('button[data-tab-index]').forEach(btn => {
      const text = btn.textContent?.trim();
      if (text && !text.includes('Review')) {
        cats.push(text);
      }
    });
    return cats;
  });

  // Scroll through photos
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      const containers = document.querySelectorAll('div[role="img"], div.m6QErb, div[aria-label*="Photo"]');
      containers.forEach(c => {
        c.scrollTop = c.scrollHeight;
        c.scrollLeft = c.scrollWidth;
      });
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  photoUrls = await page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('img, div[style*="background-image"]').forEach(el => {
      let src = el.src || '';
      const bgMatch = el.style?.backgroundImage?.match(/url\(["']?(.*?)["']?\)/);
      if (bgMatch) src = bgMatch[1];
      
      if (src && src.includes('googleusercontent.com') && !src.includes('=s32') && !src.includes('=s36') && !src.includes('=s40')) {
        const largeUrl = src.replace(/=s\d+/, '=s1600').replace(/=w\d+-h\d+/, '=w1600-h1200');
        urls.add(largeUrl);
      }
    });
    return Array.from(urls);
  });

  console.log(`📸 Found ${photoUrls.length} photos in categories: ${photoCategories.join(', ') || 'All'}\n`);

  // Download photos
  let downloadedPhotos = 0;
  if (photoUrls.length > 0) {
    console.log("⬇️ Downloading photos...\n");
    
    for (let i = 0; i < Math.min(photoUrls.length, 30); i++) {
      try {
        const response = await page.goto(photoUrls[i], { timeout: 15000 });
        const buffer = await response.buffer();
        
        const contentType = response.headers()['content-type'] || '';
        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        
        await fs.writeFile(`${OUTPUT_DIR}/photo_${i + 1}.${ext}`, buffer);
        downloadedPhotos++;
        console.log(`✔ Downloaded: photo_${i + 1}.${ext}`);
      } catch (err) {}
    }
  }

  // Go back to listing for reviews
  await page.goto(placeUrl, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Extract Reviews
  console.log("\n📝 Extracting reviews...\n");
  
  try {
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('button[role="tab"]');
      for (const tab of tabs) {
        if (tab.textContent.toLowerCase().includes('review')) {
          tab.click();
          break;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (e) {}

  const reviewSummary = await page.evaluate(() => {
    const summary = {};
    summary.ratingBreakdown = {};
    summary.topics = [];
    document.querySelectorAll('button.e2moi').forEach(btn => {
      const text = btn.textContent?.trim();
      if (text && text.length > 2 && text.length < 50 && !text.includes('Like') && !text.includes('Share')) {
        summary.topics.push(text);
      }
    });
    return summary;
  });

  // Scroll to load all reviews
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      const scrollable = document.querySelector('div.m6QErb.DxyBCb');
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Expand all review texts
  try {
    await page.evaluate(() => {
      document.querySelectorAll('button.w8nwRe, span.w8nwRe').forEach(btn => btn.click());
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (e) {}

  const reviews = await page.evaluate(() => {
    const reviewEls = document.querySelectorAll('div[data-review-id], div.jftiEf');
    const extracted = [];
    
    for (const el of reviewEls) {
      try {
        const review = {};
        review.author = el.querySelector('div.d4r55, a[href*="/contrib/"]')?.textContent?.trim() || '';
        review.authorUrl = el.querySelector('a[href*="/contrib/"]')?.href || '';
        review.authorInfo = el.querySelector('div.RfnDt, span.A503be')?.textContent?.trim() || '';
        
        const ratingEl = el.querySelector('span[role="img"]');
        review.rating = ratingEl?.getAttribute('aria-label') || '';
        review.date = el.querySelector('span.rsqaWe')?.textContent?.trim() || '';
        review.text = el.querySelector('span.wiI7pd')?.textContent?.trim() || '';
        
        const likesEl = el.querySelector('span.pkWtMe');
        review.likes = likesEl?.textContent?.trim() || '0';
        
        const responseEl = el.querySelector('div.CDe7pd');
        if (responseEl) {
          review.ownerResponse = {
            text: responseEl.querySelector('span.wiI7pd')?.textContent?.trim() || '',
            date: responseEl.querySelector('span.rsqaWe')?.textContent?.trim() || ''
          };
        }
        
        review.photos = [];
        el.querySelectorAll('button[data-photo-index] img').forEach(img => {
          if (img.src && img.src.includes('googleusercontent')) {
            review.photos.push(img.src.replace(/=s\d+/, '=s800'));
          }
        });
        
        if (review.author || review.text) {
          extracted.push(review);
        }
      } catch (e) {}
    }
    
    return extracted;
  });

  const uniqueReviews = reviews.filter((review, index, self) =>
    index === self.findIndex((r) => r.author === review.author && r.text === review.text)
  );

  console.log(`📝 Extracted ${uniqueReviews.length} reviews\n`);

  await browser.close();

  return {
    placeUrl,
    businessInfo,
    photoCategories,
    photoUrls,
    downloadedPhotos,
    reviewSummary,
    reviews: uniqueReviews
  };
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
  if (!SEARCH_QUERY) {
    console.log("❗ Usage: node scrape-maps-complete.js \"business name and address\" [--keep]");
    console.log("");
    console.log("   Options:");
    console.log("     --keep    Keep old scraped data (don't delete)");
    console.log("");
    console.log("   Example: node scrape-maps-complete.js \"Starbucks Times Square NYC\"");
    console.log("   Example: node scrape-maps-complete.js \"Coffee Shop\" --keep");
    process.exit(1);
  }

  // Check and install dependencies if needed
  await checkAndInstallDependencies();

  console.log("🚀 Google Maps COMPLETE Data Scraper\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const data = await scrapeGoogleMapsComplete(SEARCH_QUERY);

  // Compile complete output
  const output = {
    query: SEARCH_QUERY,
    scrapedAt: new Date().toISOString(),
    googleMapsUrl: data.placeUrl,
    
    business: {
      ...data.businessInfo,
    },
    
    location: {
      address: data.businessInfo.address,
      plusCode: data.businessInfo.plusCode,
      coordinates: data.businessInfo.coordinates,
      googleMapsUrl: data.placeUrl
    },
    
    photos: {
      categories: data.photoCategories,
      totalFound: data.photoUrls.length,
      downloaded: data.downloadedPhotos,
      urls: data.photoUrls
    },
    
    reviews: {
      summary: data.reviewSummary,
      totalExtracted: data.reviews.length,
      items: data.reviews
    }
  };

  // Save JSON
  await fs.writeJSON(`${OUTPUT_DIR}/complete-data.json`, output, { spaces: 2 });
  console.log(`📄 Saved: ${OUTPUT_DIR}/complete-data.json`);

  // Create comprehensive text report
  const coords = data.businessInfo.coordinates;
  let report = `
╔══════════════════════════════════════════════════════════════════╗
║           GOOGLE MAPS COMPLETE BUSINESS DATA                      ║
╚══════════════════════════════════════════════════════════════════╝

Search Query: ${SEARCH_QUERY}
Scraped At: ${new Date().toISOString()}
Google Maps URL: ${data.placeUrl}

════════════════════════════════════════════════════════════════════
                        BUSINESS INFORMATION
════════════════════════════════════════════════════════════════════

Name:           ${data.businessInfo.name}
Rating:         ${data.businessInfo.rating} ⭐ (${data.businessInfo.reviewCount} reviews)
Category:       ${data.businessInfo.category}
Price Level:    ${data.businessInfo.priceLevel || 'Not specified'}

📍 LOCATION
Address:        ${data.businessInfo.address}
Plus Code:      ${data.businessInfo.plusCode}
Latitude:       ${coords.latitude || 'Not available'}
Longitude:      ${coords.longitude || 'Not available'}
Google Maps:    ${data.placeUrl}

📞 CONTACT
Phone:          ${data.businessInfo.phone}
Website:        ${data.businessInfo.website}

🕐 HOURS
${data.businessInfo.hoursLabel}
${data.businessInfo.hoursDetailed?.map(h => `   ${h.day}: ${h.time}`).join('\n') || ''}

📝 ABOUT
${data.businessInfo.about || data.businessInfo.ownerDescription || 'No description available'}

🏷️ SERVICE OPTIONS
${data.businessInfo.serviceOptions?.join(', ') || 'None listed'}

✨ HIGHLIGHTS
${data.businessInfo.highlights?.join(', ') || 'None listed'}

♿ ACCESSIBILITY
${data.businessInfo.accessibility?.join(', ') || 'None listed'}

📋 ADDITIONAL DATA
${Object.entries(data.businessInfo.allDataItems || {}).map(([k, v]) => `   ${k}: ${v}`).join('\n') || 'None'}

════════════════════════════════════════════════════════════════════
                             PHOTOS
════════════════════════════════════════════════════════════════════

Categories: ${data.photoCategories?.join(', ') || 'All'}
Total Found: ${data.photoUrls.length}
Downloaded: ${data.downloadedPhotos}

════════════════════════════════════════════════════════════════════
                            REVIEWS
════════════════════════════════════════════════════════════════════

Total Reviews: ${data.reviews.length}

Popular Topics: ${data.reviewSummary.topics?.join(', ') || 'None'}

────────────────────────────────────────────────────────────────────
`;

  data.reviews.forEach((review, i) => {
    report += `
Review #${i + 1}
Author:     ${review.author}
Info:       ${review.authorInfo}
Rating:     ${review.rating}
Date:       ${review.date}
Likes:      ${review.likes}

${review.text}
${review.photos?.length ? `\nPhotos: ${review.photos.length} attached` : ''}
${review.ownerResponse ? `\n💬 Owner Response (${review.ownerResponse.date}):\n${review.ownerResponse.text}` : ''}
────────────────────────────────────────────────────────────────────
`;
  });

  await fs.writeFile(`${OUTPUT_DIR}/complete-report.txt`, report);
  console.log(`📄 Saved: ${OUTPUT_DIR}/complete-report.txt`);

  // Create ZIP file with all data
  console.log(`\n📦 Creating ZIP archive...`);
  
  const zip = new JSZip();
  const businessName = data.businessInfo.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) || 'business';
  
  // Add JSON file
  zip.file('complete-data.json', JSON.stringify(output, null, 2));
  
  // Add text report
  zip.file('complete-report.txt', report);
  
  // Add all files from output directory
  const files = await fs.readdir(OUTPUT_DIR);
  for (const file of files) {
    const filePath = path.join(OUTPUT_DIR, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isFile() && !file.endsWith('.zip')) {
      const content = await fs.readFile(filePath);
      zip.file(file, content);
    }
  }
  
  // Generate and save ZIP
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const zipFileName = `${businessName}_google_maps_data.zip`;
  await fs.writeFile(`${OUTPUT_DIR}/${zipFileName}`, zipBuffer);
  console.log(`📦 Saved: ${OUTPUT_DIR}/${zipFileName}`);

  console.log(`\n🎉 Complete! All data saved to ${OUTPUT_DIR}/`);
  console.log(`\n📊 Summary:`);
  console.log(`   • Business Info: ✓`);
  console.log(`   • Coordinates: ${coords.latitude}, ${coords.longitude}`);
  console.log(`   • Photos: ${data.downloadedPhotos} downloaded`);
  console.log(`   • Reviews: ${data.reviews.length} extracted`);
  console.log(`   • ZIP Archive: ${zipFileName}`);
}

main().catch(console.error);
