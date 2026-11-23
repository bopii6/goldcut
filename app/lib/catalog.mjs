// 给模型看的组件表：只放不需要抠像、截图的 vpro 组件（全自动能稳定出片的那些）。
// 参数的权威说明在 kit/vpro.js 每个组件的 help 里；这里是写给模型的精简版 + 每个组件允许的参数（多写的会被删掉）。
export const PATTERNS = ['chart', 'gold', 'coin', 'oil', 'car', 'rocket', 'bag'];

const COMMON = ['title', 'brow', 'bg', 'flat'];
export const SCENES = {
  'vp-words':    {keys: ['words', 'en', 'y', 'bg'], doc: `一两个要记住的关键词，大立体字卡着念到的字出现。words:[{text:'≤5字', at:'@b01:词', col:'white'|'accent'|'cool', fx:'flip'}]（最多 2 个，最后一个最大），en:'英文小字'。适合开场钩子、口头结论`},
  'vp-ask':      {keys: ['lines', 'at', 'bg'], doc: `把问题抛给观众，巨大问号压在后面。lines:['黄金为什么','反而跌']（1–2 行，每行≤6字，不写问号），at:['@b02','@b02:反']（每行的时刻）`},
  'vp-reject':   {keys: ['stamp', 'drop', 'bg'], doc: `转折/被拒/泼冷水：一个词砸下，另一个词从头顶掉下来。stamp:{text:'≤4字', at}，drop:{text:'≤4字', at, col:'cool'}`},
  'vp-verdict':  {keys: ['lines', 'at', 'en', 'sub', 'note', 'bg'], doc: `全片结论，最重的一镜（全片只用一次，并且这一镜写 hero:true）。lines:['问题出在','利率']（2 行，每行≤6字），at:[两行的时刻]，en:'英文小字'，sub:'出处小字'，note:{label:'谁的原话', text:'核过的原话，可用<em>重点</em>'}（可不写）`},
  'vp-number':   {keys: ['value', 'unit', 'label', 'pct', 'at', 'bg'], doc: `一个大数字。value:'1158' 或 '-6.9%' 或 '$104'（只写数字和符号，不带汉字），unit:'亿美元'，label:'单季营收 · 同比'，pct:'+103%'（可不写），at:'数字出现的时刻'`},
  'vp-bars':     {keys: ['items', 'unit', ...COMMON], doc: `几个数比大小，柱子往上长。items:[{label:'微软', value:'800', hl:true, at}]（2–5 根，value 是纯数字字符串），unit:'亿美元'，title:'标题'`},
  'vp-versus':   {keys: ['left', 'right', 'win', ...COMMON], doc: `两样东西对着看。left:{name:'黄金', value:'0%', sub:'不生利息', at}，right:{同 left}，win:{side:'left'|'right', at}（可不写）`},
  'vp-chain':    {keys: ['items', ...COMMON], doc: `因果链，一环扣一环。items:[{title:'打仗推高油价', value:'$104', sub:'国际油价', at}]（3–4 环，title≤8字，value 可不写）`},
  'vp-list':     {keys: ['items', ...COMMON], doc: `几条要点一条条翻出来。items:[{text:'≤10字', sub:'小字', mark:'ok'|'no'|'1', hl:true, at}]（2–4 条）`},
  'vp-line':     {keys: ['data', 'marks', 'drawTo', 'unit', 'down', 'source', ...COMMON], doc: `走势线。只有调研里真有 ≥5 个连续时间点的数值才能用，不许编数。data:[3200,3260,…]（纯数字数组），marks:[{i:0, text:'2020年 1500'},{i:-1, text:'现在 4100', at}]（i 是第几个点，-1 是最后一个），unit:'美元/盎司'，down:true（跌的走势），source:'数据来源（必填）'`},
  'vp-timeline': {keys: ['items', ...COMMON], doc: `几个有日期的节点。items:[{date:'11月12日', text:'≤8字', sub, hl:true, at}]（2–4 个）`},
  'vp-share':    {keys: ['value', 'label', 'note', 'at', ...COMMON], doc: `一个占比，圆环画到那个百分比。value:'75%'，label:'圆环中间数字下的字'，note:'圆环下一行说明'`},
  'vp-rank':     {keys: ['items', ...COMMON], doc: `有名次的比较，横条排行。items:[{name:'微软', value:'800亿', hl:true, at}]（3–5 行，按名次排好）`},
  'vp-quote':    {keys: ['lines', 'name', 'tag', 'at', 'brow', 'bg'], doc: `一句引语（核过的原话）。lines:['买得越多','<em>省得越多</em>']（1–3 行，每行≤8字），name:'谁说的'，tag:'身份'，at:[每行的时刻]`},
  'vp-chapter':  {keys: ['no', 'title', 'en', 'bg'], doc: `分段小标题（长片用，全片最多 1–2 次）。no:'01'，title:'≤6字'，en:'英文小字'`},
  'vp-photo':    {keys: ['img', 'pos', 'tags', 'source', 'hh', 'title', 'brow', 'bg'], doc: `一张新闻图当主角，大窗转进来。img 只能写"可用图片"里给的路径，tags:[{text:'≤10字', at}]（最多 3 条），title:'标题（可用<em>重点</em>）'，source:'图片出处'`},
};
// 三种视频类型的专用镜头（kit/fmt.js）。hud 是常驻元素，程序填
const H = ['hud', 'bg'];
Object.assign(SCENES, {
  'fx-news-open': {format: 'news', keys: ['date', 'kicker', 'title', 'heads', 'at', ...H], doc: `新闻开场：大日期、栏目名、"今天 N 件事"、几条短标题预告。date, kicker, title, heads:['≤10字',...]`},
  'fx-news-item': {format: 'news', keys: ['no', 'headline', 'source', 'img', 'value', 'unit', 'label', 'comment', 'at', ...H], doc: `一条新闻：headline ≤18字（可用<em>），source 媒体名，img 配图，value/unit/label 关键数字，comment ≤14字点评，at:[数字出现时刻, 点评出现时刻]`},
  'fx-news-wrap': {format: 'news', keys: ['title', 'heads', 'takeaway', 'at', ...H], doc: `新闻收尾：几条短标题打勾 + takeaway ≤12字`},
  'fx-rank-open': {format: 'rank', keys: ['title', 'n', 'metric', 'at', ...H], doc: `榜单开场：TOP n，title 榜单名，metric 按什么排`},
  'fx-rank-item': {format: 'rank', keys: ['rank', 'name', 'sub', 'img', 'value', 'unit', 'max', 'comment', 'at', ...H], doc: `一个名次：rank, name ≤8字, sub, img, value 纯数字, unit, max 榜上最大值, comment ≤14字, at:[数据条时刻, 点评时刻]`},
  'fx-rank-final': {format: 'rank', keys: ['title', 'items', 'unit', 'takeaway', 'at', ...H], doc: `总榜：items:[{rank,name,value}], takeaway ≤12字`},
  'fx-exp-open': {format: 'explain', keys: ['question', 'chapters', 'at', ...H], doc: `科普开场：question ≤12字，chapters 章节名`},
  'fx-exp-step': {format: 'explain', keys: ['no', 'title', 'kind', 'nodes', 'a', 'b', 'point', 'at', ...H], doc: `一步：title ≤8字，kind:'flow'(nodes 2–4个 ≤8字)/'analogy'(a 要讲的东西, b 像生活里的什么)/'point'，point ≤16字要点`},
  'fx-exp-sum': {format: 'explain', keys: ['title', 'items', 'takeaway', 'at', ...H], doc: `总结：items 2–4 条 ≤14字，takeaway ≤12字`},
});
export const SHOT_KEYS = ['scene', 'cover', 'says', 'hero'];

