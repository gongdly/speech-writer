import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Speech Writer — AI 말씀자료 작성기",
  description:
    "AI가 행사 정보를 분석해 격식 있는 말씀자료 초안을 5분 안에 작성합니다. 부처·기관·민간 모두 사용 가능한 범용 도구.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  );
}
