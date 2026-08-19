"use client";

import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/presentation/contexts/LanguageContext";
import { ReviewsProvider } from "@/presentation/contexts/ReviewsContext";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <ReviewsProvider>{children}</ReviewsProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}