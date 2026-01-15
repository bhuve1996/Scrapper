# Website Cloner with Astro.js

A powerful tool to clone websites and rebuild them as static sites using Astro.js. This project scrapes websites (HTML, CSS, JS, images, metadata, SEO tags, favicon) and rebuilds them with all assets working locally.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Scrape a Website
```bash
npm run scrape https://windscribe.com
```

### 3. Build the Site
```bash
npm run build
```

### 4. Preview
```bash
npm run preview
```

Visit `http://localhost:4321` to see the cloned website.

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run scrape <url>` | Scrape a website and download all assets |
| `npm run build` | Build the static site |
| `npm run preview` | Preview the built site |
| `npm run dev` | Start development server |
| `npm run package` | Package project for distribution (creates ZIP and folder) |
| `npm run clear` | Clear all scraped data (asks for confirmation) |

## 📦 Package Project for Distribution

### Create Ready-to-Use Project Package

Package the project into a clean, ready-to-use folder and ZIP file:

```bash
npm run package
```

This will:
- Copy all essential files (excluding node_modules, dist, scraped-data)
- Create a clean project structure
- Generate a ZIP file: `website-cloner-ready.zip`
- Create a folder: `website-cloner-ready/`
- Include `SETUP.md` with instructions

**Output:**
- 📁 `../website-cloner-ready/` - Clean project folder
- 📦 `../website-cloner-ready.zip` - ZIP archive

### After Packaging

1. **Extract or use the folder:**
   ```bash
   # Option A: Use the folder
   cd ../website-cloner-ready
   
   # Option B: Extract ZIP
   unzip website-cloner-ready.zip
   cd website-cloner-ready
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Scrape a website:**
   ```bash
   npm run scrape https://example.com
   ```

4. **Build and preview:**
   ```bash
   npm run build
   npm run preview
   ```

## 🧹 Clear Scraped Data

After testing and before moving the project, clear all scraped data:

```bash
npm run clear
```

This will:
- Ask for confirmation before deleting
- Clear `scraped-data/` directory
- Clear `public/assets/` directory
- Clear `dist/` directory
- Keep directory structure intact

**⚠️ Note:** This script asks for confirmation before deleting. Type `yes` to proceed.

## 📋 What to Do Next

### If Moving to New Location/Repository

1. **Package the project:**
   ```bash
   npm run package
   ```

2. **Test the packaged project:**
   ```bash
   cd ../website-cloner-ready
   npm install
   npm run scrape https://windscribe.com
   npm run build
   npm run preview
   ```

3. **If everything works, clear scraped data from original:**
   ```bash
   cd ../website-cloner
   npm run clear
   # Type 'yes' when prompted
   ```

4. **Move the packaged project:**
   ```bash
   # Option A: Copy folder
   cp -r ../website-cloner-ready /path/to/new/location/
   
   # Option B: Use ZIP
   cp ../website-cloner-ready.zip /path/to/new/location/
   cd /path/to/new/location/
   unzip website-cloner-ready.zip
   ```

