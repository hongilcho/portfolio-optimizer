# 🚀 Portfolio Optimizer 클라우드 배포 완벽 가이드 (Render + Vercel)

본 문서는 `deploy/render-vercel` 브랜치에 구성된 배포 설정을 바탕으로, 실제 인터넷 웹사이트(`https://...`)를 개설하는 단계별 매뉴얼입니다.

---

## 📌 0단계: GitHub 최신 상태 확인
로컬에서 구성된 `main`과 `deploy/render-vercel` 브랜치가 GitHub 원격 저장소에 푸시 완료되어 있습니다.

```bash
git checkout deploy/render-vercel
```

---

## 🏢 1단계: 백엔드(FastAPI) 배포하기 (`Render`)
데이터 연산과 AI를 담당할 백엔드 서버를 배포하여 **공개 API 주소**를 확보합니다.

1. **Render 가입 및 로그인**: [https://render.com](https://render.com)에 접속하여 GitHub 계정으로 로그인합니다.
2. **새 웹 서비스 생성**:
   - 대시보드 우측 상단 `New +` 버튼 클릭 ➔ **Web Service** 선택.
   - 본인의 `portfolio-optimizer` GitHub 저장소를 선택하고 **Connect** 클릭.
3. **설정값 입력**:
   - **Name**: `portfolio-optimizer-api` (또는 원하는 이름)
   - **Branch**: `deploy/render-vercel`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free` 선택
4. **환경변수(Environment Variables) 등록**:
   - 하단 **Environment Variables** 섹션에서 `Add Environment Variable` 클릭:
     - **Key**: `GEMINI_API_KEY`
     - **Value**: 본인의 Gemini API 키 입력
     - **Key**: `PYTHON_VERSION`
     - **Value**: `3.11.8`
5. **Create Web Service** 클릭!
   - 2~3분 뒤 배포가 완료되면 상단에 **`https://portfolio-optimizer-api-xxxx.onrender.com`** 형태의 고유 URL이 생성됩니다. 이 주소를 복사해 둡니다.

---

## ⚡ 2단계: 프론트엔드(React SPA) 배포하기 (`Vercel`)
사용자가 접속할 웹 화면을 Vercel의 글로벌 초고속 CDN에 배포합니다.

1. **Vercel 가입 및 로그인**: [https://vercel.com](https://vercel.com)에 접속하여 GitHub 계정으로 로그인합니다.
2. **새 프로젝트 추가**:
   - 대시보드에서 `Add New...` ➔ **Project** 클릭.
   - `portfolio-optimizer` 저장소의 **Import** 버튼 클릭.
3. **설정값 입력**:
   - **Framework Preset**: `Vite` (자동 감지됨)
   - **Root Directory**: `Edit` 버튼을 눌러 **`frontend`** 폴더를 선택!
4. **환경변수(Environment Variables) 연결 (가장 중요 ⭐)**:
   - **Environment Variables** 아코디언 메뉴를 열고:
     - **Key**: `VITE_API_BASE_URL`
     - **Value**: 1단계에서 복사한 Render 백엔드 주소 (예: `https://portfolio-optimizer-api-xxxx.onrender.com`)
5. **Deploy** 클릭!
   - 약 30초 후 **`https://portfolio-optimizer-xxxx.vercel.app`** 도메인이 즉시 발급됩니다.

---

## 🌐 3단계: 접속 및 동작 확인
- 생성된 Vercel 도메인으로 PC나 스마트폰 브라우저에서 접속합니다.
- 포트폴리오 생성, 한국/미국 주가 데이터 로딩, 듀얼 최적화, 백테스트, AI 어드바이저 질의응답 및 방법론(Methodology) 탭이 모두 정상 작동하는지 확인합니다!
