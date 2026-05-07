# 雨课堂练习题库自动化复现工作流

这份文档写给想复现整套流程的人。目标不是“攻破平台”，而是在本人账号、非计分、老师允许反复练习的前提下，把随机小测自动化为本地题库采集和复习资料整理流程。

## 1. 边界和准备

只在以下条件同时满足时使用：

- 使用自己的账号。
- 小测明确不计入成绩。
- 老师允许反复练习或练习回收。
- 只保存本地学习材料，不公开传播课程题库。

不要把 Cookie、登录态、课程 URL、题库数据发给别人，也不要把它们提交到 GitHub。

## 2. 项目结构

```text
.
├─ src/
│  ├─ yuketang-runner.js       # 普通 UI/网络采集 runner
│  └─ yuketang-fast-runner.js  # 快速重复作答 runner
├─ scripts/
│  └─ create_question_bank_docx.py
├─ secrets/
│  └─ yuketang-cookies.example.json
├─ data/                       # 本地题库和每轮原始材料，默认忽略
└─ docs/
```

普通 runner 更稳，适合首轮登录、探页面、留档；快跑版更快，适合已经确认页面结构后连续采集随机题。

## 3. 安装

```powershell
npm.cmd install
npx.cmd playwright install chromium
```

Word 导出需要 Python 和 `python-docx`。如果本机没有：

```powershell
python -m pip install python-docx
```

## 4. 登录方式

推荐方式是持久浏览器配置：

1. 运行普通 runner，保持默认有头浏览器。
2. 在弹出的 Chromium 里扫码或账号登录。
3. 登录态会保存在 `.playwright-profile/`，后续本机复用。

也可以把浏览器导出的 Cookie 放入 `secrets/yuketang-cookies.json`，再用 `--cookies` 注入。但这只是本机调试方式，不要把 Cookie 发给同学，不要进 Git。

## 5. 普通三档流程

普通 runner 会做三件事：

- 进入练习页并点击“开始/再次作答/继续作答”等入口。
- 从页面文本、HTML、截图、网络 JSON 中提取题干、选项和答案候选。
- 根据本地题库自动填已知答案；未知题按 `--unknown-policy` 处理。

先跑一轮不自动提交，确认页面能进：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --auto-fill --unknown-policy first --max-attempts 1
```

确认是非计分练习后，再循环：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --loop --stable 3 --auto-fill --auto-submit --unknown-policy random
```

参数说明：

- `--loop`：重复进入小测。
- `--stable 3`：连续 3 轮没有新题就停止。
- `--auto-fill`：自动填写已知答案。
- `--auto-submit`：自动提交，仅限允许反复提交的非计分练习。
- `--unknown-policy skip|first|random`：未知题跳过、选第一个或随机选。
- `--headed false`：无头模式。第一次不建议开。
- `--cookies secrets/yuketang-cookies.json`：从本地 Cookie 文件注入登录态。

## 6. 快跑版流程

快跑版用于已经确认真实答题页结构后的重复采集。它会直接进入 `changjiang-exam.yuketang.cn` 的 cover/start/result 路由，读取 `show_paper`，提交答案，然后进入结果页重新读取带答案的 paper。

运行示例：

```powershell
npm.cmd run fast -- --exam-id "<exam_id>" --attempts 50 --stable 3 --time-budget-sec 900
```

关键修正点：

- 不用模糊点击“开始”，因为页面上可能同时有“暂不开始”。
- 优先精确点击“再次作答”，再点确认框主按钮。
- 每轮必须检查 URL 是否进入 `/exam/`，没有进入就不算有效轮次。
- 判断题答案不能只看 A/B 文本，接口里常见 `true` / `false`，需要映射到“正确/错误”。
- 每轮保存 `paper.json`、`submit.json`、`answer-paper.json` 和结果文本，方便复盘。
- 开启 AI 时额外保存 `answer-decisions.json`，可看到每题来自题库、AI 还是 fallback。

停止条件同普通 runner：连续 `--stable` 轮 `new=0` 后停止。

## 7. AI 推断层

AI 推断层是可选的，只处理题库未命中的未知题。它不替代标准答案，主要用于“人来判断是否需要采纳”。

准备 API Key：

```powershell
$env:OPENAI_API_KEY="sk-..."
```

只记录建议，不自动填写：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --auto-fill --ai-suggest --unknown-policy skip
```

高置信度才自动填写：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --auto-fill --ai-fill --ai-min-confidence 0.85 --unknown-policy skip
```

快跑版也支持：

```powershell
npm.cmd run fast -- --exam-id "<exam_id>" --attempts 10 --stable 3 --ai-suggest
npm.cmd run fast -- --exam-id "<exam_id>" --attempts 10 --stable 3 --ai-fill --ai-min-confidence 0.85
```

