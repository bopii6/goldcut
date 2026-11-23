# 金剪 goldcut

**给一个话题，自动出一条财经/科技解读竖屏短片（1080×1920，带配音、字幕、音效）。**
不依赖 Claude、不依赖任何 Agent 工具：DeepSeek 负责联网调研和写稿，本地负责配音和逐帧渲染。

```
话题 ──► DeepSeek 深度联网搜索 ──► 调研简报 + 来源
           （deepseek_web_search，搜索免费，只算 token）
     ──► 从引用的新闻网页取头图
     ──► DeepSeek 写口播文案 + 镜头表（JSON）
     ──► edge-tts 配音，逐字时间线
     ──► 镜头表检查（出错交回 DeepSeek 修，还不行换兜底镜头）
     ──► Playwright 逐帧渲染（vpro 竖屏组件）──► ffmpeg 混音合成 ──► mp4
```

## 准备

需要：Node 18+、Python 3.10+、ffmpeg（在 PATH 里）、Chrome 或 Edge（Windows 自带 Edge 就行）。

```powershell
npm install
pip install edge-tts numpy
```

DeepSeek API Key：到 <https://platform.deepseek.com/api_keys> 创建。可以在网页界面里填，或者在项目根目录建 `.env`：

```
DEEPSEEK_API_KEY=sk-...
```

## 用

**网页界面**（推荐）：

```powershell
npm start
```

浏览器打开 <http://127.0.0.1:5178>：

- **视频类型**（决定叙事结构和镜头，不只是颜色）：
  | 类型 | 结构 | 专用镜头和常驻元素 |
  |---|---|---|
  | 财经解读 | 钩子 → 证据 → 因果 → 结论 | 大数字、问号、对比、因果链、走势线……模型自由选镜头 |
  | 新闻速报 | 今天 N 件事 → 每条：标题 → 关键数字 → 点评 → 回顾 | 顶部栏目和日期、条数进度 01/04、底部滚动快讯条 |
  | 榜单盘点 | TOP N → 从第 N 名倒数到第 1 → 总榜 | 名次巨字砸下、按比例长的数据条、第一名放射光；右侧名次栏逐个点亮 |
  | 知识科普 | 抛问题 → 分步讲（流程 / 打个比方 / 要点）→ 总结 | 流程框逐个连线、类比对照、要点卡；顶部章节导航 ①②③ |

  除财经解读外，DeepSeek 只按类型的结构写内容，镜头由程序按固定骨架拼（`app/lib/formats.mjs` + `kit/fmt.js`），所以每种类型的结构是稳定的。命令行用 `--format news|rank|explain`，离线示例 `--sample news|rank|explain`。
- **新建**：写话题，选视频类型、时长、声音、配乐、画质和**画面风格**，点「开始创作」。风格有五套：金融夜（深色立体金字）、科技霓虹（黑底网格、青紫发光）、杂志纸感（米白纸面、黑墨卡片、红色点缀）、快讯红（炭黑底、红色快讯条）、极简黑白（纯黑平面、一点亮黄）。做完的片子也能在「本片设置」里换风格重新出片，不花 DeepSeek 的钱。风格定义在 `app/lib/styles.mjs`，加一套就是一组颜色加一段 CSS。
- **审稿**（默认打开）：写完稿先停下来。每一句口播、每一镜屏上的字和配图都能直接改；不满意的镜头点「重写」，写一句要求（"换成柱状图""突出 37% 这个数"）让 AI 只重做这一镜，或者从下拉里直接换一种画面。改完点「开始出片」。
- **出片**：实时看进度（调研到了哪些来源、找到哪些图、渲染还要多久）。做好后能播放、下载、复制文案；之后改了分镜或换了声音、配乐，点「重新出片」就行，不用重新调研、不花 DeepSeek 的钱。
- **作品**：所有项目按状态分类，带封面、时长、花费。删除会挪到 `films/_trash`，能找回。
- **设置**：API Key、默认声音、渲染路数；左下角显示本月花费。深色 / 浅色可切换，手机上也能用。

成片里自带：片尾卡（片名 + 栏目名）、配乐（内置两段合成垫乐，按内容自动选紧张或明快；想用自己的音乐，把 mp3 放进 `music/` 文件夹）、换镜风声和重音撞击、字幕。