5. **Or push to new git repository:**
   ```bash
   cd ../website-cloner-ready
   git init
   git add .
   git commit -m "Website cloner - ready to use"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

### If Continuing Development

1. **Review implementation checklist** (see below)
2. **Start with Priority 1 features:**
   - Dropdown components
   - Click handlers
   - Mobile menu
   - Form validation
3. **Add client-side JavaScript** (see sections below)
4. **Test on different websites**

## 📁 Project Structure

```
website-cloner/
├── scripts/
│   ├── scrape-website.js      # Main scraper script
│   ├── package-project.js      # Package project for distribution
│   └── clear-scraped-data.js   # Clear scraped data
├── scraped-data/               # Scraped website data (generated)
│   ├── website-data.json       # Complete data (pages, assets, metadata)
│   ├── assets/                 # Downloaded assets
│   │   ├── images/             # All images (SVG, PNG, JPG, WebP)
│   │   ├── css/                # All CSS files
│   │   └── js/                 # All JavaScript files
│   └── favicon.*               # Favicon file
├── src/
│   ├── components/             # Astro components
│   │   ├── Layout.astro        # Main layout with metadata
│   │   ├── Header.astro       # Header component
│   │   └── Footer.astro        # Footer component
│   ├── pages/                  # Astro pages
│   │   ├── index.astro         # Homepage
│   │   └── [...slug].astro     # Dynamic routes
│   └── utils/                  # Utilities
│       ├── data-loader.ts      # Load scraped data
│       └── html-processor.ts   # Process HTML and fix asset paths
├── public/                     # Static assets (copied from scraped-data)
│   └── assets/                 # Images, CSS, JS served statically
├── dist/                       # Built static site (generated)
├── package.json
├── astro.config.mjs
├── tsconfig.json
└── README.md
```

## ✅ What's Working

### Scraping & Data Extraction
- ✅ **HTML Content**: All pages scraped with original and rendered HTML
- ✅ **Images**: All images downloaded with correct file types (SVG, PNG, JPG, WebP)
- ✅ **CSS**: All stylesheets downloaded and linked
- ✅ **JavaScript**: All JS files downloaded and linked
- ✅ **Metadata**: Complete metadata extraction including:
  - Page title
  - Meta description, keywords, author, robots
  - Open Graph tags (og:title, og:description, og:image, og:url, og:type, etc.)
  - Twitter Card tags
  - Canonical URLs
  - Theme color
  - Language settings
- ✅ **Favicon**: Automatically detected and downloaded
- ✅ **SEO Tags**: All SEO-related meta tags extracted
- ✅ **Page Structure**: Component identification (navbar, header, footer, cards, buttons, forms)

### Website Rendering
- ✅ **Static Site Generation**: All pages built as static HTML
- ✅ **Dynamic Routing**: All scraped pages accessible via routes
- ✅ **Asset Paths**: All image, CSS, and JS paths correctly rewritten to local assets
- ✅ **Image Optimization**: Next.js image URLs correctly handled
- ✅ **Responsive Images**: srcset attributes properly processed
- ✅ **Logo & Icons**: SVG/PNG files correctly matched for logos and icons
- ✅ **Layout**: Proper HTML structure with metadata in head
- ✅ **CSS Styling**: All stylesheets loaded and working
- ✅ **Visual Fidelity**: Website looks exactly like the original

## ⚠️ What Needs Implementation

### JavaScript Functionality

#### 1. **Login/Authentication System**
- ❌ Login form submission
- ❌ User authentication
- ❌ Session management
- ❌ Protected routes
- ❌ User profile management

**Files to implement:**
- `src/utils/auth.ts` - Authentication logic
- `src/components/LoginForm.astro` - Login component
- `src/pages/login.astro` - Login page handler

**Required modules:**
```javascript
// Example structure needed
- Form validation
- API calls to authentication endpoint
- Token storage (localStorage/cookies)
- Redirect after login
- Error handling
```

#### 2. **Dropdown Menus**
- ❌ Country selector dropdown (currently shows list, needs dropdown UI)
- ❌ Navigation dropdowns
- ❌ Language selector
- ❌ User menu dropdown

**Files to implement:**
- `src/components/Dropdown.astro` - Reusable dropdown component
- `src/utils/dropdown.ts` - Dropdown logic
- Update existing components to use dropdown

**Required modules:**
```javascript
// Example structure needed
- Click handlers for toggle
- Outside click detection
- Keyboard navigation (arrow keys, escape)
- Animation/transitions
- State management
```

#### 3. **Interactive Components**

**Navigation:**
- ❌ Mobile menu toggle
- ❌ Smooth scrolling
- ❌ Active link highlighting
- ❌ Sticky header behavior

**Forms:**
- ❌ Form validation
- ❌ Form submission handling
- ❌ Error messages display
- ❌ Success feedback

**Modals/Dialogs:**
- ❌ Modal open/close
- ❌ Overlay handling
- ❌ Focus trap
- ❌ Escape key handling

**Tabs:**
- ❌ Tab switching
- ❌ Active tab indication
- ❌ Content switching

**Accordions:**
- ❌ Expand/collapse
- ❌ Smooth animations
- ❌ Multiple open/close behavior

**Carousels/Sliders:**
- ❌ Image carousels
- ❌ Auto-play functionality
- ❌ Navigation arrows
- ❌ Dot indicators

#### 4. **Dynamic Content Loading**

**API Integration:**
- ❌ Fetch data from APIs
- ❌ Handle loading states
- ❌ Error handling
- ❌ Data caching

**Real-time Updates:**
- ❌ WebSocket connections
- ❌ Live data updates
- ❌ Notifications

#### 5. **Search Functionality**
- ❌ Search input handling
- ❌ Search results display
- ❌ Search filtering
- ❌ Search history

#### 6. **Shopping/Purchase Flow** (if applicable)
- ❌ Add to cart
- ❌ Cart management
- ❌ Checkout process
- ❌ Payment integration
- ❌ Order confirmation

#### 7. **User Interactions**

**Click Handlers Needed:**
- ❌ Button clicks (all interactive buttons)
- ❌ Link navigation (internal/external)
- ❌ Image lightbox/gallery
- ❌ Copy to clipboard
- ❌ Share buttons (social media)
- ❌ Print functionality
- ❌ Download buttons

**Event Handlers:**
- ❌ Scroll events (lazy loading, animations)
- ❌ Resize events (responsive behavior)
- ❌ Keyboard events (accessibility)
- ❌ Touch events (mobile gestures)

## 📋 Implementation Checklist

### Priority 1: Core Functionality
- [ ] Implement dropdown components (country selector, navigation)
- [ ] Add click handlers for all buttons
- [ ] Implement mobile menu toggle
- [ ] Add form validation and submission

### Priority 2: User Experience
- [ ] Add modal/dialog components
- [ ] Implement tab switching
- [ ] Add accordion functionality
- [ ] Implement carousel/slider components

### Priority 3: Advanced Features
- [ ] Authentication system
- [ ] API integration
- [ ] Search functionality
- [ ] Shopping cart (if needed)

### Priority 4: Polish
- [ ] Smooth animations
- [ ] Loading states
- [ ] Error handling
- [ ] Accessibility improvements

## 🛠️ Required JavaScript Modules/Libraries

### Core Dependencies (Already Installed)
- `axios` - HTTP requests
- `cheerio` - HTML parsing
- `puppeteer` - Browser automation
- `fs-extra` - File system operations
- `archiver` - ZIP file creation (dev dependency)

### Recommended Additions for Functionality

```bash
# For state management
npm install zustand  # or redux, mobx

