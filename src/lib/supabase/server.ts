/**
 * Supabase 서버 클라이언트 (Server Components, API Routes 전용)
 *
 * 서버에서는 Service Role Key를 사용하여 RLS(Row Level Security)를 우회.
 * MVP 단계에서는 익명 세션 기반이라 이 방식이 적합.
 */

import { createClient } from "@supabase/supabase-js";

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
