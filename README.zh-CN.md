# NOF1 快照文档

英文版: [README.md](./README.md)

本项目汇总了最新 Alpha Arena 的关键经验，帮助你理解并复现 NOF1 的模型编排流程。

## 目录
- [`prompt-structure.md`](./prompt-structure.md) — 系统提示、行情数据载荷、账户上下文与响应架构（含隐含交易规则）的深入解析。
- [`api-reference.md`](./api-reference.md) — 快照中公开的只读 REST 接口参考，含字段注释与轮询建议。
- [`prompt-template.md`](./prompt-template.md) — 可直接复用的提示模板，带占位符，便于还原对各模型的调用消息。

## 使用指南
1. **逆向提示词**：从 `prompt-structure.md` 开始还原调用模板，文档按出现顺序标注各段落与从 `failed_json_response_raw_text` 提炼的校验规则。
2. **回放决策循环**：结合 `/api/conversations` 输出模拟模型多轮循环，用 `/api/trades` 交叉验证成交与风险设置。
3. **对接实时数据**：参考 `api-reference.md` 中的端点清单，将行情、账户与分析数据接入你的系统；遵循建议的轮询频率，并注意 `/api/positions` 的 `limit` 行为。
4. **对比评测代理**：在接入新模型时复用相同响应架构；`prompt-structure.md` 记录了 NOF1 在执行 Hyperliquid 交易前所需的关键字段。

## 快照脚本使用（snapshot_nof1.py）
该脚本从 NOF1 公共 API 拉取只读数据，按照日期/时间分目录落盘，便于离线分析与回放。

### 运行环境
- Python ≥ 3.8（内置 `urllib`/`json`，无需额外依赖）

### 运行方式
```bash
python snapshot_nof1.py
```

### 行为与输出
- 基址：`https://nof1.ai/api`
- 拉取的端点（含回退顺序）：
  - `crypto-prices`
  - `positions`（优先尝试 `?limit=5000`，失败再回退）
  - `trades`
  - `account-totals`
  - `since-inception-values`
  - `leaderboard`
  - `analytics`
  - `conversations`
- 输出目录：`snapshots/nof1/<YYYY-MM-DD>/<HHMMSSZ>/`
  - 每个端点生成 `<key>.json`
  - 生成 `index.json` 作为清单，记录时间戳、相对路径与来源 URL

### 示例输出结构
```
snapshots/
    nof1/
      2025-10-28/
        070456Z/
          account-totals.json
          analytics.json
          conversations.json
          crypto-prices.json
          index.json
          leaderboard.json
          since-inception-values.json
          trades.json
```

## 更新文档
- 将后续快照导出放入 `snapshots/<timestamp>/`。
- 重新运行分析脚本或进行人工检查，并在这些 Markdown 文件中追加差异（建议加日期小节）。
- 示例与字段保持 ASCII 以兼容既有发布流程。
