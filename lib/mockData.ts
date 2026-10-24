import type { InventoryItem } from "./types";

/**
 * Deterministic mock dataset of 50,000 SKUs.
 * Replace the API route with your real backend when it is ready.
 */
export const CATEGORIES = [
  "Electronics",
  "Home & Kitchen",
  "Tools & Hardware",
  "Office Supplies",
  "Sporting Goods",
  "Toys & Games",
  "Automotive",
  "Health & Beauty",
] as const;

const CATEGORY_CODES = ["ELC", "HMK", "TLH", "OFS", "SPG", "TYG", "AUT", "HLB"];

const PRODUCTS: Record<(typeof CATEGORIES)[number], string[]> = {
  Electronics: ["Wireless Headphones", "Bluetooth Speaker", "USB-C Cable", "Power Bank", "Webcam", "Smart Plug", "Wireless Mouse", "Mechanical Keyboard"],
  "Home & Kitchen": ["Chef Knife", "Cast Iron Skillet", "Storage Container Set", "Electric Kettle", "Cutting Board", "Dish Rack", "Coffee Grinder", "Bath Towel Set"],
  "Tools & Hardware": ["Cordless Drill", "Socket Set", "Tape Measure", "Work Gloves", "Utility Knife", "Level", "Adjustable Wrench", "Safety Goggles"],
  "Office Supplies": ["Legal Pad", "Gel Pen Pack", "Desk Organizer", "Stapler", "Label Maker", "Binder Clips", "Whiteboard Markers", "File Folders"],
  "Sporting Goods": ["Yoga Mat", "Resistance Bands", "Water Bottle", "Camping Lantern", "Jump Rope", "Soccer Ball", "Hiking Backpack", "Fishing Line"],
  "Toys & Games": ["Building Block Set", "Puzzle 1000pc", "Card Game", "Plush Bear", "Remote Control Car", "Board Game", "Art Supply Kit", "Play Dough Pack"],
  Automotive: ["Wiper Blades", "Floor Mats", "Jumper Cables", "Tire Gauge", "Phone Mount", "Air Freshener", "Oil Filter", "Car Wash Kit"],
  "Health & Beauty": ["Sunscreen SPF 50", "Electric Toothbrush", "Hair Dryer", "First Aid Kit", "Hand Cream", "Shampoo", "Vitamin C Serum", "Razor Set"],
};

const MODIFIERS = ["Pro", "Lite", "Classic", "Compact", "Heavy Duty", "Premium", "Essential", "Deluxe", "Travel", "Studio", "Home", "Max"];

export const TOTAL_SKUS = 50_000;

export interface InventoryRow extends InventoryItem {
  /** Lower-cased name + sku, precomputed so search stays fast. */
  searchText: string;
}

// Small seeded PRNG so the dataset is identical on every server start.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(): InventoryRow[] {
  const rand = mulberry32(20240607);
  const rows: InventoryRow[] = [];
  for (let i = 0; i < TOTAL_SKUS; i++) {
    const catIndex = Math.floor(rand() * CATEGORIES.length);
    const category = CATEGORIES[catIndex];
    const products = PRODUCTS[category];
    const product = products[Math.floor(rand() * products.length)];
    const modifier = MODIFIERS[Math.floor(rand() * MODIFIERS.length)];
    const name = `${modifier} ${product}`;
    const sku = `APX-${CATEGORY_CODES[catIndex]}-${String(i + 1).padStart(5, "0")}`;
    const stock = Math.floor(rand() ** 2 * 501); // skewed low, so "low stock" is common
    const price = Math.round((4 + rand() ** 3 * 496) * 100) / 100;
    rows.push({ sku, name, category, stock, price, searchText: `${name} ${sku}`.toLowerCase() });
  }
  return rows;
}

// Cache on globalThis so dev-mode hot reloads don't regenerate 50k rows.
const g = globalThis as unknown as { __apexInventory?: InventoryRow[] };

export function getInventory(): InventoryRow[] {
  if (!g.__apexInventory) g.__apexInventory = generate();
  return g.__apexInventory;
}
