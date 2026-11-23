// 配置：读项目根目录的 .env（不装 dotenv），环境变量优先。
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ENV_FILE = path.join(ROOT, '.env');

function readEnvFile() {
  const out = {};
  // Windows 记事本默认隐藏扩展名，常常存成 .env.txt：两个都认
  const file = fs.existsSync(ENV_FILE) ? ENV_FILE : ENV_FILE + '.txt';
  try {
    for (const ln of fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(ln);
      if (m && !ln.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return out;
}
const get = (k, d) => process.env[k] || readEnvFile()[k] || d;

export const config = {
  apiKey: () => get('DEEPSEEK_API_KEY', ''),
  baseUrl: () => get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').replace(/\/$/, ''),
  model: () => get('DEEPSEEK_MODEL', 'deepseek-flash'),
  voice: () => get('GOLDCUT_VOICE', 'zh-CN-YunxiNeural'),
  filmsDir: () => path.resolve(ROOT, get('GOLDCUT_FILMS_DIR', 'films')),
  python: () => get('PYTHON', process.platform === 'win32' ? 'python' : 'python3'),
  port: () => Number(get('GOLDCUT_PORT', '5178')),
};

// 网页界面里填 Key 时写进 .env（只改这一行，别的不动）
export function saveEnv(k, v) {
  let lines = []; try { lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/); } catch {}
  const i = lines.findIndex(l => l.startsWith(k + '='));
  if (i >= 0) lines[i] = `${k}=${v}`; else lines.push(`${k}=${v}`);
  fs.writeFileSync(ENV_FILE, lines.filter((l, j) => l || j < lines.length - 1).join('\n') + '\n');
}
