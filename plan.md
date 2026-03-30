# 📊 Financial Asset QA System — Development Plan（Revised）

***

## 1. Project Overview

This project builds a **full-stack LLM-powered financial QA system**, with a focus on:

- Data-first answers (no hallucinated numbers)
- Structured response generation
- Query routing + pipeline orchestration
- End-to-end traceability (debuggable system)

Core capabilities:

1. Asset Market QA (price / trend)
2. Market Analysis (data + news reasoning)
3. Financial Knowledge QA (RAG)

***

# 🚨 2. System Architecture（强化：接口优先 + 闭环设计）

## 2.1 Design Philosophy（新增关键原则）

> ❗System is NOT chat-first, but pipeline-first

- API-first design (NOT UI-first)
- Structured output > natural language
- One query → one deterministic pipeline
- Frontend is only a renderer

***

## 2.2 Overall Architecture（保持但补充闭环）

```
Frontend (Next.js UI)
        ↓
Backend API (/api/query)  ← ⭐唯一入口
        ↓
Query Router
   ├── Market Pipeline
   ├── Analysis Pipeline
   └── RAG Pipeline
        ↓
Data Layer (API / Vector DB / Web)
        ↓
LLM (Controlled Generation ONLY)
        ↓
Structured JSON Response  ← ⭐核心契约
        ↓
Frontend Rendering
```

***

## 2.3 ⭐ Core API Contract（新增，最重要）

> ❗前后端唯一协议，必须先定义

```
{
  "query_type": "market | analysis | knowledge",
  "asset": {
    "symbol": "BABA",
    "name": "Alibaba Group"
  },
  "summary": "自然语言总结（LLM生成）",
  "key_metrics": {
    "price": 78.42,
    "change_7d_pct": 3.8
  },
  "chart_data": [],
  "news": [],
  "sources": [],
  "confidence": "high | medium | low",
  "risk_note": "optional"
}
```

👉 前端 **只负责 render，不做逻辑判断**

***

## 2.4 ⭐ MVP Data Flow（新增：最小闭环）

> ❗必须先打通这一条

```
User Input
→ /api/query
→ Router (market)
→ Market API
→ Metrics calc
→ LLM summarize
→ JSON response
→ Frontend display
```

***

## 2.5 Project Structure（基本保持不变）

（你的结构已经很好，这里只补一句）

👉 backend/services = pipeline实现层\
👉 router = orchestration核心

***

# 3. Query Routing Design（优化：更贴近工程）

## 3.1 Query Types（明确 MVP 优先级）

Type

Priority

Example

market

⭐⭐⭐⭐⭐

price / trend

analysis

⭐⭐⭐⭐

why up/down

knowledge

⭐⭐⭐

definition

👉 ❗先只做好 market，再扩展

***

## 3.2 Routing Strategy（强化 deterministic）

### Step 1 — Rule-based (强约束)

```
if contains_price_keywords:
    return "market"
```

### Step 2 — LLM fallback（仅兜底）

👉 不允许直接 LLM 全权决定

***

# 4. Market Pipeline（强化：核心闭环）

## 4.1 Flow（明确模块职责）

```
Ticker Extractor
→ Market API
→ Metrics Engine
→ LLM (summary ONLY)
```

***

## 4.2 Hard Rules（强化）

❗ LLM 禁止：

- 编造价格
- 计算涨跌
- 生成时间序列

***

## 4.3 Metrics Layer（明确是“后端核心能力”）

```
def compute_metrics(prices):
    return {
        "current_price": ...,
        "change_1d": ...,
        "change_7d": ...
    }
```

***

## 4.4 Output Structure（对齐 API contract）

```
summary
key_metrics
chart_data
sources
```

***

# 5. Analysis Pipeline（拆清责任）

```
Market Data + News Retrieval → LLM Reasoning
```

新增规则：

- facts（数据）必须来自 API
- reasoning（原因）必须引用 sources
- 标记不确定性

***

# 6. RAG Pipeline（保持但强调约束）

## 新增关键点：

👉 RAG = “检索增强”，不是生成

必须：

- 返回 sources
- 标注引用内容
- 不允许超出文档推断

***

# 7. LLM Role（进一步收紧）

LLM ONLY does:

- summarize
- explain
- synthesize

LLM NEVER does:

- fetch data
- compute metrics
- fabricate facts

***

# 8. Prompt Design（小幅优化）

## Market Prompt（更强约束）

```
You MUST ONLY use provided data.
DO NOT generate any numbers.
```

***

# 9. API Design（强化统一入口）

## 9.1 Core Endpoint

```
POST /api/query
```

👉 ❗所有请求统一入口（避免前端分叉逻辑）

***

## 9.2 Internal APIs（backend内部）

```
/market
/rag
/news
```

***

# 10. Frontend Design（重大调整）

## ❗从“页面驱动” → “数据驱动”

Frontend ONLY:

- Input box
- Structured renderer

***

## 10.1 UI Modules（建议结构）

1. Query Input
2. Summary Block
3. Metrics Block
4. Chart Block
5. News Block
6. Sources Block

***

