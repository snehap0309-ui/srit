"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  page,
  totalPages,
  hasNext,
  hasPrev,
  onPageChange,
  emptyMessage = "No data found",
  totalRecords,
  showFirstLast = false,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  page?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
  totalRecords?: number;
  showFirstLast?: boolean;
}) {
  const getPageNumbers = () => {
    if (!page || !totalPages) return [];
    
    const maxPagesToShow = 5;
    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold text-gray-600 ${
                    col.className || ""
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, i) => (
                <tr
                  key={(item.id as string) || i}
                  className="transition hover:bg-gray-50"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.className || ""}`}
                    >
                      {col.render
                        ? col.render(item)
                        : (item[col.key] as React.ReactNode) || "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages && totalPages > 1 && onPageChange && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 px-4 py-3 gap-4">
          <p className="text-sm text-gray-500">
            {totalRecords !== undefined ? (
              <>Showing <span className="font-medium">{Math.min(((page || 1) - 1) * 15 + 1, totalRecords)}</span> to <span className="font-medium">{Math.min((page || 1) * 15, totalRecords)}</span> of <span className="font-medium">{totalRecords}</span> records</>
            ) : (
              <>Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span></>
            )}
          </p>
          <div className="flex gap-1 items-center">
            {showFirstLast && (
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => onPageChange(1)}
                aria-label="First page"
                title="First page"
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronsLeft size={16} />
              </button>
            )}
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => onPageChange((page || 1) - 1)}
              aria-label="Previous page"
              title="Previous page"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            
            {getPageNumbers().map(p => (
              <button
                type="button"
                key={p}
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                  p === page 
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200" 
                    : "text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              disabled={!hasNext}
              onClick={() => onPageChange((page || 1) + 1)}
              aria-label="Next page"
              title="Next page"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
            {showFirstLast && (
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => onPageChange(totalPages)}
                aria-label="Last page"
                title="Last page"
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronsRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
