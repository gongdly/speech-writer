"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

export interface RagSource {
  title: string;
  link: string;
  sourceName: string;
  ministry: string | null;
  pubDate: number | null;
  similarity: number;
}

interface RagSourcesPanelProps {
  sources: RagSource[];
}

export function RagSourcesPanel({ sources }: RagSourcesPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-blue-50/40 dark:bg-blue-950/10 mb-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-50/70 dark:hover:bg-blue-950/20 transition-colors rounded-lg"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium">
            참고된 정책브리핑·보도자료 {sources.length}건
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
          {sources.map((src, idx) => (
            <div
              key={idx}
              className="bg-background rounded-md p-3 text-sm border border-border/30"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <a
                  href={src.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-700 dark:text-blue-400 hover:underline flex items-start gap-1.5 flex-1"
                >
                  <span>{src.title}</span>
                  <ExternalLink className="w-3 h-3 mt-1 flex-shrink-0" />
                </a>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  유사도 {Math.round(src.similarity * 100)}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                <span>{src.sourceName}</span>
                {src.ministry && (
                  <>
                    <span>·</span>
                    <span>{src.ministry}</span>
                  </>
                )}
                {src.pubDate && (
                  <>
                    <span>·</span>
                    <span>
                      {new Date(src.pubDate).toISOString().slice(0, 10)}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}

          <p className="text-[11px] text-muted-foreground pt-1">
            💡 위 자료들이 본문 작성에 자동으로 참고되었습니다. 클릭하면 원문을 확인할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
