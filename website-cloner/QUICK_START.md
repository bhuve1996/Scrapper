# Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Scrape a Website
```bash
npm run scrape https://windscribe.com
```

### 3. Build
```bash
npm run build
```

### 4. Preview
```bash
npm run preview
```

## 📦 Package for Distribution

### Create Ready-to-Use Package
```bash
npm run package
```

**Output:**
- `../website-cloner-ready/` - Clean project folder
- `../website-cloner-ready.zip` - ZIP archive

### Use the Packaged Project
```bash
cd ../website-cloner-ready
npm install
npm run scrape https://example.com
npm run build
npm run preview
```

## 🧹 Clear Data

### Clear All Scraped Data
```bash
npm run clear
```

**⚠️ Important:** This script will ask for confirmation before deleting. Type `yes` to proceed.

**What gets deleted:**
- `scraped-data/` - All scraped pages and data
- `public/assets/` - All downloaded assets
- `dist/` - Built site

**What stays:**
- Source code (`src/`)
- Scripts (`scripts/`)
- Configuration files
- Documentation

## 📋 Next Steps After Packaging

1. **Test the packaged project:**
   ```bash
   cd ../website-cloner-ready
   npm install
   npm run scrape https://windscribe.com
   npm run build
   npm run preview
   ```

2. **If everything works, clear original project:**
   ```bash
   cd ../website-cloner
   npm run clear
   # Type 'yes' when prompted
   ```

3. **Move packaged project:**
   - Copy `website-cloner-ready/` folder to new location
   - Or extract `website-cloner-ready.zip` to new location

4. **Continue development:**
   - See README.md for implementation checklist
   - Start with Priority 1 features
   - Add client-side JavaScript

## 🆘 Troubleshooting

### Package script fails
- Run `npm install` first to ensure archiver is installed
- Check you have write permissions in parent directory

### Clear script doesn't work
- Make sure you're in the project root
- Check file permissions
- The script will ask for confirmation - type `yes`

### Packaged project doesn't work
- Make sure to run `npm install` in the packaged folder
- Check that all files were copied correctly
- See SETUP.md in the packaged folder
