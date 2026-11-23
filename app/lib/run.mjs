// 跑子进程：收集输出，失败时把最后几十行带进错误里，方便在网页上直接看到原因。
import {spawn} from 'node:child_process';

export function run(cmd, args, {cwd, env, quiet = false, onLine} = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {cwd, env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', ...env}, windowsHide: true});
    let out = '', err = '';
    const feed = (buf, isErr) => {
      const s = buf.toString('utf8'); if (isErr) err += s; else out += s;
      if (onLine && !quiet) for (const ln of s.split(/\r?\n/)) if (ln.trim()) onLine(ln);
    };
    p.stdout.on('data', b => feed(b, false)); p.stderr.on('data', b => feed(b, true));
    p.on('error', e => reject(new Error(`启动不了 ${cmd}：${e.message}（装了吗？在 PATH 里吗？）`)));
    p.on('close', code => {
      if (code === 0) return resolve(out);
      const tail = (out + '\n' + err).trim().split(/\r?\n/).slice(-40).join('\n');
      reject(Object.assign(new Error(`${cmd} ${args[0] ?? ''} 失败（退出码 ${code}）：\n${tail}`), {code, out, err}));
    });
  });
}
