"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

function LoginForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  useEffect(() => {
    if (session) {
      router.push(callbackUrl);
    }
  }, [session, router, callbackUrl]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google", { redirectTo: callbackUrl });
    } catch (err) {
      setError(t("googleAuthFailed"));
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#F7F9FB]">
        <div className="text-[#006C56]">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center bg-gradient-to-b from-[#E8F5F0] via-[#F7F9FB] to-[#F7F9FB] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#D8E1E7] bg-white p-8 text-center shadow-lg sm:p-10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">
          📍
        </div>

        <h1 className="mb-2 text-3xl font-bold text-[#006C56]">Chatlas</h1>
        <p className="mb-2 text-[#405066]">{t("loginSubtitle")}</p>
        <p className="mb-8 text-sm text-[#65748A]">{t("loginGuestHint")}</p>

        {error && (
          <div className="mb-4 rounded-lg bg-[#FDECEC] p-3 text-sm text-[#C2413B]">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8E1E7] bg-white px-4 py-3 text-[#10213B] shadow-sm transition hover:bg-[#F7F9FB] disabled:opacity-50"
        >
          {isLoading ? (
            t("signingIn")
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.87 7.35 2.56 10.56l7.97-5.97z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.97C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              {t("signInWithGoogle")}
            </>
          )}
        </button>

        <Link
          href="/"
          className="mt-5 inline-block text-sm font-semibold text-[#006C56] hover:underline"
        >
          {t("continueAsGuest")}
        </Link>

        <p className="mt-6 text-xs text-[#98A2B3]">{t("termsAgree")}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#F7F9FB]">
          <div className="text-[#006C56]">...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}