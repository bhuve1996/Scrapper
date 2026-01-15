# Website Cloner with Astro.js

Clone and rebuild websites using Astro.js. This project scrapes websites and rebuilds them as static sites.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Scrape a Website
```bash
npm run scrape https://example.com
```

### 3. Build the Site
```bash
npm run build
```

### 4. Preview
```bash
npm run preview
```

### 5. Develop
```bash
npm run dev
```

## Usage

### Scraping
```bash
# Scrape a website
npm run scrape https://example.com

# Or directly
node scripts/scrape-website.js https://example.com
```

### Building
After scraping, the data is saved to `scraped-data/`. Build the Astro site:

```bash
npm run build
```

### Development
Start the dev server to see your cloned website:

```bash
npm run dev
```

## Project Structure

```
website-cloner/
├── scripts/
│   └── scrape-website.js    # Scraper script
├── scraped-data/             # Scraped website data
│   ├── website-data.json    # Complete data
│   ├── pages/               # HTML pages
│   └── assets/              # Images, CSS, JS
├── src/
│   ├── components/          # Astro components
│   ├── pages/              # Astro pages
│   └── utils/              # Data loaders
└── public/                 # Static assets
```

## Features

- ✅ Complete website scraping (HTML, CSS, JS, images)
- ✅ Component identification
- ✅ Astro.js static site generation
- ✅ TypeScript support
- ✅ Asset management
- ✅ Dynamic routing

## Documentation

See [DOCUMENTATION.md](./DOCUMENTATION.md) for detailed documentation.

## License

MIT
