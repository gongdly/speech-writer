"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  RotateCw,
  Trash2,
  FileText,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/lib/hooks/use-session";
import { EVENT_TYPES } from "@/lib/data/event-types";
import { SPEAKER_PERSONAS } from "@/lib/data/speaker-personas";

interface DraftListItem {
  id: string;
  event_name: string;
  event_type: string;
  event_date: string | null;
  speaker_role: string;
  length_option: string;
  target_chars: number;
  status: string;
  created_at: number;
  updated_at: number;
}

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const router = useRouter();
  const { sessionId } = useSession();

  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [eventType, setEventType] = useState<string>("all");

  // 이력 조회
  const fetchDrafts = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sessionId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (search) params.set("search", search);
      if (eventType !== "all") params.set("eventType", eventType);

      const res = await fetch(`/api/history?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "조회 실패");

      setDrafts(data.drafts);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [sessionId, search, eventType, offset]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // 검색 실행
  const handleSearch = () => {
    setOffset(0);
    setSearch(searchInput.trim());
  };

  // 삭제
  const handleDelete = async (draftId: string, eventName: string) => {
    if (!confirm(`"${eventName}" 초안을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(
        `/api/history?sessionId=${sessionId}&draftId=${draftId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "삭제 실패");
      fetchDrafts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  // 재사용 (이 입력값으로 새로 작성)
  const handleReuse = (draftId: string) => {
    router.push(`/speech?reuse=${draftId}`);
  };

  // 보기
  const handleView = (draftId: string) => {
    router.push(`/result/${draftId}`);
  };

  // 페이지 이동
  const handlePrev = () => setOffset(Math.max(0, offset - PAGE_SIZE));
  const handleNext = () => setOffset(offset + PAGE_SIZE);
  const hasNext = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  // 라벨 변환 헬퍼
  const eventTypeLabel = (key: string) =>
    EVENT_TYPES.find((e) => e.key === key)?.label ?? key;
  const speakerRoleLabel = (key: string) =>
    SPEAKER_PERSONAS.find((p) => p.key === key)?.label ?? key;

  return (
    <div className="container mx-auto max-w-5xl p-6">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />홈
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          작성 이력
        </h1>
        <Link href="/speech">
          <Button size="sm">새 말씀자료 작성</Button>
        </Link>
      </div>

      {/* 검색·필터 */}
      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-border/50 bg-muted/30 p-4">
        <div className="flex-1 min-w-[200px] flex gap-2">
          <Input
            placeholder="행사명으로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} variant="outline" size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Select
          value={eventType}
          onValueChange={(v) => {
            setEventType(v);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="행사 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 로딩·에러 */}
      {loading && (
        <div className="text-center text-muted-foreground py-12">
          불러오는 중...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && !error && drafts.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground mb-4">
            {search || eventType !== "all"
              ? "검색 결과가 없습니다"
              : "아직 작성한 말씀자료가 없습니다"}
          </p>
          {!search && eventType === "all" && (
            <Link href="/speech">
              <Button>첫 말씀자료 작성하기</Button>
            </Link>
          )}
        </div>
      )}

      {/* 이력 목록 */}
      {!loading && !error && drafts.length > 0 && (
        <>
          <div className="space-y-3">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="border border-border/50 rounded-lg p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base mb-1 truncate">
                      {d.event_name}
                    </h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-2 py-0.5">
                        {eventTypeLabel(d.event_type)}
                      </span>
                      <span>{speakerRoleLabel(d.speaker_role)}</span>
                      <span>{d.length_option}</span>
                      {d.event_date && (
                        <span>
                          행사일{" "}
                          {new Date(d.event_date).toLocaleDateString("ko-KR")}
                        </span>
                      )}
                      <span>
                        작성일{" "}
                        {new Date(d.created_at).toLocaleDateString("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 gap-1">
                    <Button
                      onClick={() => handleView(d.id)}
                      size="sm"
                      variant="ghost"
                      title="보기"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleReuse(d.id)}
                      size="sm"
                      variant="ghost"
                      title="이 입력값으로 새로 작성"
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(d.id, d.event_name)}
                      size="sm"
                      variant="ghost"
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
            <div>
              총 {total.toLocaleString()}건 중{" "}
              {Math.min(offset + 1, total).toLocaleString()}~
              {Math.min(offset + drafts.length, total).toLocaleString()}건
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePrev}
                disabled={!hasPrev}
                size="sm"
                variant="outline"
              >
                이전
              </Button>
              <Button
                onClick={handleNext}
                disabled={!hasNext}
                size="sm"
                variant="outline"
              >
                다음
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
