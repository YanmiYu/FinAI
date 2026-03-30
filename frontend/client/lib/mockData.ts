import { FinancialResponse } from "@/components/financial/ResponseCard";

export const MOCK_RESPONSES: FinancialResponse[] = [
  {
    query_type: "market",
    asset: {
      symbol: "BABA",
      name: "Alibaba Group",
    },
    summary:
      "Alibaba (BABA) is currently trading at $78.42, down 1.2% in the last 24 hours. Despite the recent decline, the stock shows positive momentum over the 7-day period with a 3.8% gain. Market analysts attribute the short-term fluctuation to profit-taking following strong quarterly earnings.",
    key_metrics: {
      price: 78.42,
      change_1d: -1.2,
      change_7d_pct: 3.8,
    },
    chart_data: [
      { date: "Mar 15", price: 75.2 },
      { date: "Mar 16", price: 76.1 },
      { date: "Mar 17", price: 75.8 },
      { date: "Mar 18", price: 77.3 },
      { date: "Mar 19", price: 78.1 },
      { date: "Mar 20", price: 79.5 },
      { date: "Mar 21", price: 78.9 },
      { date: "Mar 22", price: 79.2 },
      { date: "Mar 23", price: 78.8 },
      { date: "Mar 24", price: 79.1 },
      { date: "Mar 25", price: 78.6 },
      { date: "Mar 26", price: 78.42 },
    ],
    news: [
      {
        title: "Alibaba stock rises after earnings beat",
        source: "Reuters",
        time: "2026-03-25",
      },
      {
        title: "Chinese tech stocks gain on regulatory easing",
        source: "Bloomberg",
        time: "2026-03-24",
      },
      {
        title: "Alibaba Cloud revenue accelerates in Q1",
        source: "TechCrunch",
        time: "2026-03-23",
      },
    ],
    sources: [
      {
        title: "Yahoo Finance - BABA",
        url: "https://finance.yahoo.com",
      },
      {
        title: "Investor Relations",
        url: "https://www.alibabagroup.com",
      },
    ],
    confidence: "high",
    risk_note: "Tech sector volatility. Geopolitical risks may impact future performance.",
  },
  {
    query_type: "analysis",
    asset: {
      symbol: "TSLA",
      name: "Tesla Inc.",
    },
    summary:
      "Tesla's recent 7-day performance shows strong upward momentum with a 5.2% weekly gain. The stock closed at $142.35 today, up 2.1% from the previous day. This surge is driven by positive earnings projections and increased institutional buying interest in the EV sector.",
    key_metrics: {
      price: 142.35,
      change_1d: 2.1,
      change_7d_pct: 5.2,
    },
    chart_data: [
      { date: "Mar 15", price: 132.4 },
      { date: "Mar 16", price: 134.2 },
      { date: "Mar 17", price: 135.8 },
      { date: "Mar 18", price: 136.5 },
      { date: "Mar 19", price: 138.2 },
      { date: "Mar 20", price: 139.1 },
      { date: "Mar 21", price: 140.3 },
      { date: "Mar 22", price: 141.2 },
      { date: "Mar 23", price: 140.8 },
      { date: "Mar 24", price: 141.9 },
      { date: "Mar 25", price: 142.35 },
    ],
    news: [
      {
        title: "Tesla reports record quarterly deliveries",
        source: "CNBC",
        time: "2026-03-25",
      },
      {
        title: "Musk hints at major production expansion",
        source: "Wall Street Journal",
        time: "2026-03-24",
      },
      {
        title: "EV makers rally on new government incentives",
        source: "Financial Times",
        time: "2026-03-23",
      },
    ],
    sources: [
      {
        title: "Tesla Investor Relations",
        url: "https://ir.tesla.com",
      },
      {
        title: "MarketWatch - TSLA",
        url: "https://www.marketwatch.com",
      },
    ],
    confidence: "high",
    risk_note: "EV market competition intensifying. Production risks could impact margins.",
  },
  {
    query_type: "knowledge",
    asset: {
      symbol: "SPY",
      name: "S&P 500 ETF",
    },
    summary:
      "The S&P 500 continues to show resilience with the SPY ETF up 2.8% over the past week. Current trading at $432.15, the index reflects broad-based market strength with technology and consumer discretionary sectors leading gains. Fed policy expectations remain a key driver of market sentiment.",
    key_metrics: {
      price: 432.15,
      change_1d: 0.8,
      change_7d_pct: 2.8,
    },
    chart_data: [
      { date: "Mar 15", price: 415.2 },
      { date: "Mar 16", price: 418.5 },
      { date: "Mar 17", price: 420.1 },
      { date: "Mar 18", price: 422.3 },
      { date: "Mar 19", price: 424.7 },
      { date: "Mar 20", price: 426.2 },
      { date: "Mar 21", price: 428.4 },
      { date: "Mar 22", price: 429.8 },
      { date: "Mar 23", price: 430.5 },
      { date: "Mar 24", price: 431.2 },
      { date: "Mar 25", price: 432.15 },
    ],
    news: [
      {
        title: "S&P 500 reaches new record highs",
        source: "Markets Insider",
        time: "2026-03-25",
      },
      {
        title: "Fed signals patient stance on rate hikes",
        source: "Reuters",
        time: "2026-03-24",
      },
      {
        title: "Corporate earnings beat expectations",
        source: "Seeking Alpha",
        time: "2026-03-23",
      },
    ],
    sources: [
      {
        title: "Vanguard SPY ETF Information",
        url: "https://investor.vanguard.com",
      },
      {
        title: "CNBC Markets",
        url: "https://www.cnbc.com/markets",
      },
    ],
    confidence: "medium",
    risk_note: "Inflation concerns and geopolitical uncertainties may create volatility.",
  },
];