**命令行**：

```powershell
node app/cli.mjs "英伟达最新财报为什么股价反而跌"
node app/cli.mjs "黄金为什么一直涨" --seconds 90 --h 1080 --voice zh-CN-XiaoxiaoNeural --brand 金剪
```

**离线试渲染**（不调 DeepSeek、不花钱，用一份示例计划测本机的配音和渲染）：

```powershell
npm run demo
```

成片和中间文件都在 `films/<时间>_<话题>/`：`*.mp4` 成片、`research.md` 调研简报、`sources.md` 文案和来源、`plan.json` 文案和镜头表、`film.js` 可以手改后重渲（`node scripts/render.mjs --dir films/... --video --h 1080`）。

## 花多少钱

- 联网搜索：DeepSeek 服务端搜索工具从 2026-11-18 起不按次收费，只算 token。
- 模型：`deepseek-flash`，一条片大约几万到十几万 token，按官网价格是几分到几毛人民币（错峰时段再减半）。价格以 <https://api-docs.deepseek.com/quick_start/pricing> 为准。
- 配音：edge-tts，免费。渲染、混音都在本机。

## 配置（`.env`，都可以不写）

| 变量 | 默认 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | — | 必填 |
| `DEEPSEEK_MODEL` | `deepseek-flash` | 联网搜索只支持 flash |
| `GOLDCUT_VOICE` | `zh-CN-YunxiNeural` | edge-tts 声音 |
| `GOLDCUT_FILMS_DIR` | `films` | 片子放哪 |
| `GOLDCUT_WORKERS` | `2` | 并行渲染路数（内存大可以开 3–4） |
| `GOLDCUT_PORT` | `5178` | 网页端口 |
| `PYTHON` | `python` | Python 命令 |

## 字体

模板用 Bebas Neue、阿里妈妈数黑体、MiSans、Montserrat。没装也能出片：会自动退到系统字体（Impact、微软雅黑、Segoe UI）。想要原版的样子，把字体文件放进 `fonts/`（文件名见 `kit/kit.css`），或在 `scripts/local.json` 写 `{"fonts_dir": "D:/fonts"}`。

## 代码在哪

| | |
|---|---|
| `app/server.mjs` `app/web/` | 本机网页界面（只监听 127.0.0.1）：项目接口、任务队列、实时进度（SSE） |
| `app/lib/cost.mjs` | 每次调 DeepSeek 记账，按高峰 / 错峰价算花费（`usage.json`） |
| `app/lib/bed.py` | 合成垫乐（没有版权问题） |
| `app/cli.mjs` | 命令行 |
| `app/lib/research.mjs` | 联网调研（DeepSeek 深度思考搜索） |
| `app/lib/writer.mjs` `app/lib/catalog.mjs` | 写文案和镜头表、校正成渲染器一定能吃的样子 |
| `app/lib/images.mjs` | 从来源网页取头图 |
| `app/lib/film.mjs` `app/lib/pipeline.mjs` | 建工程、配音、检查、渲染、混音、合成 |
| `kit/` `scripts/` | 原来的渲染引擎和组件库（vpro 竖屏组件、render.mjs、temp_voice.py、mix.py） |
| `SKILL.md` `references/` | 原来给 Claude Code 用的技能文档，手工精修片子时还能参考 |

## 已知限制

- 全自动版只用不需要抠像、截图的 16 个组件（大数字、问号、对比、柱状、因果链、要点、走势、时间线、占比、排行、引语、新闻图等）。真人口播、当事人抠像、新闻原文刷黄这些还要按 `SKILL.md` 手工做。
- 配图来自来源网页的头图，版权归原网站，`sources.md` 里记了出处；公开发布前自己确认能不能用。
- 屏上的数字来自 DeepSeek 的调研，模型也会出错：发布前对一遍 `research.md` 里的来源。

## 来历

渲染引擎来自 [wallstreet-explainer](https://github.com/HeyChengC/wallstreet-explainer)（MIT），goldcut 是它的改名副本；`app/` 是在它上面加的独立应用层。更新记录见 `CHANGELOG.md`。
