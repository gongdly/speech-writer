import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  detectFileType,
  isTextExtractable,
  MAX_FILE_SIZE,
} from "@/lib/extractors/file-types";
import { extractText, maskSensitive } from "@/lib/extractors";
import { putFile } from "@/lib/storage";
import { saveRagContext } from "@/lib/rag-cache";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/upload
 *
 * Body: multipart/form-data
 *   - file: File (필수)
 *   - sessionId: string (필수)
 *   - fileType: "plan" | "reference" (필수)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;
    const fileType = formData.get("fileType") as "plan" | "reference" | null;

    if (!file)
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    if (!sessionId)
      return NextResponse.json({ error: "sessionId 필수" }, { status: 400 });
    if (!fileType || !["plan", "reference"].includes(fileType)) {
      return NextResponse.json(
        { error: "fileType은 plan|reference" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / 1024 / 1024}MB 이하여야 합니다` },
        { status: 400 },
      );
    }

    const detected = detectFileType(file.name, file.type);
    if (!detected) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다 (DOCX·PDF·TXT 지원)" },
        { status: 400 },
      );
    }
    if (!isTextExtractable(detected)) {
      return NextResponse.json(
        { error: "현재 DOCX·PDF·TXT만 지원합니다." },
        { status: 400 },
      );
    }

    const fileId = `f_${nanoid(12)}`;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const storageKey = `${sessionId}/${fileId}.${ext}`;

    const buffer = await file.arrayBuffer();

    // Supabase Storage 업로드
    await putFile(storageKey, buffer, file.type);

    // 텍스트 추출 + 민감정보 마스킹
    const extractResult = await extractText(detected, buffer);
    const maskedText = maskSensitive(extractResult.text);

    // RAG 컨텍스트 저장 (1h TTL)
    await saveRagContext(sessionId, fileId, {
      fileId,
      fileName: file.name,
      fileType,
      text: maskedText,
      charCount: maskedText.length,
      uploadedAt: Date.now(),
    });

    // Supabase DB에 메타 저장
    const sb = createServerClient();
    const { error } = await sb.from("uploaded_files").insert({
      id: fileId,
      session_id: sessionId,
      draft_id: null,
      file_name: file.name,
      file_type: fileType,
      storage_key: storageKey,
      char_count: maskedText.length,
      detected_category: null,
      category_confidence: null,
      extracted_stats: null,
      expires_at: Date.now() + 24 * 60 * 60 * 1000,
      created_at: Date.now(),
    });

    if (error) throw new Error(`DB insert failed: ${error.message}`);

    return NextResponse.json({
      fileId,
      fileName: file.name,
      fileType,
      charCount: maskedText.length,
      extractedTextPreview: maskedText.slice(0, 300),
      warning: extractResult.warning,
    });
  } catch (e) {
    console.error("Upload failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드 실패" },
      { status: 500 },
    );
  }
}
