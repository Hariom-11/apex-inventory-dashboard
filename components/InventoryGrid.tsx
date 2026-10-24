"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { FILTER_DEBOUNCE_MS, PAGE_SIZE, SEARCH_DEBOUNCE_MS, STOCK_MAX } from "@/lib/constants";
import type { InventoryItem, InventoryResponse } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const NUMERIC_COLUMNS = new Set(["stock", "price"]);
const EMPTY: InventoryItem[] = [];

const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wraps every search term found in `text` in <mark>. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}
    </>
  );
}

const formatMoney = (v: string) => currency.format(Number(v));

function StockCell({ value }: { value: number }) {
  const level = value < 20 ? "low" : value < 100 ? "mid" : "ok";
  return (
    <span className="stock">
      <span className={`stock-tag stock-tag-${level}`}>{value === 0 ? "Out" : value < 20 ? "Low" : ""}</span>
      <span className="stock-value">{value.toLocaleString()}</span>
      <span className={`gauge gauge-${level}`} aria-hidden="true">
        <span style={{ width: `${Math.min(100, (value / STOCK_MAX) * 100)}%` }} />
      </span>
    </span>
  );
}

async function fetchInventory(query: string, signal: AbortSignal): Promise<InventoryResponse> {
  const res = await fetch(`/api/inventory?${query}`, { signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export default function InventoryGrid() {
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [maxStock, setMaxStock] = useState(STOCK_MAX);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [compact, setCompact] = useState(false);

  // Search waits 500ms after the last keystroke; other filters wait a shorter time.
  const search = useDebounce(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const dMaxStock = useDebounce(maxStock, FILTER_DEBOUNCE_MS);
  const dMinPrice = useDebounce(minPrice, FILTER_DEBOUNCE_MS);
  const dMaxPrice = useDebounce(maxPrice, FILTER_DEBOUNCE_MS);

  const priceInvalid = minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice);
  const terms = useMemo(() => search.split(/\s+/).filter(Boolean), [search]);

  const query = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    if (dMaxStock < STOCK_MAX) q.set("maxStock", String(dMaxStock));
    if (!priceInvalid) {
      if (dMinPrice) q.set("minPrice", dMinPrice);
      if (dMaxPrice) q.set("maxPrice", dMaxPrice);
    }
    if (sorting[0]) {
      q.set("sortBy", sorting[0].id);
      q.set("sortDir", sorting[0].desc ? "desc" : "asc");
    }
    return q.toString();
  }, [page, search, category, dMaxStock, dMinPrice, dMaxPrice, priceInvalid, sorting]);

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["inventory", query],
    queryFn: ({ signal }) => fetchInventory(query, signal),
    placeholderData: keepPreviousData, // keep the old rows on screen while the next page loads
  });

  const columns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      { accessorKey: "sku", header: "SKU", cell: ({ getValue }) => <Highlight text={getValue<string>()} terms={terms} /> },
      { accessorKey: "name", header: "Product", cell: ({ getValue }) => <Highlight text={getValue<string>()} terms={terms} /> },
      { accessorKey: "category", header: "Category" },
      // sortDescFirst: the first click on a numeric column sorts High-to-Low.
      { accessorKey: "stock", header: "Stock", sortDescFirst: true, cell: ({ getValue }) => <StockCell value={getValue<number>()} /> },
      { accessorKey: "price", header: "Price", sortDescFirst: true, cell: ({ getValue }) => currency.format(getValue<number>()) },
    ],
    [terms],
  );

  const items = data?.items ?? EMPTY;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(1);
    },
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    enableMultiSort: false,
    getRowId: (row) => row.sku,
    getCoreRowModel: getCoreRowModel(),
  });

  // Jump back to the top of the grid whenever a new result set arrives.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [query]);

  // Press "/" anywhere to jump to the search box.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const hasFilters = Boolean(searchInput || category || maxStock < STOCK_MAX || minPrice || maxPrice);

  function clearSearch() {
    setSearchInput("");
    setPage(1);
  }
  function clearCategory() {
    setCategory("");
    setPage(1);
  }
  function clearStock() {
    setMaxStock(STOCK_MAX);
    setPage(1);
  }
  function clearPrice() {
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  }
  function clearFilters() {
    setSearchInput("");
    setCategory("");
    setMaxStock(STOCK_MAX);
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  }
  function setStockLimit(value: number) {
    setMaxStock(value);
    setPage(1);
  }

  const stockLabel = maxStock >= STOCK_MAX ? "any" : maxStock === 0 ? "out of stock" : `${maxStock} or fewer`;
  const priceLabel =
    minPrice && maxPrice
      ? `${formatMoney(minPrice)} to ${formatMoney(maxPrice)}`
      : minPrice
        ? `${formatMoney(minPrice)} and up`
        : `up to ${formatMoney(maxPrice || "0")}`;

  const currentPage = data?.page ?? page;
  const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, currentPage * PAGE_SIZE);

  return (
    <div className={`app ${compact ? "is-compact" : ""}`}>
      <header className="topbar">
        <div>
          <p className="brand">Apex Logistics</p>
          <h1>Inventory</h1>
        </div>
        <div className="topbar-right">
          <button type="button" className="btn-toggle" aria-pressed={compact} onClick={() => setCompact((c) => !c)}>
            Compact rows
          </button>
          <p className="count" aria-live="polite">
            {data ? `${total.toLocaleString()} ${total === 1 ? "SKU" : "SKUs"}${hasFilters ? " match" : ""}` : "Loading…"}
          </p>
        </div>
      </header>

      <section className="toolbar" aria-label="Filters">
        <label className="field field-search">
          <span>
            Search <kbd>/</kbd>
          </span>
          <input
            ref={searchRef}
            type="search"
            placeholder="Product name or SKU, e.g. wireless headphones"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchInput) clearSearch();
            }}
          />
        </label>

        <label className="field">
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {(data?.categories ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="field field-slider">
          <label htmlFor="stock-range">
            Stock level: <strong>{stockLabel}</strong>
          </label>
          <input
            id="stock-range"
            type="range"
            min={0}
            max={STOCK_MAX}
            step={1}
            value={maxStock}
            onChange={(e) => setStockLimit(Number(e.target.value))}
          />
          <div className="presets" role="group" aria-label="Stock level shortcuts">
            <button type="button" aria-pressed={maxStock >= STOCK_MAX} onClick={() => setStockLimit(STOCK_MAX)}>
              Any
            </button>
            <button type="button" aria-pressed={maxStock === 19} onClick={() => setStockLimit(19)}>
              Under 20
            </button>
            <button type="button" aria-pressed={maxStock === 0} onClick={() => setStockLimit(0)}>
              Out of stock
            </button>
          </div>
        </div>

        <div className="field field-price">
          <span id="price-label">Price range (USD)</span>
          <div className="price-inputs" role="group" aria-labelledby="price-label">
            <input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Min"
              aria-label="Minimum price"
              aria-invalid={priceInvalid}
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                setPage(1);
              }}
            />
            <span aria-hidden="true">to</span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Max"
              aria-label="Maximum price"
              aria-invalid={priceInvalid}
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {priceInvalid && (
            <span className="field-error" role="alert">
              Minimum is higher than maximum.
            </span>
          )}
        </div>
      </section>

      {hasFilters && (
        <div className="chips" aria-label="Active filters">
          {searchInput && <FilterChip label={`Search: ${searchInput}`} onRemove={clearSearch} />}
          {category && <FilterChip label={`Category: ${category}`} onRemove={clearCategory} />}
          {maxStock < STOCK_MAX && <FilterChip label={`Stock: ${stockLabel}`} onRemove={clearStock} />}
          {(minPrice || maxPrice) && <FilterChip label={`Price: ${priceLabel}`} onRemove={clearPrice} />}
          <button type="button" className="chips-clear" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      <main className="grid-wrap">
        <div className={`progress ${isFetching ? "is-active" : ""}`} aria-hidden="true" />
        <div className="grid-scroll" ref={scrollerRef} aria-busy={isFetching}>
          <table>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const sorted = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        className={NUMERIC_COLUMNS.has(h.id) ? "num" : undefined}
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      >
                        <button type="button" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <span className={`sort-ind ${sorted ? "is-on" : ""}`} aria-hidden="true">
                            {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "↕"}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className={isFetching && !isPending ? "is-stale" : undefined}>
              {isPending &&
                Array.from({ length: 12 }, (_, i) => (
                  <tr key={i} className="skeleton-row">
                    {columns.map((c, n) => (
                      <td key={n}>
                        <span className="skeleton" />
                      </td>
                    ))}
                  </tr>
                ))}
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={row.original.stock === 0 ? "row-out" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={NUMERIC_COLUMNS.has(cell.column.id) ? "num" : undefined}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {isError && (
            <div className="state" role="alert">
              <p>Could not load inventory: {error instanceof Error ? error.message : "unknown error"}.</p>
              <button type="button" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          )}
          {!isPending && !isError && items.length === 0 && (
            <div className="state">
              <p>{search ? `No items match "${search}" with these filters.` : "No items match these filters."}</p>
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="pager">
        <p aria-live="polite">
          {total > 0 ? `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}` : "No results"}
        </p>
        <nav aria-label="Pagination">
          <button type="button" onClick={() => setPage(1)} disabled={currentPage <= 1}>
            First
          </button>
          <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>
            Previous
          </button>
          <span className="page-indicator">
            Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
          </span>
          <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>
            Next
          </button>
          <button type="button" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages}>
            Last
          </button>
        </nav>
      </footer>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="chip">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove filter: ${label}`}>
        ×
      </button>
    </span>
  );
}
