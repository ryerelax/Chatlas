import Header from "@/components/Header";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";  // ← 添加这一行

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
        <SessionProvider>   {/* ← 添加这一行 */}
          <Header />
          <div className="flex-1">
            {children}
          </div>
        </SessionProvider>  {/* ← 添加这一行 */}
      </body>
    </html>
  );
}