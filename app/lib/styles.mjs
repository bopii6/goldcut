// 视觉风格：同一套 vpro 组件，换一组颜色变量 + 一层 CSS，就是另一种气质。不改渲染引擎。
// 每个风格：
//   theme   传给 KIT_VPRO.theme 的颜色（卡片底、字、立体数字的渐变、四个轮换色）；accent:null = 用 DeepSeek 按题目挑的主色
//   pattern 底纹（null = 按题目挑）
//   css     追加到片子 film.css 的样式：背景、底纹、字幕、接缝、角标
//   music   默认配乐情绪（auto = 按内容判断）
//   swatch  界面上风格卡的预览色
export const STYLES = {
  night: {
    name: '金融夜', desc: '深色织物底、立体金字，小Lin说那种财经解读', swatch: ['#0b0d1a', '#e3b45c', '#7cc4c0'],
    theme: {accent: null}, pattern: null, music: 'auto', css: '',
  },

  neon: {
    name: '科技霓虹', desc: '黑底网格、青紫发光，适合 AI、芯片、互联网', swatch: ['#03050c', '#3ee0ff', '#ff4fd8'],
    theme: {accent: '#35d6f5', palette: ['#35d6f5', '#ff5bd6', '#8f7dff', '#a8f05a'], card1: '#0d1a33', card2: '#04070f', ink: '#ecf8ff',
      num1: '#d8fbff', num2: '#33c3ea', num3: '#0b3557', up1: '#7ff3ff', up2: '#1679a8', cool: '#ff8be6'},
    pattern: 'chart', music: 'bright',
    css: `
.v-bgt{background-color:#02040a;background-image:radial-gradient(ellipse 70% 45% at 50% 30%,rgba(53,214,245,.16),transparent 70%),radial-gradient(ellipse 60% 40% at 80% 85%,rgba(255,91,214,.12),transparent 70%),linear-gradient(rgba(53,214,245,.07) 2px,transparent 2px),linear-gradient(90deg,rgba(53,214,245,.07) 2px,transparent 2px);background-size:auto,auto,72px 72px,72px 72px}
.v-bgt::after{opacity:.25}
.vp-tint{background:linear-gradient(170deg,rgba(4,10,26,.55),rgba(2,4,12,.92) 78%)!important}
.vp-tint::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(53,214,245,.08) 2px,transparent 2px),linear-gradient(90deg,rgba(53,214,245,.08) 2px,transparent 2px);background-size:72px 72px;-webkit-mask-image:linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent);mask-image:linear-gradient(180deg,transparent,#000 30%,#000 70%,transparent)}
.vp-dots{background-image:radial-gradient(rgba(53,214,245,.22) 1.7px,transparent 2.2px)!important}
.v-band img.m{filter:saturate(.5) brightness(.4) hue-rotate(-12deg)!important}
.vp-p .b{-webkit-text-stroke-color:#020611!important;filter:drop-shadow(0 0 18px rgba(53,214,245,.35))}
.vp-back{filter:drop-shadow(0 0 30px rgba(53,214,245,.45)) drop-shadow(0 10px 0 #06203a)!important}
.v-seam{background:linear-gradient(90deg,#35d6f5,#ff5bd6)!important;box-shadow:0 0 18px rgba(53,214,245,.8)}
.v-band img.m{filter:saturate(.45) brightness(.3) hue-rotate(-12deg)!important}
.vp-vs,.vp-link,.vp-row,.vp-tli,.vp-rk,.vp-read,.vp-qc,.vp-stamp,.vp-note,.vp-bar,.vp-say{box-shadow:0 0 0 2px rgba(53,214,245,.95),0 0 26px rgba(53,214,245,.5),inset 0 0 30px rgba(53,214,245,.12),0 24px 60px rgba(0,0,0,.65)!important}
.vp-rk.hl,.vp-row.hl,.vp-link.hl,.vp-tli.hl{box-shadow:0 0 0 2px #ff5bd6,0 0 30px rgba(255,91,214,.6),inset 0 0 30px rgba(255,91,214,.15),0 24px 60px rgba(0,0,0,.65)!important}
.v-h{text-shadow:0 0 26px rgba(53,214,245,.7),0 2px 4px rgba(0,0,0,.8)!important}
.v-h em{color:#35d6f5!important}
.v-brow{color:#ff8be6!important;letter-spacing:10px!important}
#stage::before{content:'';position:absolute;left:0;top:0;width:1080px;height:1574px;z-index:79;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(0,0,0,.18) 0 2px,transparent 2px 5px);mix-blend-mode:multiply}
.v-brandpill{background:#02040a!important;color:#35d6f5!important;border-color:#35d6f5!important;box-shadow:0 0 0 4px #02040a,0 0 22px rgba(53,214,245,.7)!important}
.sub{-webkit-text-stroke:6px #020611!important;text-shadow:0 0 22px rgba(53,214,245,.55),0 3px 10px rgba(0,0,0,.8)!important}`,
  },

  paper: {
    name: '杂志纸感', desc: '米白纸张、黑字红点缀，像财经杂志的版面', swatch: ['#efe8da', '#1d1b18', '#d6452f'],
    // 卡片是"黑墨块"（渲染引擎的卡片默认是深色的，浅色卡上白字会看不见），纸面上的标题、字幕改成深色
    theme: {accent: '#d2412b', palette: ['#d2412b', '#1f6f8b', '#c98a12', '#4a4e69'], card1: '#2c2925', card2: '#1a1816', ink: '#fbf6ea',
      hi: '#ffab94', lo: '#5c170c', num1: '#2b2723', num2: '#3f3a34', num3: '#857a6b', up1: '#e0614a', up2: '#8e2414', cool: '#5a9ab4'},
    pattern: 'chart', music: 'bright',
    css: `
#stage{background:#e9e2d3;--fx-on:#1d1b18}
.fx-hl,.fx-step span,.fx-rname,.fx-date,.fx-bar b,.fx-fb b,.fx-rail .nm,.fx-nbar span{text-shadow:none!important}
.fx-date{text-shadow:0 6px 0 rgba(210,65,43,.35)!important}
.fx-tick{box-shadow:0 -3px 0 #1d1b18!important}
.fx-fb i{background:linear-gradient(180deg,#5a534a,#2c2925)!important}
.fx-fb.one b,.fx-fb.one em,.fx-rsub,.fx-step b,.fx-src,.fx-ana u{color:#d2412b!important}
.fx-src{border-color:#d2412b!important}
.fx-no{-webkit-text-stroke-color:#d2412b!important}
.fx-ghost{-webkit-text-stroke-color:rgba(210,65,43,.35)!important}
.fx-rail .sl{box-shadow:0 0 0 3px #1d1b18!important}
.fx-rail .ln{background:rgba(29,27,24,.25)!important}
.v-bgt{background-color:#ece5d6;background-image:radial-gradient(ellipse 85% 55% at 50% 36%,rgba(255,255,255,.7),rgba(255,255,255,0) 70%)}
.v-bgt::after{opacity:.09;filter:invert(1)}
.vp-tint{background:linear-gradient(170deg,rgba(242,236,224,.86),rgba(230,222,206,.95) 80%)!important}
.vp-tint::after{opacity:.35!important;mix-blend-mode:multiply!important}
.vp-dots{background-image:radial-gradient(rgba(30,25,20,.13) 1.6px,transparent 2.1px)!important}
.v-band img.m{filter:grayscale(.35) sepia(.25) brightness(1.02) contrast(.92) opacity(.32)!important}
.vp-vs,.vp-link,.vp-row,.vp-tli,.vp-rk,.vp-read,.vp-qc,.vp-stamp,.vp-note,.vp-bar,.vp-say{box-shadow:0 0 0 3px #1d1b18,10px 12px 0 0 rgba(29,27,24,.85)!important}
.vp-colv{color:#1d1b18!important;text-shadow:none!important}
.vp-colv.hl{color:#d2412b!important}
.vp-base{background:#1d1b18!important}
.vp-ringn{color:#1d1b18!important;text-shadow:none!important}
.vp-ringl{color:#3a352f!important;text-shadow:none!important}
.vp-en{color:#1d1b18!important;text-shadow:none!important}
.v-en{color:#4a443c!important}
.v-h{color:#1d1b18!important;text-shadow:none!important}
.v-h em{color:#d2412b!important}
.v-brow{color:#d2412b!important;text-shadow:none!important}
.vp-back{filter:drop-shadow(0 8px 0 rgba(29,27,24,.18))!important}
.vp-back.lit{background-image:linear-gradient(180deg,#e2563f,#d2412b 55%,#8e2414)!important;filter:drop-shadow(0 8px 0 #5c170c)!important}
.v-seam{background:#1d1b18!important}
.v-bar{background:#1d1b18!important}
.v-brandpill{background:#d2412b!important;color:#fff!important;border-color:#1d1b18!important;box-shadow:0 0 0 5px #ece5d6!important}
.sub{left:50%!important;right:auto!important;transform:translateX(-50%);width:max-content;max-width:1000px;padding:4px 26px 8px;border-radius:6px;background:#1d1b18;color:#fbf6ea!important;-webkit-text-stroke:0!important;text-shadow:none!important;box-shadow:8px 8px 0 rgba(210,65,43,.9)}`,
  },

  breaking: {
    name: '快讯红', desc: '炭黑底、红色快讯条，适合突发、暴跌、政策', swatch: ['#0e0e10', '#ff3b30', '#f4f4f4'],
    theme: {accent: '#ff3b30', palette: ['#ff3b30', '#ffb020', '#d9dde3', '#5ab0fa'], card1: '#232328', card2: '#0c0c0e', ink: '#ffffff',
      num1: '#ffffff', num2: '#ffb3ad', num3: '#7a1410', up1: '#ff6a5f', up2: '#a3160e', cool: '#9fb4c8'},
    pattern: 'chart', music: 'tense',
    css: `
.v-bgt{background-color:#0b0b0d;background-image:radial-gradient(ellipse 85% 55% at 50% 30%,rgba(255,59,48,.12),transparent 70%),repeating-linear-gradient(135deg,rgba(255,255,255,.025) 0 2px,transparent 2px 22px)}
.v-bgt::after{opacity:.18}
.vp-tint{background:linear-gradient(170deg,rgba(24,24,28,.7),rgba(8,8,10,.94) 80%)!important}
.vp-dots{background-image:radial-gradient(rgba(255,255,255,.1) 1.7px,transparent 2.2px)!important}
.v-band img.m{filter:grayscale(.55) contrast(1.1) brightness(.42)!important}
.v-seam{background:#ff3b30!important;height:8px!important;top:1566px!important}
.v-brandpill{background:#ff3b30!important;color:#fff!important;border-color:#0b0b0d!important;box-shadow:0 0 0 5px #0b0b0d!important}
#stage:has(.fx-nbar,.fx-nav)::after{display:none}
.v-h em,.v-brow{color:#ff5a4f!important}
#stage::after{content:'快讯  BREAKING';position:absolute;left:0;top:58px;z-index:85;padding:10px 30px 9px 40px;background:#ff3b30;color:#fff;font:800 34px Mi,sans-serif;letter-spacing:6px;box-shadow:8px 8px 0 rgba(0,0,0,.45)}
.sub{-webkit-text-stroke:6px #0b0b0d!important}`,
  },

  mono: {
    name: '极简黑白', desc: '纯黑底、白字、一点亮黄，克制、高级、信息密度高', swatch: ['#000000', '#ffffff', '#ffd21f'],
    theme: {accent: '#ffd21f', palette: ['#ffd21f', '#f2f2f2', '#9aa0a6', '#ffd21f'], card1: '#1a1a1a', card2: '#050505', ink: '#ffffff',
      hi: '#fff3b0', lo: '#5c4a00', num1: '#ffffff', num2: '#d6d6d6', num3: '#4a4a4a', up1: '#ffd21f', up2: '#8a6f00', cool: '#bdbdbd'},
    pattern: 'chart', music: 'auto',
    css: `
#stage{background:#000}
.v-bgt{background:#000!important}
.v-bgt::after{display:none}
.vp-tint{background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.92) 75%)!important}
.vp-tint::after{display:none}
.vp-dots{display:none}
.v-band img.m{filter:grayscale(1) contrast(1.15) brightness(.4)!important}
.vp-p .b{text-shadow:.03em .04em 0 #000,0 .1em .16em rgba(0,0,0,.5)!important}
.vp-back{filter:none!important}
.v-seam{background:#ffd21f!important;height:4px!important}
.v-brandpill{background:#ffd21f!important;color:#000!important;border-color:#000!important;box-shadow:0 0 0 5px #000!important}
.v-h em,.v-brow{color:#ffd21f!important}
.v-h{text-shadow:none!important}
.vp-vs,.vp-link,.vp-row,.vp-tli,.vp-rk,.vp-read,.vp-qc,.vp-stamp,.vp-note,.vp-bar,.vp-say{background:#0b0b0b!important;box-shadow:0 0 0 2px rgba(255,255,255,.88)!important}
.vp-rk.hl,.vp-row.hl,.vp-link.hl,.vp-tli.hl{box-shadow:0 0 0 3px #ffd21f!important}
.vp-back,.vp-back.lit{background-image:linear-gradient(#fff,#fff)!important;filter:none!important}
.vp-p .b{text-shadow:none!important;-webkit-text-stroke:0!important}
.vp-p .f{-webkit-text-stroke:0!important}
.vp-col,.vp-col.hl{box-shadow:none!important}
.vp-colv,.vp-ringn,.vp-ringl{text-shadow:none!important}
.sub{font-weight:700!important;-webkit-text-stroke:5px #000!important;text-shadow:none!important}`,
  },
};

export const STYLE_IDS = Object.keys(STYLES);
export const styleOf = id => STYLES[id] ?? STYLES.night;
export const styleList = () => STYLE_IDS.map(id => ({id, name: STYLES[id].name, desc: STYLES[id].desc, swatch: STYLES[id].swatch, music: STYLES[id].music}));
