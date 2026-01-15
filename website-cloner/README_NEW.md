# Website Cloner - Complete Guide

> Clone any website and rebuild it as a static site with Astro.js. Extract HTML, CSS, JS, images, metadata, SEO tags, and favicon - all in working condition.

## 🎯 What This Project Does

This tool allows you to:
- ✅ Scrape entire websites (up to 50 pages)
- ✅ Download all assets (images, CSS, JS)
- ✅ Extract complete metadata and SEO tags
- ✅ Download favicon automatically
- ✅ Rebuild as a static site with Astro.js
- ✅ Package for distribution
- ✅ Clear scraped data safely

## 🚀 Getting Started (5 Minutes)

### Step 1: Install
```bash
npm install
```

### Step 2: Scrape
```bash
npm run scrape https://windscribe.com
```

### Step 3: Build
```bash
npm run build
```

### Step 4: Preview
```bash
npm run preview
```

**Done!** Visit `http://localhost:4321` to see your cloned website.

## 📦 All Available Commands

```bash
# Scraping
npm run scrape <url>          # Scrape a website

# Building
npm run build                 # Build static site
npm run preview               # Preview built site
npm run dev                   # Development server

# Project Management
npm run package               # Package for distribution
npm run clear                 # Clear scraped data (with confirmation)
```

## 🎁 Package Project for Distribution

### Quick Package
```bash
npm run package
```

**Creates:**
- 📁 `../website-cloner-ready/` - Clean project folder
- 📦 `../website-cloner-ready.zip` - ZIP archive

**What's included:**
- ✅ All source code (`src/`)
- ✅ All scripts (`scripts/`)
- ✅ Configuration files
- ✅ Documentation
- ❌ No node_modules
- ❌ No scraped data
- ❌ No build files

### Use Packaged Project
```bash
cd ../website-cloner-ready
npm install
npm run scrape https://example.com
npm run build
npm run preview
```

## 🧹 Clear Scraped Data

### Safe Clearing
```bash
npm run clear
```

**What it does:**
- Shows what will be deleted
- **Asks for confirmation** (type `yes`)
- Clears `scraped-data/`
- Clears `public/assets/`
- Clears `dist/`
- Keeps directory structure

**Safety:** Won't delete without your explicit `yes` confirmation.

## 📋 Complete Workflow

### For Moving Project

1. **Package:**
   ```bash
   npm run package
   ```

2. **Test packaged project:**
   ```bash
   cd ../website-cloner-ready
   npm install
   npm run scrape https://windscribe.com
   npm run build
   npm run preview
   ```

3. **If works, clear original:**
   ```bash
   cd ../website-cloner
   npm run clear
   # Type 'yes'
   ```

4. **Move to new location:**
   - Copy `website-cloner-ready/` folder
   - Or extract `website-cloner-ready.zip`

### For Development

1. **Scrape website:**
   ```bash
   npm run scrape https://example.com
   ```

2. **Build and preview:**
   ```bash
   npm run build
   npm run preview
   ```

3. **Implement missing features** (see checklist below)

## ✅ What's Working Out of the Box

### Scraping Features
- ✅ HTML content (original + rendered)
- ✅ Images (SVG, PNG, JPG, WebP with correct types)
- ✅ CSS files (all stylesheets)
- ✅ JavaScript files (all scripts)
- ✅ Metadata (20+ fields per page)
- ✅ SEO tags (Open Graph, Twitter Cards)
- ✅ Favicon (auto-detected and downloaded)
- ✅ Page structure analysis

### Rendering Features
- ✅ Static site generation
- ✅ Dynamic routing
- ✅ Asset path rewriting
- ✅ Image optimization handling
- ✅ Responsive images (srcset)
- ✅ Logo & icon matching
- ✅ Metadata injection
- ✅ Visual fidelity (looks exactly like original)

## ⚠️ What Needs Implementation

### Critical (Priority 1)
- [ ] **Dropdowns** - Country selector, navigation menus
- [ ] **Click Handlers** - All interactive buttons
- [ ] **Mobile Menu** - Toggle functionality
- [ ] **Forms** - Validation and submission

### Important (Priority 2)
- [ ] **Modals** - Open/close dialogs
- [ ] **Tabs** - Tab switching
- [ ] **Accordions** - Expand/collapse
- [ ] **Carousels** - Image sliders

### Advanced (Priority 3)
- [ ] **Authentication** - Login/logout
- [ ] **API Integration** - Fetch data
- [ ] **Search** - Search functionality
- [ ] **Shopping Cart** - If needed

