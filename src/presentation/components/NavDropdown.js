"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const DEFAULT_TRIGGER_CLASSNAME = "flex items-center gap-2 focus:outline-none";
const DEFAULT_MENU_CLASSNAME =
  "absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg";
const DEFAULT_ITEM_CLASSNAME = "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50";

// Reusable header nav dropdown - originally the profile menu's hand-rolled
// isOpen state + conditional render, extracted so the Attractions menu can
// reuse the same open/close behavior. Each item is either a Link (has
// href) or an action button (has onClick, e.g. Logout) - both close the
// menu on selection, same as the original profile menu did explicitly.
export default function NavDropdown({
  trigger,
  triggerClassName = DEFAULT_TRIGGER_CLASSNAME,
  items,
  menuClassName = DEFAULT_MENU_CLASSNAME,
  itemClassName = DEFAULT_ITEM_CLASSNAME,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button type="button" onClick={() => setIsOpen((current) => !current)} className={triggerClassName}>
        {trigger}
      </button>

      {isOpen && (
        <div className={menuClassName}>
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.key ?? item.label}
                href={item.href}
                className={item.className ?? itemClassName}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.key ?? item.label}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  item.onClick?.();
                }}
                className={item.className ?? itemClassName}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
