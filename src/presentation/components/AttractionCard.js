import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  addToWishlist,
  removeFromWishlist,
} from "@/business/services/wishlistService";

export default function AttractionCard({ attraction }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const coverPhoto = attraction.photos?.[0];
  const combinedRating = attraction.combinedRating ?? attraction.rating ?? 0;
  const chatlasReviewCount = attraction.chatlasReviewCount ?? 0;
  const googleReviewCount = attraction.googleReviewCount ?? attraction.totalReviews ?? 0;

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (session && attraction._id) {
      fetch(`/api/collection/wishlist?attractionId=${attraction._id}`)
        .then(res => res.json())
        .then(data => {
          setIsInWishlist(data.inWishlist || false);
        })
        .catch(err => {
          console.error("Error checking wishlist:", err);
        });
    }
  }, [session, attraction._id]);

  useEffect(() => {
    const handleWishlistUpdate = () => {
      if (session && attraction._id) {
        fetch(`/api/collection/wishlist?attractionId=${attraction._id}`)
          .then(res => res.json())
          .then(data => {
            setIsInWishlist(data.inWishlist || false);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
  }, [session, attraction._id]);

  const handleWishlistToggle = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!session) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      if (isInWishlist) {
        await removeFromWishlist(attraction._id);
        setIsInWishlist(false);
        showToast("Removed from wishlist", "info");
        window.dispatchEvent(new CustomEvent('wishlistUpdated'));
      } else {
        await addToWishlist(attraction._id);
        setIsInWishlist(true);
        showToast("Added to wishlist! ❤️", "success");
        window.dispatchEvent(new CustomEvent('wishlistUpdated'));
      }
    } catch (error) {
      console.error("Error toggling wishlist:", error);
      fetch(`/api/collection/wishlist?attractionId=${attraction._id}`)
        .then(res => res.json())
        .then(data => {
          setIsInWishlist(data.inWishlist || false);
        })
        .catch(() => {});
      const errorMsg = error.response?.data?.message || "Unable to update wishlist.";
      showToast(errorMsg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link
        href={`/attractions/${attraction._id}`}
        className="block"
      >
        {coverPhoto ? (
          <div className="relative h-44 w-full">
            <Image
              src={coverPhoto}
              alt={attraction.name}
              fill
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-44 items-center justify-center bg-gray-100">
            <span className="text-5xl">📍</span>
          </div>
        )}

        <div className="p-5">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            {attraction.category || "Uncategorized"}
          </span>

          {attraction.submittedBy && (
            <span className="ml-2 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              Added by a Chatlas user
            </span>
          )}

          <h2 className="mt-3 text-xl font-bold text-gray-900">
            {attraction.name}
          </h2>

          <p className="mt-2 line-clamp-2 text-sm text-gray-600">
            {attraction.address}
          </p>

          <div className="mt-4">
            <span className="font-semibold text-amber-500">
              ★ {combinedRating.toFixed(1)}
            </span>

            <p className="mt-1 text-xs text-gray-500">
              {chatlasReviewCount.toLocaleString()} on Chatlas, {googleReviewCount.toLocaleString()} on Google Maps
            </p>
          </div>
        </div>
      </Link>

      <button
        onClick={handleWishlistToggle}
        disabled={isLoading}
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-md hover:shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 disabled:opacity-50"
        title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
      >
        <svg
          className="w-5 h-5"
          fill={isInWishlist ? "#C2413B" : "none"}
          stroke={isInWishlist ? "#C2413B" : "#65748A"}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </button>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ${
          toast.type === "success" ? "bg-[#16845B] text-white" :
          toast.type === "error" ? "bg-[#C2413B] text-white" :
          "bg-[#2F6DA1] text-white"
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}