### Polish (Priority 4)
- [ ] **Animations** - Smooth transitions
- [ ] **Loading States** - Spinners, skeletons
- [ ] **Error Handling** - User-friendly errors
- [ ] **Accessibility** - ARIA labels, keyboard nav

## 🛠️ Implementation Guide

### Add Dropdown Functionality

1. **Create dropdown component:**
   ```typescript
   // src/utils/client/dropdown.ts
   export function initDropdowns() {
     document.querySelectorAll('.dropdown').forEach(dropdown => {
       const toggle = dropdown.querySelector('.dropdown-toggle');
       const menu = dropdown.querySelector('.dropdown-menu');
       
       toggle?.addEventListener('click', () => {
         menu?.classList.toggle('active');
       });
       
       // Close on outside click
       document.addEventListener('click', (e) => {
         if (!dropdown.contains(e.target as Node)) {
           menu?.classList.remove('active');
         }
       });
     });
   }
   ```

2. **Call in Layout.astro:**
   ```astro
   <script>
     import { initDropdowns } from '../utils/client/dropdown';
     initDropdowns();
   </script>
   ```

### Add Click Handlers

```typescript
// src/utils/client/interactions.ts
export function initClickHandlers() {
  // Button clicks
  document.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.getAttribute('data-action');
      handleAction(action);
    });
  });
}
```

### Add Mobile Menu

```typescript
// src/utils/client/mobile-menu.ts
export function initMobileMenu() {
  const menuToggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.mobile-menu');
  
  menuToggle?.addEventListener('click', () => {
    menu?.classList.toggle('active');
    menuToggle?.classList.toggle('active');
  });
}
```

## 📊 Project Statistics

**Last Scrape Test:**
- Pages: 10
- Images: 257
- CSS Files: 15
- JS Files: 27
- Favicon: ✅ Extracted
- Metadata Fields: 20+ per page

## 📁 Project Structure

```
website-cloner/
├── scripts/
│   ├── scrape-website.js      # Main scraper
│   ├── package-project.js     # Package script
│   └── clear-scraped-data.js  # Clear script
├── src/
│   ├── components/            # Astro components
│   ├── pages/                 # Astro pages
│   └── utils/                 # Utilities
├── scraped-data/              # Generated (scraped content)
├── public/                    # Static assets
├── dist/                      # Built site (generated)
└── package.json
```

## 🔍 Troubleshooting

### Images Not Showing
```bash
# Check if assets exist
ls public/assets/images/

# Re-scrape if missing
npm run scrape <url>
npm run build
```

### CSS Not Loading
```bash
# Verify CSS files
ls public/assets/css/

# Check browser console for 404 errors
```

### JavaScript Not Working
- Check browser console for errors
- Verify scripts are loaded in HTML
- Some JS may need client-side implementation

### Package Script Fails
```bash
# Install archiver
npm install archiver --save-dev

# Try again
npm run package
```

## 📚 Documentation Files

- **README.md** - Main documentation (this file)
- **QUICK_START.md** - Quick reference
- **DOCUMENTATION.md** - Technical details
- **MOVE_PROJECT.md** - Moving guide
- **CHANGES_SUMMARY.md** - Change log
- **SCRIPT_SUMMARY.md** - Scripts guide

## 🎓 Learning Resources

### Astro.js
- [Astro Documentation](https://docs.astro.build)
- [Astro Components](https://docs.astro.build/en/core-concepts/astro-components/)

### Web Scraping
- [Puppeteer Docs](https://pptr.dev)
- [Cheerio Docs](https://cheerio.js.org)

### Client-Side JavaScript
- [MDN Web Docs](https://developer.mozilla.org)
- [JavaScript.info](https://javascript.info)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - feel free to use for any project!

## 💡 Tips

1. **Test First**: Always test scraped sites before deploying
2. **Check Console**: Browser console shows errors
3. **Mobile Test**: Test on mobile devices
4. **Clear Data**: Use `npm run clear` before moving project
5. **Package Clean**: Use `npm run package` for distribution

## 🚀 Deployment

### Deploy to Vercel
```bash
npm run build
# Deploy dist/ folder
```

### Deploy to Netlify
```bash
npm run build
# Deploy dist/ folder
```

### Deploy to GitHub Pages
```bash
npm run build
# Push dist/ to gh-pages branch
```

## 📞 Support

- Check documentation files
- Review browser console
- See implementation checklist
- Check GitHub issues

---

**Made with ❤️ - Clone websites effortlessly!**
