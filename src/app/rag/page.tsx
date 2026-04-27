"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

interface RssSourceRow {
  id: string;
  name: string;
  category: string;
  ministry: string | null;
  is_active: boolean;
  last_synced_at: number | null;
  last_status: string | null;
  total_articles: number;
}

interface SyncLogRow {
  id: string;
  source_id: string;
  started_at: number;
  finished_at: number | null;
  status: string;
  fetched_count: number;
  new_count: number;
  embedded_count: number;
  error_message: string | null;
  rss_sources?: { name: string; category: string };
}

export default function RagAdminPage() {
  const [sources, setSources] = useState<RssSourceRow[]>([]);
  const [logs, setLogs] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rag/status");
      const data = await res.json();
      if (res.ok) {
        setSources(data.sources ?? []);
        setLogs(data.recentLogs ?? []);
      }
    } catch (e) {
      console.error("status load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    if (!confirm("지금 모든 RSS 소스를 동기화하시겠습니까? (1~2분 소요)")) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const res = await fetch("/api/rag/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "동기화 실패");
      } else {
        const summary = data.summary;
        setSyncResult(
          `완료: ${summary.sourcesProcessed}개 소스, ` +
            `새 기사 ${summary.totalNewArticles}건, ` +
            `청크 ${summary.totalEmbeddedChunks}개 생성 ` +
            `(${(summary.elapsedMs / 1000).toFixed(1)}초)`,
        );
        loadData();
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "동기화 실패");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />홈
          </Button>
        </Link>
        <h1 className="text-xl font-bold">RAG 데이터 관리</h1>
        <div />
      </div>

      <div className="rounded-lg border border-border/50 bg-blue-50/40 dark:bg-blue-950/10 p-4 mb-6 text-sm">
        <div className="flex items-start gap-2">
          <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">RAG (Retrieval-Augmented Generation)</p>
            <p className="text-muted-foreground">
              정책브리핑·부처별 보도자료 최근 1년치를 임베딩하여, 말씀자료 작성 시
              관련 자료를 자동으로 참고합니다. 매일 새벽 3시 자동 동기화됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 수동 동기화 */}
      <div className="mb-6 flex items-center gap-3">
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              동기화 중...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              지금 동기화
            </>
          )}
        </Button>
        <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
          새로고침
        </Button>
      </div>

      {syncResult && (
        <div className="mb-4 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <span>{syncResult}</span>
        </div>
      )}
      {syncError && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

      {/* 소스 목록 */}
      <h2 className="font-semibold mb-3">RSS 소스 ({sources.length}개)</h2>
      <div className="space-y-2 mb-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : (
          sources.map((src) => (
            <div
              key={src.id}
              className="rounded-lg border border-border/50 p-3 text-sm flex items-center justify-between flex-wrap gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{src.name}</div>
                <div className="text-xs text-muted-foreground">
                  {src.category === "policy_briefing" ? "정책브리핑" : src.ministry}
                  {" · "}
                  기사 {src.total_articles.toLocaleString()}건
                  {src.last_synced_at && (
                    <>
                      {" · "}
                      마지막 동기화: {formatTimeAgo(src.last_synced_at)}
                    </>
                  )}
                </div>
              </div>
              <StatusBadge status={src.last_status} />
            </div>
          ))
        )}
      </div>

      {/* 동기화 로그 */}
      <h2 className="font-semibold mb-3">최근 동기화 로그</h2>
      <div className="space-y-1 text-xs">
        {logs.length === 0 ? (
          <p className="text-muted-foreground">로그 없음</p>
        ) : (
          logs.slice(0, 20).map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-2 p-2 rounded border border-border/30 bg-muted/20"
            >
              <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground whitespace-nowrap">
                {new Date(log.started_at).toLocaleString("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="flex-1 min-w-0 truncate">
                {log.rss_sources?.name ?? log.source_id}
              </span>
              {log.status === "ok" ? (
                <span className="text-emerald-600">
                  +{log.new_count}건, 청크 {log.embedded_count}개
                </span>
              ) : log.status === "error" ? (
                <span className="text-red-600 truncate max-w-xs">
                  {log.error_message ?? "에러"}
                </span>
              ) : (
                <span className="text-amber-600">진행중</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
        미동기화
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
        정상
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 max-w-[200px] truncate">
      {status.startsWith("error:") ? status.slice(7) : status}
    </span>
  );
}

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}
