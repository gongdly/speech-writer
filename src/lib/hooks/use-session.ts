"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "speech-writer:sessionId";

export interface UseSessionResult {
  sessionId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * 익명 세션 훅
 *
 * 첫 방문 시 자동으로 세션 발급 → localStorage 저장.
 * 이후 모든 API 호출에 sessionId 포함.
 */
export function useSession(): UseSessionResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      try {
        // 1. localStorage 확인
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
          // 서버에 검증 요청 (만료 시 새로 발급)
          const res = await fetch(`/api/session?id=${stored}`);
          if (res.ok && !cancelled) {
            setSessionId(stored);
            return;
          }
          // 만료·없음 → 새로 발급
          localStorage.removeItem(SESSION_KEY);
        }

        // 2. 새 세션 발급
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!res.ok) throw new Error(`세션 발급 실패: ${res.status}`);

        const { session } = await res.json();
        if (cancelled) return;

        localStorage.setItem(SESSION_KEY, session.id);
        setSessionId(session.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "세션 발급 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    ensureSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sessionId, loading, error };
}
