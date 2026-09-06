"use client";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  ariaLabel,
  getPageAriaLabel,
  previousLabel,
  nextLabel,
}) {
  if (totalPages <= 1) return null;

  const paginationItems = createPaginationItems(page, totalPages);

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {previousLabel}
      </button>

      {paginationItems.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="inline-flex h-11 min-w-8 items-center justify-center text-attraction-muted"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={getPageAriaLabel(item)}
            aria-current={item === page ? "page" : undefined}
            className={`inline-flex h-11 min-w-11 items-center justify-center rounded-[10px] border px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary ${
              item === page
                ? "border-attraction-primary bg-attraction-primary text-white shadow-sm"
                : "border-attraction-border-strong bg-white text-attraction-body hover:bg-attraction-surface-soft"
            }`}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </nav>
  );
}

function createPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set([1, totalPages]);

  if (currentPage <= 4) {
    [2, 3, 4, 5].forEach((visiblePage) => visiblePages.add(visiblePage));
  } else if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach(
      (visiblePage) => visiblePages.add(visiblePage)
    );
  } else {
    [currentPage - 1, currentPage, currentPage + 1].forEach((visiblePage) =>
      visiblePages.add(visiblePage)
    );
  }

  const sortedPages = [...visiblePages].sort((first, second) => first - second);
  const items = [];

  sortedPages.forEach((visiblePage, index) => {
    if (index > 0 && visiblePage - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(visiblePage);
  });

  return items;
}