## 10.2 ❗Frontend Principle

👉 UI = JSON renderer

***

# 11. Monitoring & Analytics（基本保留 + 补充）

新增一个关键点：

## ⭐ Pipeline Debug Trace

```
{
  "query": "...",
  "router": "market",
  "steps": [
    "ticker_extracted",
    "market_api_called",
    "metrics_computed",
    "llm_called"
  ]
}
```

👉 非常关键（debug用）

***

# 12. Anti-Hallucination Strategy（强化）

新增：

- strict schema validation（Pydantic）
- response guard layer

***

# 13. Tech Stack（不变）

***

# 14. MVP Scope（重写，更清晰）

## Phase 1（必须完成）

👉 ONLY：

- market query
- 单资产
- 单轮对话
- JSON输出

👉 ❗目标：打通闭环

***

## Phase 2

- analysis
- chart
- RAG

***

# 15. ⭐ Development Strategy（新增最关键）

## Step 1 — Define API contract ✅ DONE
- `shared/queryContract.ts`: full Zod schemas for request, success, error, trace
- `schema_version: v1`, strict field types, validated on both sides

## Step 2 — Build backend skeleton ✅ DONE
- `POST /api/query` live (not mock): ticker extract → route → market API → metrics → LLM summary → validated JSON
- Error shape matches contract; `correlation_id` on every response
- Global request timeout middleware (REQUEST_TIMEOUT_MS)

## Step 3 — Connect real market API ✅ DONE
- Finnhub `/quote` + `/stock/candle` (14-day window)
- 15s in-memory quote cache; exponential backoff retry (up to 3×) on 429/5xx
- `computeMarketMetrics`: `current_price`, `change_1d_pct`, `change_7d_pct`
- ⚠️ Note: requires valid `FINNHUB_API_KEY` in `.env` (401 = bad/missing key)

## Step 4 — Add LLM summary ✅ DONE
- `summarizeIfPossible`: calls OpenAI with strict prompt (no invented numbers, max 256 tokens, temp 0.2)
- Deterministic fallback summary when `OPENAI_API_KEY` absent
- `risk_note` signals fallback mode to frontend

## Step 5 — Build frontend renderer ✅ DONE
- `QueryForm`: input + submit, Ctrl/⌘+Enter shortcut
- `ResultRenderer`: Summary block, Metrics block (price / 1d / 7d), Sources block, Trace block, Raw JSON block
- Schema-validated on receipt; error shape rendered separately

## Step 6 — Add routing + multi pipeline ✅ DONE
- Rule-based router: market / analysis / knowledge keywords (deterministic)
- LLM fallback when no rule matches (single classify call, temp 0)
- `route_decision` step added to `DebugStepNameSchema` and emitted in trace

## Step 7 — Populate chart_data ✅ DONE
- `buildChartData(candle)` maps Finnhub `c[]+t[]` → `ChartPoint[]`
- `MarketPipelineResult` now includes `chart_data`; passed through `query.ts`
- Frontend: `<Sparkline>` pure SVG component, green/red by direction, date range + min/max labels
- 2 new unit tests for `buildChartData`

## Step 8 — Analysis pipeline ✅ DONE
- `api/services/news.ts`: Finnhub `/company-news` with 5-min in-memory cache
- `api/services/analysis.ts`: market pipeline + news → LLM reasoning (cites headlines, marks uncertainty)
- `api/routes/query.ts`: branch on `query_type` — `analysis` uses analysis pipeline, `market` uses market pipeline
- `api/services/llm.ts`: add `analyzeWithLLM` (strict prompt: facts only from data, reasoning must cite news)
- Frontend `ResultRenderer`: News block (title, source, date, link)

## Step 9 — RAG pipeline (Phase 2) ✅ DONE
- Firestore-backed knowledge retrieval for `query_type=knowledge` (`api/services/rag.ts`)
- Knowledge base collection: `financial_knowledge_base` (supports incremental term additions)
- Retriever returns matched terms + source citations (definition/example/related_terms in source meta)
- `api/services/llm.ts`: knowledge prompt now constrained to KB excerpts only, with required inline citations `[KB-fin_xxx]`
- `api/routes/query.ts`: adds `rag_retrieval` trace step and appends KB sources to response
- Seed script: `npm run rag:seed` (`api/scripts/seedKnowledgeBase.ts`) with starter glossary JSON

***

# 16. ⭐ v1 Contract（MVP，消除歧义）

## 16.1 API Surface

- 单一入口：`POST /api/query`
- 兼容策略：弃用旧路径（如存在 `POST /api/chat/ask`），内部转发至 `/api/query`
- 认证：开发环境无认证；生产可选 `x-api-key`
- 超时与预算：请求超时 `10s`；LLM 最大 tokens `256`，温度 `0.2`

## 16.2 JSON 契约（版本 v1）

- `schema_version`: `v1`
- `query_type`: `market | analysis | knowledge`
- 前端仅渲染以下结构，字段类型与必选性严格校验

### Pydantic Schema（v1）

