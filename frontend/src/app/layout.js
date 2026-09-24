import localFont from "next/font/local";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import NavBar from "@/components/NavBar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "Pharma Buddy",
  description: "Purchase, GRN, Inventory, Sales and Masters management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}>
        <AppProvider>
          <NavBar />
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
