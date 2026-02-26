import { parseCSVLine } from '../../utils/csv';
import { GID, csvUrl } from '../../constants/sheets';
import type { ShopItem } from '../../types/shop';
export type { ShopItem, CartItem } from '../../types/shop';

const shopCsvUrl = () => csvUrl(GID.SHOP);

export function parseCSV(csv: string): ShopItem[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const idIdx = headers.indexOf('productid');
  const nameIdx = headers.indexOf('product name');
  const priceIdx = headers.indexOf('price');
  const stockIdx = headers.indexOf('piece');
  const descIdx = headers.indexOf('description');
  const imageIdx = headers.indexOf('image url');

  if (idIdx === -1 || nameIdx === -1 || priceIdx === -1 || stockIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const stockValue = cols[stockIdx]?.toLowerCase();
    const isUnlimited = stockValue === 'infinity' || stockValue === 'unlimited';

    // Process image URL - convert Google Drive URLs to direct view URLs
    let imageUrl = cols[imageIdx] || '';
    if (imageUrl && imageUrl.includes('drive.google.com')) {
      // Remove query parameters from URL
      imageUrl = imageUrl.split('?')[0];
      // Extract file ID from Google Drive URL (supports /d/ID format)
      const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1];
        // Use CORS proxy to bypass Google Drive CORS restrictions
        // Properly encode the Google Drive export URL for the proxy
        const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
        const encodedUrl = encodeURIComponent(driveUrl);
        imageUrl = `https://images.weserv.nl/?url=${encodedUrl}&w=300&h=300&fit=cover`;
        console.log(`Converted image URL: ${fileId} -> ${imageUrl}`);
      }
    }

    return {
      itemId: cols[idIdx] || '',
      name: cols[nameIdx] || '',
      price: parseFloat(cols[priceIdx]) || 0,
      stock: isUnlimited ? -1 : parseInt(cols[stockIdx]) || 0,
      category: isUnlimited ? 'General' : 'Limited',
      description: cols[descIdx] || '',
      imageUrl,
    };
  }).filter(item => item.itemId);
}

export async function fetchShopItems(): Promise<ShopItem[]> {
  const res = await fetch(shopCsvUrl());
  const text = await res.text();
  return parseCSV(text);
}
