"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeechForm } from "@/components/speech/speech-form";
import { UploadArea, type ExtractedEventInfo } from "@/components/upload/upload-area";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { useSession } from "@/lib/hooks/use-session";

export default function SpeechPage() {
  const { sessionId, loading, error } = useSession();
  const [extractedInfo, setExtractedInfo] = useState<ExtractedEventInfo | null>(null);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="container max-w-3xl py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-1" />
              홈
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">말씀자료 작성</h1>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <div className="container max-w-3xl py-8">
        {/* API 키 상태 배너 */}
        <ApiKeyBanner />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            세션 준비 중...
          </div>
        ) : error ? (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            세션 발급 실패: {error}
          </div>
        ) : sessionId ? (
          <>
            {/* 업로드 영역 */}
            <UploadArea sessionId={sessionId} onExtractedEventInfo={setExtractedInfo} />

            {/* 구분선 */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">또는 직접 입력</span>
              </div>
            </div>

            {/* 폼 (자동 추출 결과 prop으로 전달) */}
            <SpeechForm extractedInfo={extractedInfo} sessionId={sessionId} />
          </>
        ) : null}
      </div>
    </main>
  );
}
