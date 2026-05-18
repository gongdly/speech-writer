import Link from "next/link";
import { FileText, Newspaper, ArrowRight, ExternalLink, Sparkles, KeyRound, History, Database, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero */}
      <section className="container max-w-5xl pt-16 pb-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            AI 기반 공공 콘텐츠 작성 도구
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            5분 안에 완성하는<br />
            격식 있는 행정문서
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            행사 정보·참조 자료를 입력하면 부처·기관 표준 구조로 초안을 자동 생성합니다.
            말씀자료부터 보도자료까지 한 곳에서 작성하세요.
          </p>
        </div>
      </section>

      {/* 모듈 선택 */}
      <section className="container max-w-5xl pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          {/* 말씀자료 모듈 (Phase 1, 활성) */}
          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">
                사용 가능
              </span>
            </div>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>말씀자료</CardTitle>
              <CardDescription>
                축사·기념사·신년사 등 8가지 행사 유형 지원
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>50건 부처 자료 분석으로 검증된 6단 구조</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>행사계획서 업로드 → 정보 자동 추출</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>참고자료 다중 업로드 → 본문 풍부도↑</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>5단계 분량 + 사용자 지정</span>
                </li>
              </ul>
              <Button asChild className="w-full" size="lg">
                <Link href="/speech">
                  말씀자료 작성하기
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* 보도자료 모듈 (별도 운영, 외부 링크) */}
          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">
                사용 가능
              </span>
            </div>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Newspaper className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>보도자료</CardTitle>
              <CardDescription>
                정책브리핑 + 부처 보도자료 참조 기반 자동 생성
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>정책브리핑 API 연동 — 부처별 최신 자료 검색·참조</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>표제·부제·리드문·본문 자동 구조화</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>참고 문서 첨부 → 본문 맥락 강화</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>정부 표준 HWPX 자동 다운로드</span>
                </li>
              </ul>
              <Button asChild className="w-full" size="lg">
                <a href="https://press-docs-mcp.onrender.com" target="_blank" rel="noopener noreferrer">
                  보도자료 작성하기
                  <ExternalLink className="ml-2 w-4 h-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 보조 메뉴 */}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link href="/settings">
              <KeyRound className="w-4 h-4 mr-2" />
              API 키 설정
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/history">
              <History className="w-4 h-4 mr-2" />
              작성 이력
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/personas">
              <Users className="w-4 h-4 mr-2" />
              페르소나 관리
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/rag">
              <Database className="w-4 h-4 mr-2" />
              RAG 관리
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <div className="container max-w-5xl">
          <p>Speech Writer · AI 기반 공공 콘텐츠 작성 도구 · v0.9</p>
        </div>
      </footer>
    </main>
  );
}
