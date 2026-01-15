# Website Cloner - Documentation

## Overview

This project uses **Astro.js** to clone and rebuild websites by:
1. **Scraping** the original website (HTML, CSS, JS, images)
2. **Analyzing** the structure and components
3. **Rebuilding** the website using Astro components

## Project Structure

```
website-cloner/
├── scripts/
│   └── scrape-website.js      # Main scraper script
├── scraped-data/              # Scraped website data
│   ├── website-data.json      # Complete website data
│   ├── pages/                 # Individual HTML pages
│   └── assets/                # Images, CSS, JS files
├── src/
│   ├── components/            # Astro components
│   │   ├── Layout.astro       # Main layout component
│   │   ├── Header.astro       # Header/Navbar component
│   │   ├── Footer.astro       # Footer component
│   │   ├── Hero.astro         # Hero section component
│   │   └── Card.astro         # Card component
│   ├── pages/                 # Astro pages
│   │   ├── index.astro        # Homepage
│   │   └── [...slug].astro    # Dynamic routes
│   └── utils/
│       └── data-loader.ts     # Load scraped data
└── public/                    # Static assets
```

## Workflow

### 1. Scraping Phase

**Script:** `scripts/scrape-website.js`

**What it does:**
- Crawls the target website (up to 10 pages)
- Extracts HTML, CSS, JavaScript, and images
- Analyzes page structure and identifies components
- Downloads all assets locally
- Saves structured data to `scraped-data/website-data.json`

**Usage:**
```bash
node scripts/scrape-website.js https://example.com
```

**Output:**
- `scraped-data/website-data.json` - Complete website structure
- `scraped-data/pages/*.html` - Individual page HTML
- `scraped-data/assets/images/*` - Downloaded images
- `scraped-data/assets/css/*` - CSS files
- `scraped-data/assets/js/*` - JavaScript files

### 2. Data Structure

The scraper creates a JSON structure:

```json
{
  "pages": [
    {
      "url": "https://example.com",
      "originalHTML": "...",
      "renderedHTML": "...",
      "structure": {
        "title": "Page Title",
        "meta": {...},
        "sections": [...],
        "components": [...]
      }
    }
  ],
  "assets": {
    "images": [...],
    "css": [...],
    "js": [...]
  },
  "structure": {
    "routes": [...],
    "components": [...]
  }
}
```

### 3. Component Identification

The scraper automatically identifies common components:

- **Navbar** - Navigation bars
- **Header** - Page headers
- **Hero** - Hero/banner sections
- **Footer** - Page footers
- **Card** - Card components
- **Button** - Button elements
- **Form** - Form components

### 4. Building Phase

**Astro Components** are created based on scraped data:

1. **Layout.astro** - Main layout wrapper
2. **Header.astro** - Rebuilds navigation
3. **Footer.astro** - Rebuilds footer
4. **Hero.astro** - Hero sections
5. **Card.astro** - Card components

**Dynamic Routes:**
- `src/pages/[...slug].astro` - Handles all scraped pages

### 5. Data Loading

**Utility:** `src/utils/data-loader.ts`

Loads scraped data and provides helper functions:
- `loadWebsiteData()` - Loads website-data.json
- `getPageByUrl(url)` - Gets specific page data
- `getAllRoutes()` - Gets all routes
- `getAssets()` - Gets all assets

## Components Flow

```
┌─────────────────┐
│  Scrape Script  │
│  (Node.js)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  website-data   │
│     .json       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Data Loader    │
│  (TypeScript)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Astro Pages    │
│  & Components   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Built Website   │
│  (Static HTML)   │
└─────────────────┘
```

## Component Architecture

### Layout.astro
- Main wrapper component
- Includes global CSS
- Sets up HTML structure
- Handles meta tags

### Header.astro
- Rebuilds navigation from scraped data
- Handles mobile menu
- Includes logo/branding

### Footer.astro
- Rebuilds footer content
- Links and copyright info

### Hero.astro
- Hero/banner sections
- Background images
- Call-to-action buttons

### Card.astro
- Reusable card component
- Product cards, blog cards, etc.

## Usage

### Step 1: Scrape Website
```bash
node scripts/scrape-website.js https://example.com
```

### Step 2: Review Scraped Data
Check `scraped-data/website-data.json` to see structure

### Step 3: Build Astro Site
```bash
npm run build
```

### Step 4: Preview
```bash
npm run preview
```

### Step 5: Develop
```bash
npm run dev
```

## Customization

### Adding New Components

1. Create component in `src/components/`
2. Update scraper to identify component
3. Use component in Astro pages

### Modifying Styles

1. CSS files are in `scraped-data/assets/css/`
2. Copy to `src/styles/` or `public/`
3. Import in components

### Handling Dynamic Content

Use Astro's `getStaticPaths()` to generate pages from scraped data:

```astro
---
export async function getStaticPaths() {
  const data = await loadWebsiteData();
  return data.structure.routes.map(route => ({
    params: { slug: route.path }
  }));
}
---
```

## Features

✅ **Complete Website Scraping**
- HTML, CSS, JavaScript
- Images and assets
- Multiple pages

✅ **Component Identification**
- Automatic component detection
- Structure analysis
- Route mapping

✅ **Astro.js Integration**
- Static site generation
- Component-based architecture
- TypeScript support

✅ **Asset Management**
- Local asset storage
- Path mapping
- Optimization ready

## Future Enhancements

- [ ] CSS extraction and optimization
- [ ] JavaScript bundling
- [ ] Image optimization
- [ ] SEO metadata preservation
- [ ] Form handling
- [ ] Interactive component rebuilding
- [ ] Style extraction to Astro components

## Notes

- Scraping respects robots.txt (can be enhanced)
- Limited to 10 pages by default (configurable)
- Some dynamic content may not be captured
- JavaScript-heavy sites may need additional handling
