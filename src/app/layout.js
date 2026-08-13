import Header from "@/presentation/components/Header";
import ServiceWorkerRegistration from "@/presentation/components/ServiceWorkerRegistration";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata = {
  title: "Chatlas",
  description: "Discover attractions and experiences around Melaka.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-gray-50">
        <SessionProvider>
          <ServiceWorkerRegistration />

          {/* TODO: Add a global travel announcement or system notification banner later. */}
          <Header />

          <div className="flex-1">
            {children}
          </div>

          {/* TODO: Add a shared Chatlas footer after the final branding and navigation structure are confirmed. */}
        </SessionProvider>
      </body>
    </html>
  );
}
