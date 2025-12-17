import puppeteer from "puppeteer";
import fs from "fs-extra";

const SEARCH_QUERY = process.argv[2];
const MAX_REVIEWS = parseInt(process.argv[3]) || 50;
const OUTPUT_DIR = "./google-reviews";

async function scrapeGoogleReviews(query, maxReviews) {
  // Delete old data first
  console.log("🗑️ Deleting old scraped data...");
  await fs.emptyDir(OUTPUT_DIR);
  
  console.log(`🔍 Searching Google for: "${query}"`);
  console.log(`📝 Max reviews to fetch: ${maxReviews}\n`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.setViewport({ width: 1280, height: 800 });

  // Search on Google Maps
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  console.log("🗺️ Opening Google Maps...");
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

  // Take a screenshot for debugging
  await page.screenshot({ path: `${OUTPUT_DIR}/debug-screenshot.png` });
  console.log("📸 Saved debug screenshot");

  // Click on the first result if it's a list
  try {
    const firstResult = await page.$('div[role="feed"] > div:first-child a, a[href*="/maps/place/"]');
    if (firstResult) {
      console.log("📍 Clicking first result...");
      await firstResult.click();
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  } catch (err) {
    console.log("ℹ️ Already on place page or no results");
  }

  // Extract business info with better selectors
  const businessInfo = await page.evaluate(() => {
    // Try multiple selectors for name
    const name = document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge, h1')?.textContent || 
                 document.querySelector('div[role="main"] h1')?.textContent || '';
    
    // Rating
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"], span.ceNzKf, div.fontDisplayLarge');
    const rating = ratingEl?.textContent || '';
    
    // Review count
    const reviewCountEl = document.querySelector('span[aria-label*="reviews"], button[jsaction*="reviews"]');
    const reviewCount = reviewCountEl?.textContent || reviewCountEl?.getAttribute('aria-label') || '';
    
    // Address
    const addressEl = document.querySelector('button[data-item-id="address"], div[data-item-id="address"]');
    const address = addressEl?.textContent || '';
    
    // Phone
    const phoneEl = document.querySelector('button[data-item-id*="phone"], div[data-item-id*="phone"]');
    const phone = phoneEl?.textContent || '';
    
    // Website
    const websiteEl = document.querySelector('a[data-item-id="authority"], a[href*="http"]:not([href*="google"])');
    const website = websiteEl?.href || '';
    
    // Category
    const categoryEl = document.querySelector('button[jsaction*="category"], span.DkEaL');
    const category = categoryEl?.textContent || '';

    return { name, rating, reviewCount, address, phone, website, category };
  });

  console.log(`\n📍 Business: ${businessInfo.name || '(not found)'}`);
  console.log(`⭐ Rating: ${businessInfo.rating || 'N/A'}`);
  console.log(`📊 Reviews: ${businessInfo.reviewCount || 'N/A'}`);
  console.log(`📂 Category: ${businessInfo.category || 'N/A'}`);
  console.log(`📫 Address: ${businessInfo.address || 'N/A'}`);
  console.log(`📞 Phone: ${businessInfo.phone || 'N/A'}\n`);

  // Click on reviews tab/button - try multiple selectors
  console.log("🔍 Looking for reviews tab...");
  const reviewsSelectors = [
    'button[aria-label*="Reviews"]',
    'button[data-tab-index="1"]',
    'div[role="tablist"] button:nth-child(2)',
    'button[jsaction*="reviews"]',
    'span:has-text("Reviews")'
  ];

  for (const selector of reviewsSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log("✔ Clicked reviews tab");
        await new Promise(resolve => setTimeout(resolve, 3000));
        break;
      }
    } catch (e) {}
  }

  // Try clicking by text content
  try {
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent.includes('Reviews') || btn.textContent.includes('reviews')) {
          btn.click();
          break;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {}

  // Scroll through reviews to load more
  console.log("📜 Loading reviews...");

  // Find scrollable container
  const scrollableSelector = 'div.m6QErb.DxyBCb, div[role="feed"], div.section-scrollbox';
  
  let previousReviewCount = 0;
  let scrollAttempts = 0;
  const maxScrolls = 20;

  while (scrollAttempts < maxScrolls) {
    await page.evaluate((selector) => {
      const containers = document.querySelectorAll(selector);
      containers.forEach(container => {
        container.scrollTop = container.scrollHeight;
      });
      // Also try scrolling the main scrollable area
      const mainScroll = document.querySelector('div[role="main"]');
      if (mainScroll) mainScroll.scrollTop = mainScroll.scrollHeight;
    }, scrollableSelector);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const currentReviewCount = await page.evaluate(() => 
      document.querySelectorAll('div[data-review-id], div.jftiEf, div[class*="review"]').length
    );

    if (currentReviewCount === previousReviewCount) {
      scrollAttempts++;
      if (scrollAttempts >= 3) break;
    } else {
      scrollAttempts = 0;
    }

    previousReviewCount = currentReviewCount;
    if (currentReviewCount > 0) {
      console.log(`📝 Loaded ${currentReviewCount} reviews...`);
    }

    if (currentReviewCount >= maxReviews) break;
  }

  // Expand "More" buttons in reviews
  try {
    await page.evaluate(() => {
      const moreButtons = document.querySelectorAll('button[aria-label="See more"], button.w8nwRe, span.w8nwRe');
      moreButtons.forEach(btn => btn.click());
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (e) {}

  // Take another screenshot after loading
  await page.screenshot({ path: `${OUTPUT_DIR}/debug-reviews.png` });

  // Extract reviews with improved selectors
  const reviews = await page.evaluate((max) => {
    const reviewElements = document.querySelectorAll('div[data-review-id], div.jftiEf, div[class*="review-container"]');
    const extracted = [];

    for (const el of reviewElements) {
      if (extracted.length >= max) break;

      try {
        // Author name - try multiple selectors
        const authorName = el.querySelector('div.d4r55, button.WEBjve div, div.WNxzHc span, a[href*="/contrib/"]')?.textContent || '';
        
        // Rating
        const ratingEl = el.querySelector('span[role="img"][aria-label*="star"], span.kvMYJc, span[aria-label*="stars"]');
        const rating = ratingEl?.getAttribute('aria-label') || '';
        
        // Review text
        const reviewText = el.querySelector('span.wiI7pd, div.MyEned span, div[class*="review-text"]')?.textContent || '';
        
        // Date
        const date = el.querySelector('span.rsqaWe, span.xRkPPb, span[class*="date"]')?.textContent || '';
        
        // Likes
        const likes = el.querySelector('span.pkWtMe, span[aria-label*="like"]')?.textContent || '0';

        // Profile image
        const profileImg = el.querySelector('img.NBa7we, button img, a img')?.src || '';

        // Review images
        const reviewImages = Array.from(el.querySelectorAll('button[data-photo-index] img, div.KtCyie img'))
          .map(img => img.src)
          .filter(src => src && !src.includes('profile'));

        if (authorName || reviewText) {
          extracted.push({
            author: authorName.trim(),
            rating: rating,
            text: reviewText.trim(),
            date: date.trim(),
            likes: likes,
            profileImage: profileImg,
            images: reviewImages
          });
        }
      } catch (err) {}
    }

    return extracted;
  }, maxReviews);

  // Get page HTML for debugging if no reviews found
  if (reviews.length === 0) {
    const html = await page.content();
    await fs.writeFile(`${OUTPUT_DIR}/debug-page.html`, html);
    console.log("📄 Saved debug HTML (no reviews found)");
  }

  await browser.close();

  return { businessInfo, reviews };
}

async function main() {
  if (!SEARCH_QUERY) {
    console.log("❗ Usage: node scrape-google-reviews.js \"business name\" [max_reviews]");
    console.log("   Example: node scrape-google-reviews.js \"Starbucks Times Square NYC\" 30");
    process.exit(1);
  }

  await fs.ensureDir(OUTPUT_DIR);

  console.log("🚀 Google Reviews Scraper\n");

  const { businessInfo, reviews } = await scrapeGoogleReviews(SEARCH_QUERY, MAX_REVIEWS);

  // Save results
  const output = {
    query: SEARCH_QUERY,
    business: businessInfo,
    totalReviews: reviews.length,
    scrapedAt: new Date().toISOString(),
    reviews: reviews
  };

  await fs.writeJSON(`${OUTPUT_DIR}/reviews.json`, output, { spaces: 2 });
  console.log(`\n📄 Saved: ${OUTPUT_DIR}/reviews.json`);

  // Create a readable text version
  let textContent = `Search Query: ${SEARCH_QUERY}\n`;
  textContent += `Business: ${businessInfo.name}\n`;
  textContent += `Rating: ${businessInfo.rating}\n`;
  textContent += `Category: ${businessInfo.category}\n`;
  textContent += `Total Reviews Found: ${reviews.length}\n`;
  textContent += `Address: ${businessInfo.address}\n`;
  textContent += `Phone: ${businessInfo.phone}\n`;
  textContent += `Website: ${businessInfo.website}\n`;
  textContent += `\n${'='.repeat(50)}\n\n`;

  reviews.forEach((review, i) => {
    textContent += `Review #${i + 1}\n`;
    textContent += `Author: ${review.author}\n`;
    textContent += `Rating: ${review.rating}\n`;
    textContent += `Date: ${review.date}\n`;
    textContent += `Likes: ${review.likes}\n`;
    textContent += `\n${review.text}\n`;
    if (review.images.length > 0) {
      textContent += `\nImages: ${review.images.join(', ')}\n`;
    }
    textContent += `\n${'-'.repeat(40)}\n\n`;
  });

  await fs.writeFile(`${OUTPUT_DIR}/reviews.txt`, textContent);
  console.log(`📄 Saved: ${OUTPUT_DIR}/reviews.txt`);

  console.log(`\n🎉 Done! Extracted ${reviews.length} reviews for "${businessInfo.name || SEARCH_QUERY}"`);
}

main().catch(console.error);
