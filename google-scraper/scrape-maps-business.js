import puppeteer from "puppeteer";
import fs from "fs-extra";

const SEARCH_QUERY = process.argv[2];
const OUTPUT_DIR = "./maps-business";

async function scrapeGoogleMapsBusiness(query) {
  console.log(`🔍 Searching Google Maps for: "${query}"\n`);

  await fs.ensureDir(OUTPUT_DIR);
  await fs.emptyDir(OUTPUT_DIR);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.setViewport({ width: 1280, height: 900 });

  // Search on Google Maps
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Handle consent dialog if present
  try {
    const acceptButton = await page.$('button[aria-label*="Accept"], form[action*="consent"] button');
    if (acceptButton) {
      await acceptButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (e) {}

  await new Promise(resolve => setTimeout(resolve, 4000));

  // Click on the first result if it's a list
  try {
    const firstResult = await page.$('div[role="feed"] > div:first-child a, a[href*="/maps/place/"]');
    if (firstResult) {
      console.log("📍 Clicking on business listing...");
      await firstResult.click();
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  } catch (err) {}

  // Extract business info
  console.log("📋 Extracting business information...\n");
  
  const businessInfo = await page.evaluate(() => {
    const name = document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge, h1')?.textContent || '';
    
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"], span.ceNzKf');
    const rating = ratingEl?.textContent || '';
    
    const reviewCountEl = document.querySelector('span[aria-label*="reviews"]');
    const reviewCount = reviewCountEl?.getAttribute('aria-label')?.match(/\d+/)?.[0] || 
                       reviewCountEl?.textContent?.match(/\d+/)?.[0] || '0';
    
    const address = document.querySelector('button[data-item-id="address"]')?.textContent || 
                   document.querySelector('div[data-item-id="address"]')?.textContent || '';
    
    const phone = document.querySelector('button[data-item-id*="phone"]')?.textContent || 
                 document.querySelector('div[data-item-id*="phone"]')?.textContent || '';
    
    const websiteEl = document.querySelector('a[data-item-id="authority"]');
    const website = websiteEl?.href || '';
    
    const category = document.querySelector('button[jsaction*="category"]')?.textContent || 
                    document.querySelector('span.DkEaL')?.textContent || '';
    
    // Hours
    const hoursEl = document.querySelector('div[aria-label*="Hours"], button[data-item-id*="hours"]');
    const hours = hoursEl?.getAttribute('aria-label') || hoursEl?.textContent || '';
    
    // Plus code
    const plusCode = document.querySelector('button[data-item-id="oloc"]')?.textContent || '';
    
    return { name, rating, reviewCount, address, phone, website, category, hours, plusCode };
  });

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Business: ${businessInfo.name}`);
  console.log(`⭐ Rating: ${businessInfo.rating} (${businessInfo.reviewCount} reviews)`);
  console.log(`📂 Category: ${businessInfo.category}`);
  console.log(`📫 Address: ${businessInfo.address}`);
  console.log(`📞 Phone: ${businessInfo.phone}`);
  console.log(`🌐 Website: ${businessInfo.website}`);
  console.log(`🕐 Hours: ${businessInfo.hours}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Save screenshot of the listing
  await page.screenshot({ path: `${OUTPUT_DIR}/listing-screenshot.png`, fullPage: false });
  console.log("📸 Saved listing screenshot\n");

  // Click on photos to open photo gallery
  console.log("🖼️ Extracting photos from Google Maps...\n");
  
  let photoUrls = [];
  
  try {
    // Try clicking on the main photo or photos button
    const photoButton = await page.$('button[aria-label*="Photo"], button[aria-label*="photo"], div.RZ66Rb img, img.Xo3Jjf');
    if (photoButton) {
      await photoButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (e) {}

  // Try clicking "See all photos" or similar
  try {
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a');
      for (const btn of buttons) {
        if (btn.textContent.toLowerCase().includes('photo') || 
            btn.textContent.toLowerCase().includes('see all')) {
          btn.click();
          break;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (e) {}

  // Extract photo URLs from the gallery
  photoUrls = await page.evaluate(() => {
    const urls = new Set();
    
    // Get all images on the page
    document.querySelectorAll('img').forEach(img => {
      const src = img.src;
      if (src && src.includes('googleusercontent.com') && !src.includes('=s32') && !src.includes('=s36')) {
        // Get larger version of the image
        let largeUrl = src;
        if (src.includes('=')) {
          largeUrl = src.replace(/=s\d+/, '=s1200').replace(/=w\d+-h\d+/, '=w1200-h900');
        }
        urls.add(largeUrl);
      }
    });
    
    // Also check background images
    document.querySelectorAll('[style*="background-image"]').forEach(el => {
      const style = el.style.backgroundImage;
      const match = style.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1] && match[1].includes('googleusercontent.com')) {
        let largeUrl = match[1];
        if (largeUrl.includes('=')) {
          largeUrl = largeUrl.replace(/=s\d+/, '=s1200').replace(/=w\d+-h\d+/, '=w1200-h900');
        }
        urls.add(largeUrl);
      }
    });
    
    return Array.from(urls);
  });

  // If we didn't find photos in gallery, try scrolling through the images panel
  if (photoUrls.length < 3) {
    console.log("📜 Scrolling through photo panel...");
    
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const panels = document.querySelectorAll('div[role="img"], div.m6QErb, div[aria-label*="Photo"]');
        panels.forEach(panel => {
          panel.scrollTop = panel.scrollHeight;
          panel.scrollLeft = panel.scrollWidth;
        });
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const morePhotos = await page.evaluate(() => {
        const urls = new Set();
        document.querySelectorAll('img').forEach(img => {
          const src = img.src;
          if (src && src.includes('googleusercontent.com') && !src.includes('=s32') && !src.includes('=s36')) {
            let largeUrl = src.replace(/=s\d+/, '=s1200').replace(/=w\d+-h\d+/, '=w1200-h900');
            urls.add(largeUrl);
          }
        });
        return Array.from(urls);
      });
      
      morePhotos.forEach(url => {
        if (!photoUrls.includes(url)) photoUrls.push(url);
      });
    }
  }

  console.log(`📸 Found ${photoUrls.length} photos\n`);

  // Download photos
  if (photoUrls.length > 0) {
    console.log("⬇️ Downloading photos...\n");
    
    let downloaded = 0;
    for (let i = 0; i < photoUrls.length; i++) {
      try {
        const response = await page.goto(photoUrls[i], { timeout: 15000 });
        const buffer = await response.buffer();
        
        const contentType = response.headers()['content-type'] || '';
        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        
        const filename = `photo_${i + 1}.${ext}`;
        await fs.writeFile(`${OUTPUT_DIR}/${filename}`, buffer);
        downloaded++;
        console.log(`✔ Saved: ${filename}`);
      } catch (err) {
        console.log(`❌ Failed to download photo ${i + 1}`);
      }
    }
    
    console.log(`\n📸 Downloaded ${downloaded} photos`);
  }

  // Go back to the listing page and extract reviews
  await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Click first result again
  try {
    const firstResult = await page.$('a[href*="/maps/place/"]');
    if (firstResult) {
      await firstResult.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (e) {}

  // Extract reviews
  console.log("\n📝 Extracting reviews...\n");
  
  // Click on reviews tab
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

  // Scroll to load reviews
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const scrollable = document.querySelector('div.m6QErb.DxyBCb, div[role="feed"]');
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Expand review texts
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
        const author = el.querySelector('div.d4r55, a[href*="/contrib/"]')?.textContent || '';
        const ratingEl = el.querySelector('span[role="img"]');
        const rating = ratingEl?.getAttribute('aria-label') || '';
        const text = el.querySelector('span.wiI7pd, div.MyEned')?.textContent || '';
        const date = el.querySelector('span.rsqaWe')?.textContent || '';
        
        if (author || text) {
          extracted.push({ author: author.trim(), rating, text: text.trim(), date: date.trim() });
        }
      } catch (e) {}
    }
    
    return extracted;
  });

  // Remove duplicates
  const uniqueReviews = reviews.filter((review, index, self) =>
    index === self.findIndex((r) => r.author === review.author && r.text === review.text)
  );

  console.log(`📝 Found ${uniqueReviews.length} reviews`);

  await browser.close();

  return { businessInfo, photoUrls, reviews: uniqueReviews };
}

async function main() {
  if (!SEARCH_QUERY) {
    console.log("❗ Usage: node scrape-maps-business.js \"business name and address\"");
    console.log("   Example: node scrape-maps-business.js \"Starbucks Times Square NYC\"");
    process.exit(1);
  }

  console.log("🚀 Google Maps Business Scraper\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const { businessInfo, photoUrls, reviews } = await scrapeGoogleMapsBusiness(SEARCH_QUERY);

  // Save all data
  const output = {
    query: SEARCH_QUERY,
    business: businessInfo,
    photos: {
      count: photoUrls.length,
      urls: photoUrls
    },
    reviews: {
      count: reviews.length,
      items: reviews
    },
    scrapedAt: new Date().toISOString()
  };

  await fs.writeJSON(`${OUTPUT_DIR}/business-data.json`, output, { spaces: 2 });
  console.log(`\n📄 Saved: ${OUTPUT_DIR}/business-data.json`);

  // Create readable text version
  let textContent = `GOOGLE MAPS BUSINESS DATA\n`;
  textContent += `${'='.repeat(50)}\n\n`;
  textContent += `Search Query: ${SEARCH_QUERY}\n`;
  textContent += `Scraped At: ${new Date().toISOString()}\n\n`;
  textContent += `BUSINESS INFORMATION\n`;
  textContent += `${'-'.repeat(30)}\n`;
  textContent += `Name: ${businessInfo.name}\n`;
  textContent += `Rating: ${businessInfo.rating} (${businessInfo.reviewCount} reviews)\n`;
  textContent += `Category: ${businessInfo.category}\n`;
  textContent += `Address: ${businessInfo.address}\n`;
  textContent += `Phone: ${businessInfo.phone}\n`;
  textContent += `Website: ${businessInfo.website}\n`;
  textContent += `Hours: ${businessInfo.hours}\n`;
  textContent += `Plus Code: ${businessInfo.plusCode}\n\n`;
  textContent += `PHOTOS\n`;
  textContent += `${'-'.repeat(30)}\n`;
  textContent += `Total Photos: ${photoUrls.length}\n\n`;
  textContent += `REVIEWS (${reviews.length} total)\n`;
  textContent += `${'-'.repeat(30)}\n\n`;

  reviews.forEach((review, i) => {
    textContent += `Review #${i + 1}\n`;
    textContent += `Author: ${review.author}\n`;
    textContent += `Rating: ${review.rating}\n`;
    textContent += `Date: ${review.date}\n`;
    textContent += `\n${review.text}\n`;
    textContent += `\n${'-'.repeat(40)}\n\n`;
  });

  await fs.writeFile(`${OUTPUT_DIR}/business-data.txt`, textContent);
  console.log(`📄 Saved: ${OUTPUT_DIR}/business-data.txt`);

  console.log(`\n🎉 Done! All data saved to ${OUTPUT_DIR}/`);
}

main().catch(console.error);