输出：

- `data/ai-suggestions.jsonl`：每条未知题的 AI 建议、置信度、是否需要复核、简短理由。
- `data/raw/fast2-*/answer-decisions.json`：快跑版每题使用的答案来源。

建议人工判断规则：

- `needsReview=true` 不自动采纳。
- `confidence < 0.85` 不自动采纳。
- 政治理论题、概念辨析题、带“根本/首要/唯一/决定性”等绝对词的题，即使高置信度也建议人工看一眼。
- AI 建议不要写回 `correctLabels`；只有结果页或接口回收的标准答案才进入题库。

模型默认读取 `OPENAI_MODEL`，没设置时使用脚本默认模型。也可以显式传：

```powershell
npm.cmd run ykt -- --url "<url>" --auto-fill --ai-suggest --ai-model "gpt-5-mini"
```

## 8. 数据合并逻辑

每道题用“规范化题干 + 规范化选项”生成 fingerprint 去重。合并时会更新：

- `seenCount`
- `firstSeenAt` / `lastSeenAt`
- `attempts`
- `correctLabels`
- `correctTexts`
- `explanation`

这样同一道题在不同轮次出现时不会重复进题库，但可以补齐答案和解析。

## 9. 乱码问题怎么解决

这次最容易误判的是：PowerShell 显示乱码，不等于文件真的乱码。解决策略是分层处理。

文件读写层：

- Node 一律 `fs.readFileSync(path, "utf8")` / `writeFileSync(..., "utf8")`。
- Python 用默认 Unicode 字符串读写 JSON/DOCX，不用控制台显示作为依据。
- CSV 导出开头写 `\ufeff`，让 Excel 按 UTF-8 打开中文。

源码层：

- 对需要精准匹配的中文 UI 文案，尽量写 Unicode escape，例如 `"\u518d\u6b21\u4f5c\u7b54"` 表示“再次作答”。
- 避免在 PowerShell here-string 里临时写中文正则再 pipe 给 Node；这里曾出现中文被终端转码后导致正则语法坏掉的问题。
- 判断题、多选题等类型判断用 `.includes("\u591a\u9009")` 这类写法，少依赖控制台编码。

排查层：

- 用 `node --check src/yuketang-runner.js` 判断 JS 是否语法正常。
- 如需确认文件真实内容，用 Node 读取文件再把非 ASCII 打成 `\uXXXX`，不要只看 `Get-Content` 输出。
- README 在 PowerShell 里看着乱码时，用 VS Code、Word、浏览器或 Node UTF-8 读取确认。

Word 层：

- `scripts/create_question_bank_docx.py` 使用 `python-docx`。
- 正文字体设为 `Microsoft YaHei`。
- 同时设置 `w:eastAsia` 字体属性，否则 Word 可能对中文另选字体。

## 10. 留档和复盘

每轮至少保留这些材料：

- 题库总表：`data/question-bank.json`
- Excel 表：`data/question-bank.csv`
- 每轮摘要：`data/attempts.jsonl` 或 `data/fast-attempts.jsonl`
- 原始证据：`data/raw/...`
- 复习文档：运行 `python scripts\create_question_bank_docx.py`
- AI 建议：`data/ai-suggestions.jsonl`

如果同学复现失败，优先让他保留对应轮次的 `data/raw/...`，尤其是 `cover.txt`、`started.txt`、`paper.json`、`submit.json`，再根据实际页面调整选择器。

## 11. 给同学的最小交付包

可以给：

- `src/`
- `scripts/`
- `docs/`
- `README.md`
- `package.json`
- `package-lock.json`
- `secrets/yuketang-cookies.example.json`

不要给：

- `data/`
- `secrets/yuketang-cookies.json`
- `.playwright-profile/`
- 真实课程 URL、真实 exam id、用户 id、课堂 id
- 已采集题库和答案
- 带个人信息的截图、网络日志、Word 题库

## 12. 常见故障

登录失败：

先用有头模式打开，手动登录一次，让 `.playwright-profile/` 保存状态。

连续进入同一个封面页：

检查是否点到了“暂不开始”。快跑版已经改成精确点击“再次作答”和主按钮，并验证 `/exam/`。

题目只有很少几道：

看 `fast-attempts.jsonl` 里的 `begin.isExam` 和 `newCount`。没有进 `/exam/` 的轮次不能算有效随机抽题。

Excel 打开 CSV 乱码：

确认导出的 `question-bank.csv` 文件开头带 BOM；本项目导出函数已经写入 `\ufeff`。

Word 中文字体怪：

确认 `create_question_bank_docx.py` 里设置了 `w:eastAsia`，并且电脑上有 `Microsoft YaHei`。
