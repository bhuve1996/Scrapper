import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebsiteData {
  pages: PageData[];
  assets: {
    images: Asset[];
    css: Asset[];
    js: Asset[];
    fonts: Asset[];
    favicon?: {
      url: string;
      rel: string;
      sizes: string;
      type: string;
      localPath?: string;
    } | null;
  };
  structure: {
    components: Component[];
    routes: Route[];
  };
}

export interface PageData {
  url: string;
  originalHTML: string;
  renderedHTML: string;
  structure: PageStructure;
}

export interface PageStructure {
  url: string;
  title: string;
  meta: {
    description: string;
    keywords: string;
    author: string;
    robots: string;
    viewport: string;
    charset: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    ogUrl: string;
    ogType: string;
    ogSiteName: string;
    ogLocale: string;
    twitterCard: string;
    twitterTitle: string;
    twitterDescription: string;
    twitterImage: string;
    twitterSite: string;
    twitterCreator: string;
    canonical: string;
    themeColor: string;
    appleMobileWebAppCapable: string;
    appleMobileWebAppStatusBarStyle: string;
    lang: string;
  };
  sections: Section[];
  components: Component[];
}

export interface Section {
  tag: string;
  id: string;
  className: string;
  text: string;
  children: number;
}

export interface Component {
  name: string;
  selector: string;
  count: number;
}

export interface Route {
  url: string;
  path: string;
  title: string;
}

export interface Asset {
  url: string;
  alt?: string;
  page?: string;
  localPath?: string;
}

let cachedData: WebsiteData | null = null;

export async function loadWebsiteData(): Promise<WebsiteData> {
  if (cachedData) {
    return cachedData;
  }

  const dataPath = path.join(__dirname, "../../scraped-data/website-data.json");
  
  try {
    const data = await fs.promises.readFile(dataPath, "utf-8");
    cachedData = JSON.parse(data) as WebsiteData;
    return cachedData;
  } catch (error) {
    throw new Error(`Failed to load website data: ${error}`);
  }
}

export async function getPageByUrl(url: string): Promise<PageData | null> {
  const data = await loadWebsiteData();
  return data.pages.find(page => page.url === url) || null;
}

export async function getPageByPath(pathname: string): Promise<PageData | null> {
  const data = await loadWebsiteData();
  return data.pages.find(page => {
    try {
      const pageUrl = new URL(page.url);
      return pageUrl.pathname === pathname;
    } catch {
      return false;
    }
  }) || null;
}

export async function getAllRoutes(): Promise<Route[]> {
  const data = await loadWebsiteData();
  return data.structure.routes;
}

export async function getAssets() {
  const data = await loadWebsiteData();
  return data.assets;
}

export async function getImages() {
  const data = await loadWebsiteData();
  return data.assets.images;
}

export async function getCSS() {
  const data = await loadWebsiteData();
  return data.assets.css;
}

export async function getJS() {
  const data = await loadWebsiteData();
  return data.assets.js;
}

export async function getComponents(): Promise<Component[]> {
  const data = await loadWebsiteData();
  return data.structure.components;
}