// 界面上显示的名字：组件、分组、参数
export const LABELS = {
  'vp-words': ['关键词', '讲'], 'vp-ask': ['抛问题', '讲'], 'vp-reject': ['转折', '讲'], 'vp-verdict': ['结论', '讲'], 'vp-number': ['大数字', '讲'],
  'vp-bars': ['柱状对比', '图'], 'vp-versus': ['左右对比', '图'], 'vp-chain': ['因果链', '图'], 'vp-list': ['要点', '图'], 'vp-line': ['走势线', '图'],
  'vp-timeline': ['时间线', '图'], 'vp-share': ['占比圆环', '图'], 'vp-rank': ['排行', '图'], 'vp-quote': ['引语', '图'], 'vp-chapter': ['章节', '图'], 'vp-photo': ['新闻图', '图'],
  'fx-news-open': ['速报开场', '讲'], 'fx-news-item': ['新闻条', '图'], 'fx-news-wrap': ['速报回顾', '讲'],
  'fx-rank-open': ['榜单开场', '讲'], 'fx-rank-item': ['名次', '图'], 'fx-rank-final': ['总榜', '图'],
  'fx-exp-open': ['抛问题', '讲'], 'fx-exp-step': ['步骤', '图'], 'fx-exp-sum': ['总结', '讲'],
};
export const FIELD_LABELS = {
  words: '关键词', text: '文字', en: '英文小字', lines: '大字', stamp: '砸下的词', drop: '掉下的词', value: '数值', unit: '单位', label: '说明',
  pct: '涨跌幅', items: '项目', title: '标题', brow: '角标', sub: '小字', name: '名字', tag: '身份', note: '原话卡', left: '左边', right: '右边',
  date: '日期', source: '出处', tags: '标签', data: '数据', marks: '标注', no: '序号',
  headline: '标题', kicker: '栏目名', heads: '短标题', comment: '点评', takeaway: '结论', rank: '名次', metric: '排序依据', sub: '小字',
  question: '问题', chapters: '章节', nodes: '流程框', a: '要讲的东西', b: '就像', point: '要点', kind: '演法（flow/analogy/point）', n: '几名', max: '最大值',
};

// format：只列这种视频类型能用的镜头（财经解读用 vp-，其余类型用自己的 fx-）
export function catalogText(images, format = 'story') {
  const rows = Object.entries(SCENES).filter(([k, v]) => (format === 'story' ? !v.format : v.format === format) && (k !== 'vp-photo' || images.length)).map(([k, v]) => `- ${k}：${v.doc}`);
  return rows.join('\n');
}
