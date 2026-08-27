"use client";

import { useState, useEffect, useCallback } from "react";
import { ReceiptHistoryCard } from "@/components/history/ReceiptHistoryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Receipt, Loader2, X } from "@/components/ui/icons";

interface ReceiptItem {
  id: string;
  title: string;
  date: string | null;
  totalAmount: number;
  itemCount: number;
  participantCount?: number;
  tripName: string | null;
  tripId: string | null;
  createdAt: string;
  expiresAt?: string | null;
  type?: string;
}

export function ReceiptHistoryList() {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search keystrokes to avoid hammering /api/receipts on every char.
  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const fetchReceipts = useCallback(
    async (pageNum: number, searchQuery: string, append: boolean = false) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: "20",
        });
        if (searchQuery) params.set("search", searchQuery);

        const res = await fetch(`/api/receipts?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        setReceipts((prev) => (append ? [...prev, ...data.data] : data.data));
        setHasMore(data.hasMore);
        setTotal(data.total);
      } catch {
        // If API fails, show empty state
        if (!append) setReceipts([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setPage(1);
    fetchReceipts(1, debouncedSearch);
  }, [debouncedSearch, fetchReceipts]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReceipts(nextPage, search, true);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search by receipt or trip name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-12"
          aria-label="Search receipts"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="touch-manipulation absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results count */}
      {!isLoading && total > 0 && (
        <p className="text-xs text-muted-foreground">
          {total} receipt{total !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Loading */}
      {isLoading && receipts.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && receipts.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Receipt className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search ? "No receipts match your search" : "No receipts yet"}
          </p>
          {!search && (
            <p className="text-xs text-muted-foreground mt-1">
              Split a bill to see it here
            </p>
          )}
        </div>
      )}

      {/* Receipt list */}
      <div className="space-y-2">
        {receipts.map((receipt) => (
          <ReceiptHistoryCard
            key={receipt.id}
            id={receipt.id}
            title={receipt.title}
            date={receipt.date}
            totalAmount={receipt.totalAmount}
            itemCount={receipt.itemCount}
            participantCount={receipt.participantCount}
            tripName={receipt.tripName}
            createdAt={receipt.createdAt}
            expiresAt={receipt.expiresAt}
            type={receipt.type}
          />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="text-center pt-2">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
