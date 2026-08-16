# 🖥️ 데스크톱 전환 및 DB 클라우드 마이그레이션 가이드

본 문서는 노트북에서 진행하던 개발 작업을 데스크톱 PC로 완벽하게 인수인계하고, 데스크톱의 기존 로컬 DB(`portfolio.db`)를 Supabase 클라우드로 즉시 업로드하기 위한 가이드입니다.

---

## 🚀 1단계: 데스크톱에서 최신 코드 받기

데스크톱의 터미널(PowerShell 또는 Git Bash)에서 프로젝트 폴더로 이동한 뒤 아래 명령어를 실행합니다:

```bash
git checkout main
git pull origin main
```

---

## 🗄️ 2단계: 데스크톱 로컬 DB(`portfolio.db`) ➔ Supabase 클라우드로 1초 마이그레이션

데스크톱에 저장되어 있던 기존 세션 데이터와 AI 대화 기록을 Supabase 클라우드 PostgreSQL 데이터베이스로 업로드합니다:

```bash
cd backend
python migrate_sqlite_to_supabase.py
```

### ✅ 마이그레이션 실행 결과:
* 데스크톱의 `backend/portfolio.db`에 저장되어 있던 실제 세션들이 Supabase 클라우드로 자동 전송됩니다.
* 마이그레이션이 완료되는 즉시, **배포된 웹사이트([https://portfolio-optimizer-murex.vercel.app/](https://portfolio-optimizer-murex.vercel.app/))**와 **로컬 환경** 모두에서 기존 세션들이 실시간으로 표출됩니다.

---

## ⚡ 3단계: 데스크톱 로컬 개발 서버 실행

```bash
# [터미널 1] 백엔드 FastAPI 서버 실행 (포트 8000)
cd backend
uvicorn main:app --reload

# [터미널 2] 프론트엔드 Vite 개발 서버 실행 (포트 5173)
cd frontend
npm run dev
```

* **로컬 웹사이트 접속 주소**: [http://localhost:5173/](http://localhost:5173/)
* **배포된 공개 웹사이트 주소**: [https://portfolio-optimizer-murex.vercel.app/](https://portfolio-optimizer-murex.vercel.app/)
* **배포된 백엔드 API 주소**: [https://portfolio-optimizer-hthp.onrender.com/](https://portfolio-optimizer-hthp.onrender.com/)

---

## 💬 4단계: Antigravity AI와 대화 이어가기

1. 데스크톱에서 **Google Antigravity**를 실행합니다.
2. 대화 목록에서 현재 대화방(`포트폴리오 분석 설정 검토` 등)을 그대로 선택합니다.
3. **"데스크톱에서 마이그레이션 마쳤어. 이어서 진행하자"**라고 말씀해 주시면, 모든 맥락과 프로젝트 상태를 유지한 채 즉시 다음 작업을 진행할 수 있습니다.

---

## 📌 클라우드 인프라 요약 정보

| 구분 | 플랫폼 | 연결 URL / 환경 | 상태 |
| :--- | :--- | :--- | :--- |
| **프론트엔드** | Vercel (SPA) | https://portfolio-optimizer-murex.vercel.app/ | ✅ 정상 가동 중 |
| **백엔드** | Render (FastAPI) | https://portfolio-optimizer-hthp.onrender.com/ | ✅ 정상 가동 중 |
| **데이터베이스** | Supabase (PostgreSQL) | Seoul 리전 (`aws-0-ap-northeast-2.pooler.supabase.com:5432`) | ✅ 양방향 실시간 동기화 |
