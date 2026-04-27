/** @type {import('next').NextConfig} */
const nextConfig = {
  // MVP 단계: 타입 에러가 있어도 빌드 진행
  // 정식 운영 전에 차수별로 타입 정리 예정
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // PDF 파싱 라이브러리(pdf-parse) 호환을 위한 설정
  serverExternalPackages: ["pdf-parse"],
};

module.exports = nextConfig;
