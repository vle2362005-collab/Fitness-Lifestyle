import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";
import Navbar from "./components/Navbar";
import ChatWidget from "./components/ChatWidget";

export const metadata: Metadata = {
  title: "FitnessLifestyle",
  description: "AI Fitness Coach, nutrition tracking and progress improvement"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <AuthProvider>
          <Navbar />
          {children}
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
