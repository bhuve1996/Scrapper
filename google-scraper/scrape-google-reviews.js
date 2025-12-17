import puppeteer from "puppeteer";
import fs from "fs-extra";

const SEARCH_QUERY = process.argv[2];
const MAX_REVIEWS = parseInt(process.argv[3]) || 50;
const OUTPUT_DIR = "./google-reviews";

async function scrapeGoogleReviews(query, maxReviews) {
  console.log(`🔍 Searching Google for: "${query}"`);
  console.log(`📝 Max reviews to fetch: ${maxReviews}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Search on Google Maps
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  console.log("🗺️ Opening Google Maps...");
  await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Click on the first result if it's a list
  try {
    const firstResult = await page.$('div[role="feed"] > div:first-child');
    if (firstResult) {
      await firstResult.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } catch (err) {
    // Already on a place page
  }

  // Extract business info
  const businessInfo = await page.evaluate(() => {
    const name = document.querySelector('h1')?.textContent || '';
    const rating = document.querySelector('span[aria-label*="stars"]')?.textContent || 
                   document.querySelector('div.fontDisplayLarge')?.textContent || '';
    const reviewCount = document.querySelector('button[aria-label*="reviews"]')?.textContent || '';
    const address = document.querySelector('button[data-item-id="address"]')?.textContent || '';
    const phone = document.querySelector('button[data-item-id*="phone"]')?.textContent || '';
    const website = document.querySelector('a[data-item-id="authority"]')?.href || '';
    
    return { name, rating, reviewCount, address, phone, website };
  });

  console.log(`\n📍 Business: ${businessInfo.name}`);
  console.log(`⭐ Rating: ${businessInfo.rating}`);
  console.log(`📊 Reviews: ${businessInfo.reviewCount}\n`);

  // Click on reviews tab/button
  try {
    const reviewsButton = await page.$('button[aria-label*="Reviews"]');
    if (reviewsButton) {
      await reviewsButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (err) {
    // Try alternative selector
    try {
      await page.click('button[data-tab-index="1"]');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      // Reviews might already be visible
    }
  }

  // Scroll through reviews to load more
  console.log("📜 Loading reviews...");

  const reviewsContainer = await page.$('div[role="feed"], div.m6QErb.DxyBCb');
  
  if (reviewsContainer) {
    let previousReviewCount = 0;
    let scrollAttempts = 0;
    const maxScrolls = 20;

    while (scrollAttempts < maxScrolls) {
      await page.evaluate((selector) => {
        const container = document.querySelector('div[role="feed"], div.m6QErb.DxyBCb');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      const currentReviewCount = await page.evaluate(() => 
        document.querySelectorAll('div[data-review-id], div.jftiEf').length
      );

      if (currentReviewCount === previousReviewCount) {
        scrollAttempts++;
        if (scrollAttempts >= 3) break;
      } else {
        scrollAttempts = 0;
      }

      previousReviewCount = currentReviewCount;
      console.log(`📝 Loaded ${currentReviewCount} reviews...`);

      if (currentReviewCount >= maxReviews) break;
    }
  }

  // Expand "More" buttons in reviews
  const moreButtons = await page.$$('button[aria-label="See more"], button.w8nwRe');
  for (const btn of moreButtons.slice(0, 20)) {
    try {
      await btn.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {}
  }

  // Extract reviews
  const reviews = await page.evaluate((max) => {
    const reviewElements = document.querySelectorAll('div[data-review-id], div.jftiEf');
    const extracted = [];

    for (const el of reviewElements) {
      if (extracted.length >= max) break;

      try {
        const authorName = el.querySelector('div.d4r55, button[data-review-id] div')?.textContent || 
                          el.querySelector('.WNxzHc button')?.textContent || '';
        
        const ratingEl = el.querySelector('span[aria-label*="star"], span.kvMYJc');
        const rating = ratingEl?.getAttribute('aria-label') || 
                      ratingEl?.className.match(/\d+/)?.[0] || '';
        
        const reviewText = el.querySelector('span.wiI7pd, div.MyEned')?.textContent || '';
        
        const dateEl = el.querySelector('span.rsqaWe, span.xRkPPb');
        const date = dateEl?.textContent || '';
        
        const likesEl = el.querySelector('span[aria-label*="likes"], span.pkWtMe');
        const likes = likesEl?.textContent || '0';

        // Get reviewer's profile image
        const profileImg = el.querySelector('img.NBa7we, button img')?.src || '';

        // Get review images if any
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

  await browser.close();

  return { businessInfo, reviews };
}

async function main() {
  if (!SEARCH_QUERY) {
    console.log("❗ Usage: node scrape-google-reviews.js \"business name\" [max_reviews]");
    console.log("   Example: node scrape-google-reviews.js \"Starbucks Times Square NYC\" 30");
    process.exit(1);
  }

  console.log("🚀 Google Reviews Scraper\n");

  const { businessInfo, reviews } = await scrapeGoogleReviews(SEARCH_QUERY, MAX_REVIEWS);

  // Save results
  await fs.ensureDir(OUTPUT_DIR);

  const output = {
    business: businessInfo,
    totalReviews: reviews.length,
    scrapedAt: new Date().toISOString(),
    reviews: reviews
  };

  await fs.writeJSON(`${OUTPUT_DIR}/reviews.json`, output, { spaces: 2 });
  console.log(`\n📄 Saved: ${OUTPUT_DIR}/reviews.json`);

  // Create a readable text version
  let textContent = `Business: ${businessInfo.name}\n`;
  textContent += `Rating: ${businessInfo.rating}\n`;
  textContent += `Total Reviews Found: ${reviews.length}\n`;
  textContent += `Address: ${businessInfo.address}\n`;
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

  // Download review images
  if (reviews.some(r => r.images.length > 0)) {
    console.log("\n🖼️ Review images URLs saved in reviews.json");
  }

  console.log(`\n🎉 Done! Extracted ${reviews.length} reviews for "${businessInfo.name}"`);
}

main().catch(console.error);

