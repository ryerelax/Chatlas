import Header from "@/presentation/components/Header";
import ServiceWorkerRegistration from "@/presentation/components/ServiceWorkerRegistration";
import Providers from "@/presentation/components/Providers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Chatlas",
  description: "Discover attractions and experiences around Melaka.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-gray-50">
        <Providers>
          <ServiceWorkerRegistration />

          {/* TODO: Add a global travel announcement or system notification banner later. */}
          <Header />

          <div className="flex-1">{children}</div>

          {/* TODO: Add a shared Chatlas footer after the final branding and navigation structure are confirmed. */}
        </Providers>
      </body>
    </html>
  );
}