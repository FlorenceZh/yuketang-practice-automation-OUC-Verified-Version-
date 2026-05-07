# GitHub 开源判断和清理清单

## 结论

不建议把当前工作目录原样开源。

适合开源的是一个清理后的“授权练习采集与本地题库整理工具”模板；不适合开源的是包含真实课程、真实题库、Cookie、登录状态、自动快刷默认配置的版本。

## 为什么不能原样公开

- Cookie 和 `.playwright-profile/` 等同于登录态，泄露后可能被别人直接使用账号。
- `data/` 里有课程题库、答案、截图、接口返回，可能涉及课程资料版权和个人学习记录。
- 真实课程 URL、课堂 ID、考试 ID、用户 ID 会暴露学校/课程上下文。
- 默认自动提交和快跑脚本如果没有边界说明，容易被误用到计分测验或考试。

## 可以公开的部分

- 通用 Playwright 框架。
- 本地 JSON/CSV/DOCX 题库整理逻辑。
- 去重、合并、导出、乱码处理经验。
- 示例 Cookie 文件，但只能保留占位符。
- 文档里的命令示例，但 URL 和 ID 必须占位。

## 必须保留在本地的部分

- `data/`
- `secrets/yuketang-cookies.json`
- `.playwright-profile/`
- `docx_render/`
- 真实题库 Word 文件
- OpenAI API Key 或任何 `.env` 文件
- 任何包含 `sessionid`、`csrftoken`、用户 ID、课堂 ID、考试 ID 的日志

## 开源前检查

运行敏感词扫描：

```powershell
Select-String -Path src\*.js,README.md,docs\*.md,package.json -Pattern 'sessionid|csrftoken|exam_id":|user_id|classroom_id|leaf_type_id|/lms/[^/]+/\d+/exam/\d+|changjiang-exam\.yuketang\.cn/(cover|start|result)/\d+'
```

检查 Git 将提交什么：

```powershell
git status --short
git diff --cached --stat
git diff --cached
```

确认 `.gitignore` 至少包含：

```text
node_modules/
data/
secrets/
.playwright-profile/
docx_render/
.env
*.log
*.docx
*.xlsx
*.csv
```

## 建议的公开方式

更稳妥的方案：

1. 新建一个干净仓库，不从当前目录直接 `git init`。
2. 只复制 `src/`、`scripts/`、`docs/`、`README.md`、`package.json`、`package-lock.json`。
3. 保留 `secrets/yuketang-cookies.example.json`，不要复制真实 `secrets/`。
4. 把默认命令写成需要显式传 `--url` 或 `--exam-id`。
5. README 第一屏写明：仅限本人账号、非计分练习、获得授权的学习场景。
6. 公开仓库默认不开启自动提交，示例里把 `--auto-submit` 放在单独的“确认授权后”段落。
7. AI 推断层默认关闭，公开文档要强调 AI 建议不是标准答案，并且不要把 API Key 写进仓库。

如果只是给同学复现，优先用私有仓库或压缩包交付清理版，比公开 GitHub 更合适。

## 命名建议

避免：

- 攻克雨课堂
- 刷课/刷题神器
- 雨课堂破解

推荐：

- `rain-classroom-practice-collector`
- `yuketang-practice-bank`
- `practice-quiz-archive-tool`

核心是把它定义成“练习资料归档工具”，而不是平台对抗工具。
