"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeechForm } from "@/components/speech/speech-form";
import { UploadArea, type ExtractedEventInfo } from "@/components/upload/upload-area";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { useSession } from "@/lib/hooks/use-session";

function SpeechPageInner() {
  const { sessionId, loading, error } = useSession();
  const [extractedInfo, setExtractedInfo] = useState<ExtractedEventInfo | null>(null);
  const [reuseValues, setReuseValues] = useState<Record<string, unknown> | null>(null);
  const [reuseLoading, setReuseLoading] = useState(false);

  const searchParams = useSearchParams();
  const reuseDraftId = searchParams.get("reuse");

  // 재사용 데이터 fetch
  useEffect(() => {
    if (!reuseDraftId) return;
    setReuseLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/drafts/${reuseDraftId}/reuse`);
        const data = await res.json();
        if (res.ok) {
          setReuseValues(data.formValues);
        }
      } catch (e) {
        console.error("Reuse fetch failed:", e);
      } finally {
        setReuseLoading(false);
      }
    })();
  }, [reuseDraftId]);

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
          <div className="flex items-center gap-2 flex-1">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">말씀자료 작성</h1>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/history">
              <History className="w-4 h-4 mr-1" />
              작성 이력
            </Link>
          </Button>
        </div>
      </header>

      {/* 본문 */}
      <div className="container max-w-3xl py-8">
        {/* API 키 상태 배너 */}
        <ApiKeyBanner />

        {/* 재사용 안내 배너 */}
        {reuseDraftId && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            {reuseLoading
              ? "이전 입력값을 불러오는 중..."
              : reuseValues
                ? "✓ 이전 입력값을 불러왔습니다. 필요한 부분을 수정한 후 다시 생성하세요."
                : "이전 입력값을 불러오지 못했습니다."}
          </div>
        )}

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
            {/* 업로드 영역 (재사용 모드일 때는 숨김) */}
            {!reuseDraftId && (
              <>
                <UploadArea sessionId={sessionId} onExtractedEventInfo={setExtractedInfo} />

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">또는 직접 입력</span>
                  </div>
                </div>
              </>
            )}

            {/* 폼 */}
            <SpeechForm
              extractedInfo={extractedInfo}
              sessionId={sessionId}
              reuseValues={reuseValues}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

export default function SpeechPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          로딩 중...
        </div>
      }
    >
      <SpeechPageInner />
    </Suspense>
  );
}
