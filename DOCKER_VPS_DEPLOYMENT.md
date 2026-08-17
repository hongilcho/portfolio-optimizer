# 🐳 Docker + Oracle / AWS VPS 클라우드 배포 완벽 가이드

본 문서는 **`deploy/docker-vps`** 브랜치를 기반으로, **오라클 클라우드(평생 무료 24GB RAM 인스턴스)** 또는 **AWS EC2 / Lightsail** 가상 서버에 포트폴리오 최적화 앱을 도커로 띄우는 단계별 안내서입니다.

---

## 🌟 왜 Docker + VPS 배포가 최상인가요?
1. **메모리(RAM) 무제한 (2GB ~ 24GB)**:
   - Render의 512MB 제한에서 완전히 해방되어, 50개 이상의 종목과 40년 치 데이터를 렉 없이 로컬 PC 속도로 계산합니다.
2. **24시간 슬립(Sleep) 없는 상시 가동**:
   - 모바일, 태블릿, PC 언제 어디서 접속해도 0.1초 만에 즉각 화면이 뜹니다.
3. **단 1줄의 명령어로 설치/실행**:
   - `docker compose up -d --build` 명령어 하나로 프론트엔드(Nginx)와 백엔드(FastAPI)가 자동 패키징되어 켜집니다.

---

## 🚀 1단계: 가상 서버(VPS) 준비

### Option A. [강력 추천] 오라클 클라우드 (Oracle Cloud Always Free)
1. [https://www.oracle.com/cloud/free/](https://www.oracle.com/cloud/free/) 가입.
2. **Compute** ➔ **Instances** ➔ **Create Instance** 클릭.
3. **Shape**: `Ampere (ARM)` 선택 ➔ **4 OCPU, 24 GB RAM** 설정 (평생 무료!).
4. **Image**: `Ubuntu 22.04` or `24.04`.
5. SSH Key를 다운로드하고 인스턴스 생성 완료.
6. **서버 방화벽(Ingress Rules) 개방**:
   - VCN ➔ Security Lists ➔ Ingress Rules 추가:
     - `Source CIDR`: `0.0.0.0/0`
     - `Destination Port`: `80, 443, 8000` (TCP)

### Option B. AWS Lightsail (월 $3.5 ~ $5)
1. AWS 콘솔에서 **Lightsail** 접속 ➔ **Create Instance** 클릭.
2. `Linux/Unix` ➔ `OS Only (Ubuntu 22.04)` 선택.
3. 네트워킹 탭에서 **HTTP (80번 포트)** 방화벽 열기.

---

## ⚡ 2단계: 서버 접속 및 도커(Docker) 설치 (1분 소요)

서버 터미널(SSH)에 접속한 후 아래 명령어를 복사하여 붙여넣습니다:

```bash
# 1. 패키지 업데이트 및 Docker 자동 설치
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. 현재 사용자에게 도커 권한 부여
sudo usermod -aG docker $USER
newgrp docker
```

---

## 📦 3단계: GitHub 코드 가져오기 및 실행

```bash
# 1. 저장소 복제 (Clone)
git clone -b deploy/docker-vps https://github.com/hongilcho/portfolio-optimizer.git
cd portfolio-optimizer

# 2. 환경변수 파일(.env) 생성 (Gemini API 키 등록)
cat << 'EOF' > .env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
EOF


# 3. 도커 컨테이너 빌드 및 백그라운드 실행!
docker compose up -d --build
```

---

## 🌐 4단계: 웹 브라우저로 접속!

- 브라우저 주소창에 서버의 **공인 IP 주소**를 입력합니다:
  ```text
  http://<서버의_공인_IP_주소>/
  ```
- **성공!** 이제 24GB의 압도적인 메모리와 Nginx 고성능 웹 서버 위에서 자유롭게 포트폴리오를 분석하실 수 있습니다.

---

## 🛠️ 유지보수 명령어 모음

* **서버 상태 확인**: `docker compose ps`
* **실시간 로그 보기**: `docker compose logs -f`
* **최신 코드로 업데이트**:
  ```bash
  git pull origin deploy/docker-vps
  docker compose up -d --build
  ```
* **서버 중지**: `docker compose down`
