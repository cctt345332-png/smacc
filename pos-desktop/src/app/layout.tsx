import type { Metadata } from "next";
import { Alexandria } from "next/font/google";

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-alexandria",
});

export const metadata: Metadata = {
  title: "Masar POS",
  description: "نقطة البيع — مسار",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "Alexandria, sans-serif", background: "#F8FAFC" }}
        className={alexandria.variable}>
        {children}
      </body>
    </html>
  );
}
