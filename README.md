# 雨课堂练习题库自动化

这是一个本地练习工具，用 Playwright 在网页端雨课堂/学堂云练习小测中重复进入非计分练习，采集随机题目、整理本地题库，并可导出 CSV 与 Word 复习版。

适用前提很重要：只用于本人账号、老师允许重复练习且不计入成绩的场景。不要用于考试、作业成绩、他人账号或任何绕过平台规则的用途。

## 快速开始

```powershell
npm.cmd install
npx.cmd playwright install chromium
```

第一次建议用可见浏览器，让脚本打开页面后自己扫码/登录：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --loop --stable 3 --auto-fill --unknown-policy first
```

确认这是非计分练习且允许反复提交后，才使用自动提交：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --loop --stable 3 --auto-fill --auto-submit --unknown-policy random
```

## AI 推断层

AI 推断层默认关闭。它只在题库没有命中答案时工作，并把建议写入 `data/ai-suggestions.jsonl`，方便人复核。

先设置 OpenAI API Key：

```powershell
$env:OPENAI_API_KEY="sk-..."
```

只让 AI 给建议、不自动填写：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --auto-fill --ai-suggest --unknown-policy skip
```

允许 AI 在高置信度时填写未知题：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --auto-fill --ai-fill --ai-min-confidence 0.85 --unknown-policy skip
```

让 AI 在第一遍直接作答所有未知题：

```powershell
npm.cmd run ykt -- --url "https://oucbk.yuketang.cn/pro/lms/<course>/<classroom>/exam/<leaf>" --auto-fill --ai-force-fill --unknown-policy skip
```

建议先用 `--ai-suggest` 让人看建议；确认这种课和题型表现稳定后，再在非计分练习里尝试 `--ai-fill` 或 `--ai-force-fill`。`--ai-force-fill` 会忽略置信度和复核标记，第一遍正确率取决于 AI 推断，可能出错。AI 建议不会写成标准答案，标准答案仍然只来自题库和结果页回收。

已经确认练习页能进入、想快速刷随机题库时，可使用快跑版。`--exam-id` 是进入真实答题页后 URL 或网络请求里的考试 ID，不要写进公开仓库。

```powershell
npm.cmd run fast -- --exam-id "<exam_id>" --attempts 50 --stable 3 --time-budget-sec 900
```

## 输出文件

- `data/question-bank.json`：主题库，按题干和选项去重。
- `data/question-bank.csv`：带 UTF-8 BOM 的表格导出，方便 Excel 打开。
- `data/attempts.jsonl`：普通 runner 每轮采集摘要。
- `data/fast-attempts.jsonl`：快跑版每轮提交和新增题记录。
- `data/ai-suggestions.jsonl`：AI 对未知题的建议、置信度和复核标记。
- `data/raw/attempt-*` / `data/raw/fast2-*`：每轮页面文本、HTML、截图、接口 JSON 等排查材料。
- `毛概题库_排版复习版.docx`：由 `scripts/create_question_bank_docx.py` 从本地题库生成的 Word 复习版。

`data/`、`secrets/`、`.playwright-profile/` 默认已被 `.gitignore` 忽略，不应该提交。

## 生成 Word

```powershell
python scripts\create_question_bank_docx.py
```

Word 生成脚本会读取 `data/question-bank.json`，输出排版后的复习文档。它使用 `python-docx`，并显式设置中文东亚字体，避免 Word 里出现中英文字体混乱。

## 复现和开源

完整复现流程见 [docs/WORKFLOW.md](docs/WORKFLOW.md)。

开源前的判断和清理清单见 [docs/OPEN_SOURCE.md](docs/OPEN_SOURCE.md)。简短结论：这套工具适合整理成“授权练习采集/本地题库整理工具”，不适合带着真实课程链接、题库数据、Cookie、登录状态或快刷默认配置直接公开。
