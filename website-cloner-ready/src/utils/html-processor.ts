import * as cheerio from "cheerio";
import { getAssets } from "./data-loader";

export async function processHTML(html: string): Promise<string> {
  const $ = cheerio.load(html);
  const assets = await getAssets();

  // Create a mapping of original URLs to local paths
  const imageMap = new Map();
  const pathMap = new Map(); // Map by path patterns from Next.js URLs
  
  // Find SVG file for logo replacement
  const svgFile = assets.images.find(img => img.localPath && img.localPath.endsWith('.svg'));
  
  assets.images.forEach((img, index) => {
    if (img.localPath) {
      // Map by full URL
      imageMap.set(img.url, img.localPath);
      
      // Extract path from Next.js URLs
      if (img.url.includes("/_next/image?url=")) {
        try {
          const match = img.url.match(/url=([^&]+)/);
          if (match) {
            const decodedPath = decodeURIComponent(match[1]);
            // For logo SVG, use the actual SVG file instead of optimized JPG
            if (decodedPath.includes("windscribe-logo-full.svg") && svgFile) {
              pathMap.set(decodedPath, svgFile.localPath);
              imageMap.set(img.url, svgFile.localPath); // Override with SVG
            } else {
              pathMap.set(decodedPath, img.localPath);
            }
            // Also map by filename
            const filename = decodedPath.split("/").pop();
            if (filename) {
              if (filename.includes("windscribe-logo-full.svg") && svgFile) {
                imageMap.set(filename, svgFile.localPath);
                pathMap.set(`/${filename}`, svgFile.localPath);
              } else {
                imageMap.set(filename, img.localPath);
                pathMap.set(`/${filename}`, img.localPath);
              }
            }
          }
        } catch {}
      }
      
      // Map by filename
      const filename = img.url.split("/").pop()?.split("?")[0];
      if (filename) {
        imageMap.set(filename, img.localPath);
        // Also try without extension
        const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
        if (nameWithoutExt) {
          imageMap.set(nameWithoutExt, img.localPath);
        }
      }
      
      // Map by index for fallback
      imageMap.set(`image_${index}`, img.localPath);
    }
  });

  // Helper function to extract image path from Next.js URL
  function extractImagePathFromNextUrl(url: string): string | null {
    if (url.includes("/_next/image?url=")) {
      try {
        const match = url.match(/url=([^&]+)/);
        if (match) {
          const decoded = decodeURIComponent(match[1]);
          // Remove leading slash if present for matching
          return decoded.startsWith("/") ? decoded : `/${decoded}`;
        }
      } catch {}
    }
    return null;
  }

  // Helper function to find matching image
  function findMatchingImage(src: string, alt?: string, width?: string, height?: string): string | null {
    if (!src) return null;

    // Skip data URIs
    if (src.startsWith("data:")) {
      return null;
    }

    // Check if this is a small icon (16-32px) - should use SVG/PNG
    const isSmallIcon = (width && parseInt(width) <= 32) || (height && parseInt(height) <= 32);
    
    // Check if this is a logo (by alt text or URL)
    const isLogo = (alt && alt.toLowerCase().includes("windscribe")) || 
                   src.toLowerCase().includes("logo");

    // Handle Next.js image URLs
    const nextImagePath = extractImagePathFromNextUrl(src);
    if (nextImagePath) {
      // For logo SVG, find the actual logo SVG file
      if (nextImagePath.includes("windscribe-logo-full.svg")) {
        // First try to find image_0.svg (the logo)
        const logoFile = assets.images.find(img => 
          img.localPath && (img.localPath.includes('image_0.svg') || 
                          (img.url.includes('windscribe-logo') && img.localPath.endsWith('.svg')))
        );
        if (logoFile && logoFile.localPath) {
          return logoFile.localPath;
        }
        // Fallback to any SVG
        const svgFile = assets.images.find(img => 
          img.localPath && img.localPath.endsWith('.svg')
        );
        if (svgFile && svgFile.localPath) {
          return svgFile.localPath;
        }
      }
      
      // For small icons, prioritize SVG/PNG files
      if (isSmallIcon && !isLogo) {
        // First try direct path match from pathMap
        if (pathMap.has(nextImagePath)) {
          const matched = pathMap.get(nextImagePath);
          // Only use if it's not the logo
          if (matched && !matched.includes('image_0.svg')) {
            return matched;
          }
        }
        
        // Extract filename from Next.js path
        const iconFilename = nextImagePath.split("/").pop() || "";
        const iconNameWithoutExt = iconFilename.replace(/\.[^.]+$/, "");
        
        // Try to find matching SVG/PNG by filename (excluding logo)
        const svgPngMatch = assets.images.find(img => {
          if (!img.localPath || (!img.localPath.endsWith('.svg') && !img.localPath.endsWith('.png'))) {
            return false;
          }
          // Skip logo
          if (img.localPath.includes('image_0.svg') || img.url.includes('windscribe-logo')) {
            return false;
          }
          // Check if URL or localPath contains the icon name
          const imgFilename = img.url.split("/").pop()?.split("?")[0] || "";
          const imgNameWithoutExt = imgFilename.replace(/\.[^.]+$/, "");
          return imgFilename.includes(iconFilename) || 
                 iconFilename.includes(imgFilename) ||
                 imgNameWithoutExt.includes(iconNameWithoutExt) ||
                 iconNameWithoutExt.includes(imgNameWithoutExt) ||
                 img.url.includes(iconFilename) ||
                 nextImagePath.includes(imgFilename);
        });
        
        if (svgPngMatch && svgPngMatch.localPath) {
          return svgPngMatch.localPath;
        }
      }
      
      // For logos, prioritize SVG files first
      if (isLogo && nextImagePath.includes("svg")) {
        const svgMatch = assets.images.find(img => 
          img.localPath && img.localPath.endsWith('.svg')
        );
        if (svgMatch && svgMatch.localPath) {
          return svgMatch.localPath;
        }
      }
      
      // Direct path match
      if (pathMap.has(nextImagePath)) {
        return pathMap.get(nextImagePath) || null;
      }
      
      // Try filename match (prioritize exact matches)
      const filename = nextImagePath.split("/").pop();
      if (filename) {
        // Exact filename match
        if (imageMap.has(filename)) {
          return imageMap.get(filename) || null;
        }
        
        // For SVG files, find SVG asset
        if (filename.endsWith('.svg')) {
          const svgMatch = assets.images.find(img => 
            img.localPath && img.localPath.endsWith('.svg')
          );
          if (svgMatch && svgMatch.localPath) {
            return svgMatch.localPath;
          }
        }
        
        // Try without extension
        const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
        if (nameWithoutExt) {
          // For logo, prioritize SVG files
          if (nameWithoutExt.toLowerCase().includes("logo") || isLogo) {
            const svgMatch = assets.images.find(img => 
              img.localPath && (img.localPath.endsWith('.svg') || img.url.includes('logo'))
            );
            if (svgMatch && svgMatch.localPath) {
              return svgMatch.localPath;
            }
          }
          
          if (imageMap.has(nameWithoutExt)) {
            return imageMap.get(nameWithoutExt) || null;
          }
        }
        
        // Try partial filename match
        for (const [originalUrl, localPath] of imageMap.entries()) {
          if (originalUrl.toLowerCase().includes(filename.toLowerCase()) || 
              filename.toLowerCase().includes(originalUrl.split("/").pop()?.toLowerCase() || "")) {
            return localPath;
          }
        }
      }
      
      // Try partial path match
      for (const [path, localPath] of pathMap.entries()) {
        if (nextImagePath.includes(path) || path.includes(nextImagePath)) {
          return localPath;
        }
      }
      
      // Try to match the extracted path in original URLs
      for (const [originalUrl, localPath] of imageMap.entries()) {
        if (originalUrl.includes(nextImagePath) || nextImagePath.includes(originalUrl.split("/").pop() || "")) {
          return localPath;
        }
      }
    }

    // Extract clean URL (remove query params and fragments)
    let cleanSrc = src.split("?")[0].split("#")[0];
    let filename = cleanSrc.split("/").pop() || "";

    // Try direct match first
    if (imageMap.has(src)) {
      return imageMap.get(src) || null;
    }

    // Try clean URL match
    if (imageMap.has(cleanSrc)) {
      return imageMap.get(cleanSrc) || null;
    }

    // Try filename match
    if (filename && imageMap.has(filename)) {
      return imageMap.get(filename) || null;
    }

    // Try to match by URL pathname
    try {
      if (src.startsWith("http")) {
        const url = new URL(src);
        const pathname = url.pathname;
        for (const [originalUrl, localPath] of imageMap.entries()) {
          try {
            const origUrl = new URL(originalUrl);
            if (origUrl.pathname === pathname) {
              return localPath;
            }
          } catch {}
        }
      }
    } catch {}

    // Try partial URL match
    for (const [originalUrl, localPath] of imageMap.entries()) {
      if (originalUrl.includes(cleanSrc) || cleanSrc.includes(originalUrl) || 
          originalUrl.includes(filename) || filename.includes(originalUrl.split("/").pop() || "")) {
        return localPath;
      }
    }

    // If src contains "image_" pattern, try to match by index
    const indexMatch = src.match(/image[_-]?(\d+)/i);
    if (indexMatch) {
      const index = parseInt(indexMatch[1]);
      if (assets.images[index] && assets.images[index].localPath) {
        return assets.images[index].localPath;
      }
    }

    return null;
  }

  // Fix image paths
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    const alt = $(el).attr("alt") || "";
    const width = $(el).attr("width");
    const height = $(el).attr("height");
    const matchingPath = findMatchingImage(src || "", alt, width, height);
    
    if (matchingPath) {
      $(el).attr("src", `/${matchingPath}`);
      
      // Also fix srcset if present
      const srcset = $(el).attr("srcset");
      if (srcset) {
        // Replace all Next.js URLs in srcset with the matching path
        const newSrcset = srcset.split(",").map(set => {
          const [url] = set.trim().split(" ");
          const match = findMatchingImage(url, alt, width, height);
          if (match) {
            const descriptor = set.trim().split(" ").slice(1).join(" ");
            return `/${match}${descriptor ? " " + descriptor : ""}`;
          }
          return set.trim();
        }).join(", ");
        $(el).attr("srcset", newSrcset);
      }
    }
  });

  // Fix CSS links
  $("link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("http")) return;

    const css = assets.css.find(c => {
      try {
        const cssUrl = new URL(c.url);
        return cssUrl.pathname === href || c.url.includes(href);
      } catch {
        return c.url.includes(href);
      }
    });

    if (css && css.localPath) {
      $(el).attr("href", `/${css.localPath}`);
    }
  });

  // Fix JS script sources
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src || src.startsWith("http")) return;

    const js = assets.js.find(j => {
      try {
        const jsUrl = new URL(j.url);
        return jsUrl.pathname === src || j.url.includes(src);
      } catch {
        return j.url.includes(src);
      }
    });

    if (js && js.localPath) {
      $(el).attr("src", `/${js.localPath}`);
    }
  });

  return $.html();
}
