export interface InventoryItem {
  sku: string;
  name: string;
  category: string;
  stock: number;
  price: number;
}

export type SortKey = "sku" | "name" | "category" | "stock" | "price";

export interface InventoryResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: string[];
}
