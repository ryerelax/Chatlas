"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function WishlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, translateCategory } = useLanguage();
  const [wishlist, setWishlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [toast, setToast] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/wishlist");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      loadWishlist();
    }
  }, [session]);

  const loadWishlist = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/collection/wishlist");
      const data = await response.json();

      if (data.success) {
        setWishlist(data.data || []);
      } else {
        setError(data.message || t("errorGeneric"));
      }
    } catch (err) {
      setError(t("errorGeneric"));
      console.error("Error loading wishlist:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (attractionId, attractionName) => {
    setIsRemoving(true);
    setRemoveTarget(null);

    try {
      const response = await fetch(
        `/api/collection/wishlist?attractionId=${attractionId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (data.success) {
        setWishlist(
          wishlist.filter((item) => item.attractionId._id !== attractionId)
        );
        window.dispatchEvent(new CustomEvent("wishlistUpdated"));
        showToast(
          `${t("remove")}: ${attractionName || ""}`,
          "success"
        );
      } else {
        showToast(data.message || t("errorGeneric"), "error");
      }
    } catch (err) {
      console.error("Error removing from wishlist:", err);
      showToast(t("errorGeneric"), "error");
    } finally {
      setIsRemoving(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">{t("loading")}</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <p className="mb-4 text-red-500">{error}</p>
        <button
          onClick={loadWishlist}
          className="rounded-lg bg-amber-500 px-4 py-2 text-white hover:bg-amber-600"
        >
          {t("reset")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {toast && (
        <div className="fixed left-1/2 top-6 z-50 w-full max-w-md -translate-x-1/2 transform px-4">
          <div
            className={`animate-in slide-in-from-top-5 flex items-center gap-3 rounded-xl border px-5 py-4 shadow-lg transition-all duration-300 ${
              toast.type === "success"
                ? "border-[#16845B] bg-[#E8F7EF] text-[#004638]"
                : "border-[#C2413B] bg-[#FDECEC] text-[#7A1A1A]"
            }`}
          >
            <span className="flex-1 text-base font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="flex-shrink-0 text-[#65748A] hover:text-[#10213B]"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <div className="w-full max-w-md rounded-[18px] bg-white p-6 shadow-2xl">
            <h3 className="text-center text-xl font-bold text-[#10213B]">
              {t("remove")}?
            </h3>
            <p className="mt-2 text-center text-[#65748A]">
              <span className="font-semibold text-[#10213B]">
                &quot;{removeTarget.name}&quot;
              </span>
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setRemoveTarget(null)}
                className="flex-1 rounded-lg border border-[#BBC8D0] px-5 py-2.5 font-semibold text-[#004638] hover:bg-[#F1F6F4]"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() =>
                  handleRemove(removeTarget.id, removeTarget.name)
                }
                disabled={isRemoving}
                className="flex-1 rounded-lg bg-[#C2413B] px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isRemoving ? t("loading") : t("remove")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#006C56] px-4 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => router.push("/")}
            className="mb-4 flex items-center gap-2 text-white/80 hover:text-white"
          >
            ← {t("backToExplore")}
          </button>
          <h1 className="text-3xl font-bold md:text-4xl">
            {t("wishlistTitle")}
          </h1>
          <p className="mt-2 text-white/80">
            {wishlist.length === 0
              ? t("emptyWishlist")
              : t("attractionsAvailable", { count: wishlist.length })}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-4 py-8">
        {wishlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <h3 className="text-xl font-semibold text-gray-800">
              {t("emptyWishlist")}
            </h3>
            <button
              onClick={() => router.push("/")}
              className="mt-6 rounded-lg bg-amber-500 px-6 py-2 text-white hover:bg-amber-600"
            >
              {t("browseAttractions")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {wishlist.map((item) => (
              <div
                key={item._id}
                className="overflow-hidden rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
              >
                <div className="relative h-48 w-full bg-green-100">
                  {item.attractionId?.photos &&
                  item.attractionId.photos.length > 0 ? (
                    <Image
                      src={item.attractionId.photos[0]}
                      alt={item.attractionId.name || "Attraction"}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-green-600/50">
                      <span>{t("noPhotosYet")}</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="truncate text-lg font-semibold text-gray-900">
                    {item.attractionId?.name || "—"}
                  </h3>
                  <p className="truncate text-sm text-gray-500">
                    {item.attractionId?.category
                      ? translateCategory
                        ? translateCategory(item.attractionId.category)
                        : item.attractionId.category
                      : "—"}
                  </p>
                  <p className="mt-1 truncate text-sm text-gray-400">
                    {item.attractionId?.address || "—"}
                  </p>
                  {item.attractionId?.rating && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-amber-500">★</span>
                      <span className="text-sm font-medium">
                        {item.attractionId.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setRemoveTarget({
                        id: item.attractionId._id,
                        name: item.attractionId?.name || "",
                      });
                    }}
                    className="mt-3 w-full rounded-lg border border-red-200 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
