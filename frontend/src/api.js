import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getSessions = async () => {
  const response = await api.get('/sessions/');
  return response.data;
};

export const createSession = async (name) => {
  const response = await api.post('/sessions/', {
    name,
    tickers: [],
    constraints: { min_weight: 0, max_weight: 1.0, target_volatility: 0 }
  });
  return response.data;
};

export const updateSession = async (id, sessionData) => {
  const response = await api.put(`/sessions/${id}`, sessionData);
  return response.data;
};

export const deleteSession = async (id) => {
  const response = await api.delete(`/sessions/${id}`);
  return response.data;
};


export const getProxyRecommendations = async (ticker) => {
  const response = await api.get(`/proxy/recommendations?ticker=${ticker}`);
  return response.data;
};

export const getExchangeRate = async () => {
  const response = await api.get('/exchange_rate');
  return response.data;
};

export const analyzeTickers = async (tickers, lookback_period, proxies = {}) => {
  const response = await api.post('/analyze', { tickers, lookback_period, proxies });
  return response.data;
};


export const optimizePortfolio = async (tickers, constraints, lookback_period, objective, proxies = {}) => {
  const response = await api.post('/optimize', { tickers, constraints, lookback_period, objective, proxies });
  return response.data;
};

export const evaluatePortfolio = async (tickers, weights, lookback_period, proxies = {}) => {
  const response = await api.post('/evaluate_portfolio', { tickers, weights, lookback_period, proxies });
  return response.data;
};


export const runBacktest = async (tickers, weights, lookback_period, params, proxies = {}) => {
  const response = await api.post('/backtest', {
    tickers,
    weights,
    lookback_period,
    proxies,
    ...params
  });
  return response.data;
};
