import { Outfit } from "next/font/google";
import "../styles/globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata = {
  title: "EZDine | Modern Restaurant OS",
  description: "The intelligent operating system for forward-thinking restaurants.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-screen font-sans antialiased selection:bg-brand-500/30">
        {children}
      </body>
    </html>
  );
}