# For form handling
npm install react-hook-form  # if using React
# or
npm install @formspree/react

# For animations
npm install framer-motion  # or gsap

# For API calls
npm install @tanstack/react-query  # if using React

# For date handling
npm install date-fns

# For utilities
npm install lodash
```

### Client-Side JavaScript Structure

Create these files in `src/utils/client/`:

1. **`client/dropdown.ts`** - Dropdown functionality
```typescript
export function initDropdowns() {
  // Initialize all dropdowns
}
```

2. **`client/modal.ts`** - Modal functionality
```typescript
export function openModal(id: string) {}
export function closeModal(id: string) {}
```

3. **`client/forms.ts`** - Form handling
```typescript
export function validateForm(form: HTMLFormElement) {}
export function submitForm(form: HTMLFormElement) {}
```

4. **`client/navigation.ts`** - Navigation handlers
```typescript
export function initMobileMenu() {}
export function handleSmoothScroll() {}
```

5. **`client/auth.ts`** - Authentication (if needed)
```typescript
export function login(email: string, password: string) {}
export function logout() {}
export function isAuthenticated() {}
```

## 📝 Notes

### Current Limitations
1. **Static Site**: This is a static site generator, so dynamic server-side features won't work
2. **No Backend**: Authentication and API calls need backend integration
3. **JavaScript Execution**: Some JS-heavy sites may need additional client-side scripts
4. **Third-party Services**: External services (analytics, chat widgets) may not work

### Best Practices
1. **Test Locally**: Always test the cloned site locally before deployment
2. **Check Console**: Check browser console for JavaScript errors
3. **Verify Assets**: Ensure all images, CSS, and JS files are loading
4. **Mobile Testing**: Test on mobile devices for responsive behavior
5. **Accessibility**: Ensure keyboard navigation and screen reader support

## 🔧 Development

### Scraping Options
```bash
# Scrape with default settings (50 pages max)
npm run scrape https://example.com

# Or modify scrape-website.js to change:
# - maxPages (default: 50)
# - timeout settings
# - user agent
```

### Building
```bash
# Production build
npm run build

# Development server
npm run dev

# Preview production build
npm run preview
```

## 📚 Documentation

- **README.md** - This file (main documentation)
- **QUICK_START.md** - Quick reference guide
- **DOCUMENTATION.md** - Detailed technical documentation
- **MOVE_PROJECT.md** - Guide for moving the project
- **CHANGES_SUMMARY.md** - Summary of changes
- **SCRIPT_SUMMARY.md** - Scripts documentation

## 🐛 Troubleshooting

### Images not showing
- Check `public/assets/images/` exists
- Verify image paths in HTML
- Check browser console for 404 errors

### CSS not loading
- Check `public/assets/css/` exists
- Verify CSS links in `<head>`
- Check for CORS issues

### JavaScript not working
- Check `public/assets/js/` exists
- Verify script tags in HTML
- Check browser console for errors
- Some JS may need to be rewritten for static site

### Dropdowns/Interactions not working
- Add client-side JavaScript (see Implementation section)
- Check for missing event listeners
- Verify DOM elements exist before attaching handlers

### Package script fails
- Run `npm install` first to ensure archiver is installed
- Check you have write permissions in parent directory
- Script will auto-install archiver if needed

### Clear script doesn't work
- Make sure you're in the project root
- Check file permissions
- Type `yes` (not `y` or anything else) for confirmation

## 📄 License

MIT

## 🙏 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues, questions, or contributions:
- Check the documentation files
- Review browser console for errors
- See implementation checklist for missing features

---

**Built with ❤️ using Astro.js**
