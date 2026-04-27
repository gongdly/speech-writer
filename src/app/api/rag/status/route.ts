import { NextResponse } from "next/server";
import { listAllRssSources, getRecentSyncLogs } from "@/lib/rag/db";

export const runtime = "nodejs";

/**
 * GET /api/rag/status
 *
 * RSS 소스 목록 + 최근 동기화 로그
 */
export async function GET() {
  try {
    const [sources, recentLogs] = await Promise.all([
      listAllRssSources(),
      getRecentSyncLogs(30),
    ]);

    return NextResponse.json({
      sources,
      recentLogs,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}