```python
from pydantic import BaseModel, Field, HttpUrl, confloat, constr, conlist
from typing import List, Literal, Optional

class Asset(BaseModel):
    symbol: constr(strip_whitespace=True, to_upper=True, min_length=1)
    name: Optional[str] = None

class KeyMetrics(BaseModel):
    price: confloat(ge=0)
    change_1d_pct: Optional[float] = None
    change_7d_pct: Optional[float] = None

class ChartPoint(BaseModel):
    t: int
    p: confloat(ge=0)

class NewsItem(BaseModel):
    title: str
    url: HttpUrl
    published_at: int
    source: str

class SourceRef(BaseModel):
    type: Literal["market_api", "news_api", "internal"]
    name: str
    url: Optional[HttpUrl] = None
    meta: Optional[dict] = None

class DebugStep(BaseModel):
    name: Literal[
        "ticker_extracted",
        "market_api_called",
        "metrics_computed",
        "llm_called",
    ]
    ok: bool
    dt_ms: int
    info: Optional[dict] = None

class QueryResponse(BaseModel):
    schema_version: Literal["v1"] = "v1"
    query_type: Literal["market", "analysis", "knowledge"]
    asset: Asset
    summary: str
    key_metrics: KeyMetrics
    chart_data: conlist(ChartPoint, max_items=0) = []
    news: conlist(NewsItem, max_items=0) = []
    sources: List[SourceRef]
    confidence: Literal["high", "medium", "low"]
    risk_note: Optional[str] = None
    trace: List[DebugStep]
```

### 示例请求

```json
{
  "query": "What's the current price of BABA?",
  "user_locale": "en-US"
}
```

### 示例响应

```json
{
  "schema_version": "v1",
  "query_type": "market",
  "asset": { "symbol": "BABA", "name": "Alibaba Group" },
  "summary": "Alibaba (BABA) is trading around $78.42; up ~3.8% over 7 days.",
  "key_metrics": { "price": 78.42, "change_7d_pct": 3.8 },
  "chart_data": [],
  "news": [],
  "sources": [
    { "type": "market_api", "name": "Finnhub", "url": "https://finnhub.io/" }
  ],
  "confidence": "high",
  "risk_note": null,
  "trace": [
    { "name": "ticker_extracted", "ok": true, "dt_ms": 2 },
    { "name": "market_api_called", "ok": true, "dt_ms": 84 },
    { "name": "metrics_computed", "ok": true, "dt_ms": 1 },
    { "name": "llm_called", "ok": true, "dt_ms": 310 }
  ]
}
```

## 16.3 路由策略（确定性优先）

- Market 关键词：`["price","quote","current","now","$","close","open","high","low","today","1d","7d","trend"]`
- Knowledge 关键词：`["what is","definition","explain","meaning","term"]`
- Analysis 关键词：`["why","cause","reason","because","due to","drivers"]`
- 无规则命中时，单次调用 LLM 分类作为兜底；在 trace 中记录 `route_decision`

## 16.4 资产范围与归一化

- Phase 1：仅支持美股单资产
- 符号：大小写不敏感，输出统一大写；优先美股主代码（如 `BABA`）
- 货币与时区：`USD`，`America/New_York`

## 16.5 市场数据源

- Provider：Finnhub
- Endpoint：`/quote` 获取现价/收盘价；`/stock/candle` 获取历史 OHLC
- 频控：60 req/min；`/quote` 缓存 15s；指数退避重试

## 16.6 指标定义（后端计算）

- `current_price`：交易时段用最新成交，否则用上一交易日官方收盘
- `change_1d_pct`：`(last_close_today - last_close_prev_day) / last_close_prev_day * 100`
- `change_7d_pct`：基于近 7 个交易日收盘，缺失则用上次有效收盘，四舍五入到 0.1%

## 16.7 LLM 使用与守护

- 模型：由 `LLM_MODEL` 环境变量指定，默认 `gpt-4.1-mini`
- 温度：`0.2`；最大 tokens：`256`
- 职责：仅基于提供的 metrics 与 sources 生成不含新数字的摘要
- 校验：严格 JSON Schema 校验，不合规时重试或降级并降低 `confidence`

## 16.8 错误负载形态

```json
{
  "schema_version": "v1",
  "error": {
    "code": "ASSET_NOT_FOUND | PROVIDER_ERROR | TIMEOUT | INVALID_QUERY",
    "message": "Human readable",
    "details": { "symbol": "..." }
  },
  "trace": []
}
```

## 16.9 Debug Trace（标准词汇）

- `ticker_extracted` → `market_api_called` → `metrics_computed` → `llm_called`
- 每步记录 `ok`、`dt_ms`、必要 `info`
- 响应包含相关 correlation id（由服务内部生成）

## 16.10 环境变量

- `MARKET_PROVIDER=finnhub`
- `FINNHUB_API_KEY`
- `APP_ENV=dev|prod`
- `LLM_MODEL=gpt-4.1-mini`
- `LLM_TEMPERATURE=0.2`
- `REQUEST_TIMEOUT_MS=10000`

## 16.11 前端渲染约定

- UI 为 JSON 渲染器，不分叉逻辑
- Loading/Empty/Error 依据契约字段渲染
