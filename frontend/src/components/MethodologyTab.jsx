import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const MethodologyTab = () => {
  const markdownContent = `
# 금융 분석 및 포트폴리오 최적화 방법론 (Methodology)

이 문서는 본 애플리케이션에서 수행되는 데이터 변환, 성과 지표 산출, 연도별 지표 계산 및 포트폴리오 최적화 알고리즘에 대한 수학적 기초와 백엔드 처리 논리를 상세하게 기술합니다.

---

## 1. 기초 성과 지표 (Fundamental Performance Metrics)

본 애플리케이션은 \`pandas\`와 \`numpy\`를 기반으로 일별 수정종가(Adjusted Close)를 활용하여 성과 지표를 산출합니다.

### 📌 수식 기호 정의 (Notation)
* $T$: 전체 분석 대상 기간의 총 영업일 수 (Total number of trading days in sample period)
* $t$: 특정 영업일 시점 인덱스 ($t \\in \\{0, 1, 2, \\dots, T\\}$)
* $P_t$: 시점 $t$에서의 자산 수정종가 (Adjusted Close Price at time $t$)
* $P_0$: 분석 시작일(최초 기준 시점, $t=0$)의 수정종가 (Initial Base Price)
* $P_T$: 분석 종료일(마지막 시점, $t=T$)의 최종 수정종가 (Final Price)
* $R_t$: 시점 $t$의 일간 산술 수익률 (Daily Arithmetic Return)
* $\\bar{R}$: 전체 기간 동안의 일간 수익률 표본 산술평균 (Sample Mean of Daily Returns, $\\bar{R} = \\frac{1}{T}\\sum_{t=1}^T R_t$)
* $s$: 일간 수익률의 표본 표준편차 (Sample Standard Deviation)
* $\\sigma_{annual}$: 1년 영업일(252일)을 기준으로 연환산한 변동성 (Annualized Volatility)

---

### 1.1 일간 수익률 (Daily Arithmetic Returns)
가장 기본이 되는 일간 수익률 $R_t$는 전일 수정종가 대비 당일 수정종가의 상대적 가격 변화율로 산출됩니다. (백엔드 코드: \`data.pct_change()\`)

$$
\\displaystyle R_t = \\frac{P_t - P_{t-1}}{P_{t-1}}
$$

### 1.2 연평균 복리 수익률 (CAGR: Compound Annual Growth Rate)
투자 기간 $T$일 동안 최초 기준 가격 $P_0$에서 최종 가격 $P_T$로 변화했을 때, 1년(252영업일) 단위로 매년 일정하게 복리 성장했다고 가정한 연간 기하평균 성장률입니다. (백엔드 코드: \`(P_T / P_0) ** (252 / T) - 1\`)

$$
\\displaystyle CAGR = \\left( \\frac{P_T}{P_0} \\right)^{\\frac{252}{T}} - 1
$$

* $P_T / P_0$: 전체 기간 동안의 총 누적 배수 (Cumulative Growth Factor)
* $252 / T$: 총 관측 거래일 $T$를 1년 표준 영업일(252일)로 환산한 연 단위 지수 (Annualization Exponent)

### 1.3 연환산 변동성 (Annualized Volatility)
자산 가격의 불확실성과 변동 폭을 나타내는 위험 지표입니다. 일간 수익률의 표본 표준편차 $s$를 계산한 후, 시간의 제곱근 법칙(Square-root of Time Rule)에 따라 $\\sqrt{252}$를 곱하여 연환산합니다. (백엔드 코드: \`returns.std() * np.sqrt(252)\`)

$$
\\displaystyle s = \\sqrt{ \\frac{1}{T-1} \\sum\\limits_{t=1}^T (R_t - \\bar{R})^2 }
$$
$$
\\displaystyle \\sigma_{annual} = s \\times \\sqrt{252}
$$

### 1.4 최대 낙폭 (MDD: Maximum Drawdown)
특정 기간 내 전고점(Peak) 대비 가장 크게 하락한 저점(Trough)까지의 손실률을 측정하여 극단적인 하방 위험(Tail Risk)을 평가합니다. 각 시점 $t$에서의 누적 최고가(Rolling Peak, $\\max\\limits_{\\tau \\le t} P_\\tau$)를 분모로 두어 낙폭을 구한 뒤 그중 최솟값을 취합니다. (백엔드 코드: \`(prices / prices.cummax() - 1.0).min()\`)

$$
\\displaystyle MDD = \\min\\limits_{t \\in [0, T]} \\left( \\frac{P_t}{\\max\\limits_{\\tau \\le t} P_\\tau} - 1 \\right)
$$

---

## 2. 연도별 성과 지표 (Yearly Performance Metrics)

애플리케이션의 **분석(Analysis) 탭** 및 **Asset Stats 테이블** 하단에 제공되는 연도별(Yearly) 성과 지표는 각 캘린더 연도 $y$에 속한 데이터만을 독립적으로 슬라이싱하여 다음과 같이 산출합니다.

### 📌 연도별 수식 기호 정의
* $y$: 특정 분석 연도 (예: 2021, 2022, 2023 등)
* $T_y$: 연도 $y$에 포함된 해당 연도의 총 거래일 수 (보통 약 250~252일)
* $t_{start, y}$: 연도 $y$의 첫 번째 거래일 (First Trading Day of Year $y$)
* $t_{end, y}$: 연도 $y$의 마지막 거래일 (Last Trading Day of Year $y$)
* $P_{start, y}$: 연도 $y$ 첫 거래일의 수정종가
* $P_{end, y}$: 연도 $y$ 마지막 거래일의 수정종가
* $R_{t, y}$: 연도 $y$ 내 시점 $t$의 일간 수익률 ($t \\in [t_{start, y}, t_{end, y}]$)
* $\\bar{R}_y$: 연도 $y$ 내 일간 수익률의 산술평균 ($\\bar{R}_y = \\frac{1}{T_y}\\sum_{t=1}^{T_y} R_{t, y}$)

### 2.1 연도별 수익률 (Yearly Return Rate)
해당 연도 첫 거래일의 수정종가 대비 마지막 거래일의 수정종가 등락률로 산출합니다. (백엔드 코드: \`group_data.iloc[-1] / group_data.iloc[0] - 1\`)

$$
\\displaystyle \\text{Return}_y = \\frac{P_{end, y} - P_{start, y}}{P_{start, y}} = \\frac{P_{end, y}}{P_{start, y}} - 1
$$

### 2.2 연도별 변동성 (Yearly Annualized Volatility)
해당 연도 내에서 관측된 일간 수익률 시계열의 표본 표준편차 $s_y$를 산출한 후, 1년 기준($\\sqrt{252}$)으로 연환산합니다. (백엔드 코드: \`returns[ticker].loc[idx].std() * np.sqrt(252)\`)

$$
\\displaystyle s_y = \\sqrt{ \\frac{1}{T_y - 1} \\sum\\limits_{t=1}^{T_y} (R_{t, y} - \\bar{R}_y)^2 }
$$
$$
\\displaystyle \\text{Volatility}_y = s_y \\times \\sqrt{252}
$$

### 2.3 프록시 식별 플래그 (is_proxy Tag)
해당 자산의 실제 상장일(Inception Date) $t_{incept}$ 이전의 과거 구간은 프록시 티커(Proxy Ticker)와 환율을 결합하여 가상으로 생성된 데이터입니다.
* 연도 $y$의 시작 시점 $t_{start, y} < t_{incept}$ 인 경우: \`is_proxy = True\` 로 플래그를 부여하여 사용자가 실측 데이터와 가상 백테스트 데이터를 명확히 구분할 수 있도록 합니다.

---

## 3. 현대 포트폴리오 이론 및 최적화 (Modern Portfolio Theory)

애플리케이션의 **최적화(Optimization) 탭**은 Harry Markowitz의 평균-분산(Mean-Variance) 최적화 모델을 기반으로 하며, 내부 엔진으로 \`PyPortfolioOpt\` 라이브러리를 사용합니다.

### 📌 최적화 수식 기호 정의
* $N$: 포트폴리오에 편입된 총 자산 수
* $\\mathbf{w} = [w_1, w_2, \\dots, w_N]^T$: 개별 자산의 투자 비중 벡터 ($w_i \\ge 0$, $\\sum w_i = 1$)
* $\\boldsymbol{\\mu} = [\\mu_1, \\mu_2, \\dots, \\mu_N]^T$: 각 자산의 과거 기하평균 기반 연환산 기대 수익률 벡터 (Expected Return Vector)
* $\\boldsymbol{\\Sigma}$: $N \\times N$ 연환산 공분산 행렬 (Annualized Covariance Matrix)
* $R_f$: 무위험 이자율 (Risk-Free Rate, 사용자가 UI에서 직접 입력한 값, 기본값 $0.02 = 2\\%$)

### 3.1 포트폴리오의 기대 수익률과 분산
* **포트폴리오 기대 수익률**: $E(R_p) = \\mathbf{w}^T \\boldsymbol{\\mu}$
* **포트폴리오 분산(위험)**: $\\sigma_p^2 = \\mathbf{w}^T \\boldsymbol{\\Sigma} \\mathbf{w}$

---

### 3.2 공분산 수축 기법: Ledoit-Wolf Shrinkage

과거 시계열 데이터로부터 단순 추출한 표본 공분산 행렬(Sample Covariance Matrix $S$)은 데이터의 길이가 충분히 길지 않을 때 표본 오차(Estimation Noise)가 매우 큽니다. 특히 고유값(Eigenvalues)의 양극화 왜곡이 발생하여 최적화 알고리즘이 특정 자산에 극단적인 비중을 몰아주는 문제(Corner Solution / Error Maximization)를 일으킵니다.

이를 해결하기 위해 본 시스템은 **Ledoit & Wolf (2004)**가 제안한 최적 선형 수축 기법을 적용합니다. (백엔드 코드: \`CovarianceShrinkage(data).ledoit_wolf()\`)

$$
\\displaystyle \\boldsymbol{\\Sigma}_{LW} = \\delta F + (1 - \\delta) S
$$

#### 1) 구조적 표적 행렬 $F$ (Structured Target Matrix)의 정의
수축 목표점인 $F$는 **단일 상관관계 모형(Constant Correlation Model)** 행렬을 사용합니다.
* 표본 공분산 $S$의 대각 성분(각 자산 고유의 표본 분산 $S_{ii} = s_i^2$)은 그대로 보존합니다.
* 비대각 성분(서로 다른 자산 간의 상관계수)은 모든 자산 쌍의 평균 상관계수 $\\bar{r}$로 균일하게 대체합니다:

$$
\\displaystyle \\bar{r} = \\frac{2}{N(N-1)} \\sum\\limits_{i < j} r_{ij}
$$
$$
\\displaystyle F_{ii} = S_{ii}, \\qquad F_{ij} = \\bar{r} \\sqrt{S_{ii} S_{jj}} \\quad (i \\neq j)
$$

$F$ 행렬은 추정해야 하는 모수의 수가 대폭 줄어들어 분산(Estimation Variance)이 매우 작고 통계적으로 극히 안정적입니다.

#### 2) 최적 수축 강도 $\\delta$ (Optimal Shrinkage Intensity)의 산출 방식
수축 계수 $\\delta \\in [0, 1]$는 **임의로 사람이 하드코딩(예: 0.2 등)하는 것이 아닙니다.**

Ledoit & Wolf는 참 공분산 행렬 $\\boldsymbol{\\Sigma}_{true}$와의 점근적 기대 평균 제곱 오차(Asymptotic Expected Frobenius Loss)를 최소화하는 목적 함수를 수학적으로 증명했습니다:

$$
\\displaystyle \\min\\limits_{\\delta} \\mathbb{E}\\left[ \\|\\boldsymbol{\\Sigma}_{LW} - \\boldsymbol{\\Sigma}_{true}\\|^2_F \\right]
$$

이 손실 함수를 미분하여 유도된 최적 추정량 $\\hat{\\delta}^*$는 표본 오차의 점근적 분산(Asymptotic Variance of Sample Covariance) $\\hat{\\pi}$, 표본과 표적 간의 거리 $\\hat{\\gamma}$ 등을 기반으로 **데이터로부터 동적으로 엄밀하게 자동 계산(Analytically Computed)**됩니다:

$$
\\displaystyle \\hat{\\delta}^* = \\max\\left(0, \\min\\left(\\frac{\\hat{\\kappa}}{T}, 1\\right)\\right)
$$

* **수학적 동작 원리**:
  1. 관측된 데이터 수($T$)가 적고 자산 수($N$)가 많을수록 표본 오차가 커지므로 $\\hat{\\delta}^*$가 자동으로 커져 구조적 표적 $F$의 비중을 높입니다.
  2. 시계열 데이터($T$)가 무한히 길어지면 표본 오차가 0에 수렴하므로 $\\hat{\\delta}^* \\to 0$이 되어 실제 표본 공분산 $S$를 신뢰하게 됩니다.

---

### 3.3 최적화 목적 함수 (Objective Functions)

기본 제약 조건은 모든 비중의 합이 1이고, 각 비중이 지정된 최소/최대 범위 내에 있어야 함을 의미합니다 ($0 \\le \\text{min\\_weight} \\le w_i \\le \\text{max\\_weight} \\le 1$).

$$ \\displaystyle \\sum\\limits_{i=1}^N w_i = 1, \\quad w_i \\ge 0 \\quad \\forall i $$

1. **Max Sharpe (샤프 지수 극대화)**
   사용자가 설정한 무위험 수익률 $R_f$ 대비 포트폴리오의 초과 수익을 변동성으로 나눈 값(위험 조정 수익률)을 극대화합니다.
   $$ \\displaystyle \\max\\limits_{\\mathbf{w}} \\frac{\\mathbf{w}^T \\boldsymbol{\\mu} - R_f}{\\sqrt{\\mathbf{w}^T \\boldsymbol{\\Sigma}_{LW} \\mathbf{w}}} $$

2. **Min Volatility (최소 변동성)**
   기대 수익률과 무관하게 포트폴리오 전체의 총 위험(변동성)을 최소화합니다.
   $$ \\displaystyle \\min\\limits_{\\mathbf{w}} \\mathbf{w}^T \\boldsymbol{\\Sigma}_{LW} \\mathbf{w} $$

---

## 4. 환율 효과 및 합성 이론 (FX Cushion & Proxy Synthesis)

한국 투자자(KRW) 관점에서 외화 자산(USD)을 투자할 때 발생하는 환율의 하방 방어 효과와 데이터 합성 방식을 수식화합니다.

### 📌 환율 수식 기호 정의
* $R_{USD}$: 미국 본토 시장에서의 달러화 기준 본원 일간 수익률
* $R_{FX}$: 원/달러(USD/KRW) 환율의 일간 변동률
* $R_{KRW}$: 환율 변동이 반영된 원화 환산 일간 수익률

---

### 4.1 수익률의 환율 분해 (Decomposition of Returns)
미국 자산의 원화 환산 수익률 $R_{KRW}$는 미국 시장에서의 본원 수익률 $R_{USD}$와 원달러 환율 수익률 $R_{FX}$로 구성됩니다.

정확한 기하학적 관계는 다음과 같습니다:
$$ 1 + R_{KRW} = (1 + R_{USD})(1 + R_{FX}) $$
$$ R_{KRW} = R_{USD} + R_{FX} + (R_{USD} \\times R_{FX}) $$

일간 수익률 수준에서는 교차항 $(R_{USD} \\times R_{FX})$이 매우 작으므로($\\approx 0$), 선형 근사가 가능합니다:
$$ R_{KRW} \\approx R_{USD} + R_{FX} $$

### 4.2 환율 쿠션 효과 증명 (Variance Analysis)
위 선형 근사식을 바탕으로 원화 환산 자산의 분산(위험)을 전개하면 다음과 같습니다:

$$
\\displaystyle Var(R_{KRW}) \\approx Var(R_{USD}) + Var(R_{FX}) + 2 \\cdot Cov(R_{USD}, R_{FX})
$$

* 글로벌 금융위기나 증시 급락 국면에서 시장 위험 회피 심리로 인해 안전 자산인 달러 가치가 급등(환율 상승)하는 경향이 있습니다.
* 즉, 주가 수익률과 환율 변동률 사이에는 **음의 상관관계 및 공분산**($Cov(R_{USD}, R_{FX}) < 0$)이 강하게 형성됩니다.
* 따라서 $2 \\cdot Cov(R_{USD}, R_{FX})$ 항이 음수가 되어 전체 $Var(R_{KRW})$ 값을 크게 낮춰줍니다. 이를 **환율 쿠션(FX Cushion) 효과**라고 부릅니다.

### 4.3 프록시 및 환헤지 연산 (Proxy & Hedge Logic)
* **프록시 (Proxy 합성)**: 상장 기간이 짧은 국내 상장 해외 ETF(예: 국내 상장 S&P500 ETF)의 경우, 미국 본토 원본 ETF(예: SPY, VOO)의 과거 시계열 $R_{Proxy}$와 역사적 환율 변동률 $R_{FX}$를 역산 합성하여 가상의 원화 수익률 시계열을 복원합니다:
  $$ R_{KRW} = R_{Proxy} + R_{FX} + (R_{Proxy} \\times R_{FX}) $$
* **환헤지 (Hedged 자산)**: 자산명에 (H)가 붙은 환헤지 자산의 경우 환율 변동분($R_{FX}$)을 $0$으로 처리하여 $R_{KRW} \\approx R_{USD}$로 매핑하되, 한국 시장 휴장일과 영업일 불일치를 보정합니다.
  `;

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '2.5rem',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      lineHeight: '1.8',
      fontSize: '1.05rem',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
      borderRadius: '8px'
    }}>
      <style>
        {`
          .methodology-content h1 { font-size: 2rem; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
          .methodology-content h2 { font-size: 1.5rem; color: #1e40af; margin-top: 2.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; }
          .methodology-content h3 { font-size: 1.25rem; color: #0f172a; margin-top: 1.8rem; }
          .methodology-content h4 { font-size: 1.1rem; color: #334155; margin-top: 1.2rem; }
          .methodology-content p { margin-bottom: 1rem; }
          .methodology-content code { background-color: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; color: #b91c1c; font-size: 0.9em; }
          .methodology-content ul { padding-left: 1.5rem; margin-bottom: 1.5rem; }
          .methodology-content li { margin-bottom: 0.5rem; }
          .methodology-content .katex-display { margin: 1.5rem 0; padding: 0.8rem 0; overflow-x: auto; overflow-y: visible; line-height: normal; font-size: 1.15em; }
          .methodology-content .katex { line-height: normal; font-size: 1.05em; }
          .methodology-content hr { border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
        `}
      </style>
      <div className="methodology-content">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MethodologyTab;
