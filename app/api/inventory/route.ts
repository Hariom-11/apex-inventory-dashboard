import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES, getInventory } from "@/lib/mockData";
import type { InventoryResponse, SortKey } from "@/lib/types";

const SORT_KEYS: SortKey[] = ["sku", "name", "category", "stock", "price"];

function toNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * GET /api/inventory
 * Query: page, pageSize, search, category, maxStock, minPrice, maxPrice, sortBy, sortDir
 * All filtering, sorting and pagination happens here, never in the browser.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const pageSize = clamp(Math.floor(toNumber(p.get("pageSize")) ?? 50), 1, 100);
  const requestedPage = Math.max(1, Math.floor(toNumber(p.get("page")) ?? 1));
  const terms = (p.get("search") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const category = p.get("category") ?? "";
  const maxStock = toNumber(p.get("maxStock"));
  const minPrice = toNumber(p.get("minPrice"));
  const maxPrice = toNumber(p.get("maxPrice"));
  const sortBy = SORT_KEYS.find((k) => k === p.get("sortBy")) ?? null;
  const dir = p.get("sortDir") === "desc" ? -1 : 1;

  const rows = getInventory().filter(
    (r) =>
      (!category || r.category === category) &&
      (maxStock === null || r.stock <= maxStock) &&
      (minPrice === null || r.price >= minPrice) &&
      (maxPrice === null || r.price <= maxPrice) &&
      terms.every((t) => r.searchText.includes(t)),
  );

  if (sortBy) {
    // Array.sort is stable, so equal values keep SKU order.
    rows.sort((a, b) => {
      const x = a[sortBy];
      const y = b[sortBy];
      return x < y ? -dir : x > y ? dir : 0;
    });
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  const body: InventoryResponse = {
    items: rows.slice(start, start + pageSize).map(({ searchText, ...item }) => item),
    total,
    page,
    pageSize,
    totalPages,
    categories: [...CATEGORIES],
  };

  // Small artificial delay so loading states are visible in development.
  await new Promise((resolve) => setTimeout(resolve, 120));
  return NextResponse.json(body);
}
