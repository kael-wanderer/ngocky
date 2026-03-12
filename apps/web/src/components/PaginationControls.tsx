import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function getVisiblePages(currentPage: number, totalPages: number) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    const pages = new Set<number>([1, totalPages]);

    for (let page = start; page <= end; page += 1) {
        pages.add(page);
    }

    return Array.from(pages).sort((a, b) => a - b);
}

export default function PaginationControls({
    page,
    totalPages,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
}: {
    page: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}) {
    if (totalPages <= 0) return null;

    const pages = getVisiblePages(page, totalPages);

    return (
        <div className="flex flex-col gap-3 border-t border-gray-200 dark:border-gray-700 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span>Items per page</span>
                <select
                    value={pageSize}
                    onChange={(event) => onPageSizeChange(Number(event.target.value))}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <span>{totalItems} total</span>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                </button>

                <div className="flex items-center gap-1">
                    {pages.map((pageNumber, index) => {
                        const previous = pages[index - 1];
                        const showGap = previous && pageNumber - previous > 1;

                        return (
                            <React.Fragment key={pageNumber}>
                                {showGap && <span className="px-2 text-sm text-gray-400">…</span>}
                                <button
                                    type="button"
                                    onClick={() => onPageChange(pageNumber)}
                                    className={`min-w-9 rounded-lg px-3 py-1.5 text-sm ${
                                        pageNumber === page
                                            ? 'bg-blue-600 text-white'
                                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {pageNumber}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
