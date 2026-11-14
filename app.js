/* ============================================================
   NASEEM BIOS — 交互层
   1) 开机自检   2) token 账本（真实数据）  3) 卡带插画
   4) 模型账本表 5) 可交互终端            6) 8-bit 音效
   ============================================================ */
(function () {
  "use strict";

  const S = window.STATS || null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const nf = new Intl.NumberFormat("en-US");
  const fmtNum = (n) => nf.format(Math.round(n || 0));
  const fmtCompact = (n) => {
    n = n || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(2) + " 亿";
    if (n >= 1e4) return (n / 1e4).toFixed(1) + " 万";
    return fmtNum(n);
  };

  /* ── 6. 音效（默认关闭，WebAudio 合成，无素材）──────────── */
  const Sound = {
    ctx: null,
    on: localStorage.getItem("naseem-sound") === "on",
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    },
    blip(freq, dur, type) {
      if (!this.on) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.08));
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + (dur || 0.08) + 0.02);
    },
    click() { this.blip(660, 0.06); },
    ok() { this.blip(880, 0.09); setTimeout(() => this.blip(1320, 0.09), 70); },
    err() { this.blip(180, 0.16, "sawtooth"); },
  };

  const soundBtn = $("#soundBtn");
  function paintSoundBtn() {
    if (!soundBtn) return;
    soundBtn.setAttribute("aria-pressed", String(Sound.on));
    const label = soundBtn.querySelector(".sound-label");
    if (label) label.textContent = Sound.on ? "SOUND ON" : "SOUND OFF";
  }
  paintSoundBtn();
  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      Sound.on = !Sound.on;
      localStorage.setItem("naseem-sound", Sound.on ? "on" : "off");
      paintSoundBtn();
      if (Sound.on) Sound.ok();
    });
  }

  document.addEventListener(
    "click",
    (e) => {
      const hit = e.target.closest("button, a");
      if (hit && hit !== soundBtn) Sound.click();
    },
    { passive: true }
  );

  /* ── 1. 开机自检 ───────────────────────────────────────── */
  const boot = $("#boot");
  const bootLog = $("#bootLog");

  const BOOT_LINES = [
    ["NASEEM BIOS v2026.11 — SERENE SYSTEM", ""],
    ["CPU : SERENE-CORE x1 @ 3AM", ""],
    ["MEM : 640K TOKENS", "OK"],
    ["LOADING SHADERS", "OK"],
    ["MOUNTING CARTRIDGES", "OK"],
    ["SYNCING TOKEN LEDGER", "OK"],
    ["NET : LOCAL ONLY", "OK"],
    ["", ""],
    ["PLAYER 1 ▸ READY", ""],
  ];

  function padDots(text, width) {
    const dots = Math.max(3, width - text.length);
    return text + " " + ".".repeat(dots);
  }

  let bootTimer = null;
  function finishBoot() {
    if (!boot || boot.classList.contains("is-done")) return;
    clearTimeout(bootTimer);
    boot.classList.add("is-done");
    try { sessionStorage.setItem("naseem-boot", "1"); } catch (e) {}
    const name = $(".hero-name");
    if (name) name.focus?.();
    startOdometer();
  }

  function playBoot() {
    if (!boot || !bootLog) return;
    boot.classList.remove("is-done");
    bootLog.textContent = "";

    if (reduceMotion) {
      bootLog.textContent = BOOT_LINES.map(([t, s]) => (s ? padDots(t, 30) + " " + s : t)).join("\n");
      bootTimer = setTimeout(finishBoot, 900);
      return;
    }

    let i = 0;
    const step = () => {
      if (i >= BOOT_LINES.length) {
        bootTimer = setTimeout(finishBoot, 1400);
        return;
      }
      const [text, status] = BOOT_LINES[i];
      const line = document.createElement("span");
      if (status) {
        line.textContent = padDots(text, 30) + " ";
        const ok = document.createElement("span");
        ok.className = "ok";
        ok.textContent = status;
        line.appendChild(ok);
      } else {
        line.textContent = text;
      }
      line.appendChild(document.createTextNode("\n"));
      bootLog.appendChild(line);
      Sound.blip(520 + i * 60, 0.035);
      i += 1;
      bootTimer = setTimeout(step, 150);
    };
    step();
  }

  const bootSeen = (() => {
    try { return sessionStorage.getItem("naseem-boot") === "1"; } catch (e) { return false; }
  })();

  if (bootSeen && !reduceMotion) {
    finishBoot();
  } else {
    playBoot();
    if (boot) {
      ["keydown", "pointerdown", "wheel", "touchstart"].forEach((evt) =>
        boot.addEventListener(evt, finishBoot, { once: true, passive: true })
      );
    }
  }

  const rebootBtn = $("#reboot");
  if (rebootBtn) {
    rebootBtn.addEventListener("click", () => {
      try { sessionStorage.removeItem("naseem-boot"); } catch (e) {}
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      boot.classList.remove("is-done");
      playBoot();
    });
  }

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ── 2. token 账本 ─────────────────────────────────────── */
  const odo = $("#odo");
  const odoSub = $("#odoSub");
  const totals = (S && S.totals) || null;
  let odoStarted = false;

  function startOdometer() {
    if (odoStarted || !odo || !totals) return;
    odoStarted = true;
    const target = totals.tokens || 0;

    if (reduceMotion) {
      odo.textContent = fmtNum(target);
      return;
    }
    const dur = 1500;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      odo.textContent = fmtNum(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else odo.textContent = fmtNum(target);
    };
    requestAnimationFrame(tick);

    // 保底：标签页被挂起 / rAF 被节流时也要出数字
    setTimeout(() => {
      if (!/\d/.test(odo.textContent) || odo.textContent.includes("·")) {
        odo.textContent = fmtNum(target);
      }
    }, dur + 1200);
  }

  if (odo && !totals) {
    odo.innerHTML = '<span class="odo-skeleton">账本缺失 · 先跑 tools/export-stats.py</span>';
  }

  if (odoSub && totals) {
    odoSub.textContent = [
      totals.models + " MODELS",
      totals.providers + " CHANNELS",
      totals.active_days + " ACTIVE DAYS",
      totals.span_days + " DAYS IN",
    ].join(" · ");
  }

  // 每日序列（补零成连续日历）
  const dailyByDay = new Map();
  if (S && Array.isArray(S.daily)) {
    S.daily.forEach((row) => dailyByDay.set(row.d, row));
  }
  const allDays = Array.from(dailyByDay.keys()).sort();
  const lastDay = allDays.length ? allDays[allDays.length - 1] : null;
  const fullSpan =
    allDays.length > 1
      ? Math.round((Date.parse(lastDay) - Date.parse(allDays[0])) / 86400000) + 1
      : (totals && totals.span_days) || 90;

  function seriesFor(range) {
    if (!lastDay) return [];
    const end = new Date(lastDay + "T00:00:00Z");
    const out = [];
    for (let i = range - 1; i >= 0; i -= 1) {
      const d = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
      const row = dailyByDay.get(d);
      out.push({ d, sessions: row ? row.sessions : 0, tokens: row ? row.tokens : 0 });
    }
    return out;
  }

  const chart = $("#chart");
  const dayPanel = $("#dayPanel");
  const chartLegend = $("#chartLegend");
  let range = 90;
  let bars = [];
  let currentData = [];

  // 点/触任意位置 → 选中最近的柱子（窄屏柱子很细也能点中）
  if (chart) {
    chart.addEventListener("click", (e) => {
      if (!bars.length) return;
      let best = -1;
      let bestDist = Infinity;
      bars.forEach((b, i) => {
        const r = b.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - e.clientX);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      if (best >= 0 && currentData[best]) selectDay(currentData[best], bars[best]);
    });
  }

  // 键盘 ←/→ 逐日浏览（只绑一次，绑在容器上，换区间不重复注册）
  if (chart) {
    chart.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const idx = bars.indexOf(document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      const next =
        bars[Math.max(0, Math.min(bars.length - 1, idx + (e.key === "ArrowRight" ? 1 : -1)))];
      if (next) next.focus();
    });
  }

  function renderChart() {
    if (!chart) return;
    const data = seriesFor(range);
    currentData = data;
    chart.textContent = "";
    bars = [];

    if (!data.length) {
      const p = document.createElement("p");
      p.className = "chart-empty";
      p.textContent = "没有可读的日志数据。";
      chart.appendChild(p);
      return;
    }

    const max = Math.max(1, ...data.map((d) => d.tokens));
    data.forEach((row) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bar" + (row.tokens === 0 ? " is-zero" : "");
      btn.style.height = Math.max(3, Math.sqrt(row.tokens / max) * 100) + "%";
      btn.dataset.day = row.d;
      btn.setAttribute(
        "aria-label",
        `${row.d}，${row.sessions} 个会话，${fmtNum(row.tokens)} tokens`
      );
      chart.appendChild(btn);
      bars.push(btn);
    });

    const sum = data.reduce((acc, d) => acc + d.tokens, 0);
    const activeDays = data.filter((d) => d.tokens > 0).length;
    if (chartLegend) {
      const scope = range >= fullSpan ? `全部 ${range} 天` : `近 ${range} 天`;
      chartLegend.innerHTML = `${scope} <b>${fmtCompact(sum)}</b> tokens · 活跃 ${activeDays} 天`;
    }
    if (dayPanel) dayPanel.hidden = true;
  }

  function selectDay(row, btn) {
    bars.forEach((b) => b.classList.toggle("is-on", b === btn));
    if (!dayPanel) return;
    const pct = totals && totals.tokens ? ((row.tokens / totals.tokens) * 100).toFixed(2) : "0";
    dayPanel.innerHTML =
      `<b>${row.d}</b> · ${row.sessions} 个会话 · ` +
      `<b>${fmtNum(row.tokens)}</b> tokens · 占总量 ${pct}%`;
    dayPanel.hidden = false;
    Sound.blip(740, 0.07);
  }

  $$(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = btn.dataset.range;
      range = raw === "all" ? fullSpan : Number(raw) || 90;
      $$(".seg-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      renderChart();
    });
  });

  if (chart) renderChart();

  /* ── 4. 模型账本表 ─────────────────────────────────────── */
  const ledgerBody = $("#ledgerBody");
  if (ledgerBody && S && Array.isArray(S.models) && S.models.length) {
    ledgerBody.textContent = "";
    S.models.slice(0, 10).forEach((m) => {
      const tr = document.createElement("tr");
      const cells = [
        ["td", m.model, "model-cell"],
        ["td", m.provider, ""],
        ["td", fmtNum(m.calls), "num"],
        ["td", fmtCompact(m.input), "num"],
        ["td", fmtCompact(m.output), "num"],
        ["td", fmtCompact(m.cache), "num"],
        ["td", fmtCompact(m.total), "num"],
      ];
      cells.forEach(([tag, text, cls]) => {
        const el = document.createElement(tag);
        el.textContent = text;
        if (cls) el.className = cls;
        tr.appendChild(el);
      });
      const share = document.createElement("td");
      const track = document.createElement("span");
      track.className = "share-track";
      const fill = document.createElement("span");
      fill.className = "share-fill";
      fill.style.width = Math.max(1, Math.min(100, m.share)) + "%";
      track.appendChild(fill);
      share.appendChild(track);
      share.className = "num";
      share.title = m.share + "%";
      tr.appendChild(share);
      ledgerBody.appendChild(tr);
    });
    const foot = $("#ledgerFoot");
    if (foot) {
      foot.textContent = `合计 ${fmtNum(totals.tokens)} tokens · ${fmtNum(totals.api_calls)} 次 API 调用 · 数据源 ${S.source} · 导出于 ${S.generated_at.replace("T", " ")}`;
    }
  } else if (ledgerBody) {
    ledgerBody.innerHTML = '<tr><td colspan="8" class="ledger-empty">账本未生成 · 先跑 tools/export-stats.py</td></tr>';
  }

  /* ── 3. 卡带插画（程序化像素风景，非截图）─────────────── */
  const PALETTES = {
    cyan:    { sky: ["#08050f", "#101a3a", "#1b2a5e"], far: "#1d3a6b", near: "#101f42", glow: "#4fe3ff", star: "#bff4ff" },
    amber:   { sky: ["#0a060e", "#2a1630", "#54331f"], far: "#6b3a1d", near: "#331b12", glow: "#ffd166", star: "#ffe9b8" },
    violet:  { sky: ["#08050f", "#1b1040", "#2a1155"], far: "#3d1a6b", near: "#221045", glow: "#b98cff", star: "#e0cfff" },
    magenta: { sky: ["#0a050f", "#2a0f2e", "#4a1240"], far: "#6b1d4a", near: "#3a1029", glow: "#ff5ea8", star: "#ffd0e4" },
    green:   { sky: ["#05090c", "#0f2420", "#123a2e"], far: "#1d5240", near: "#0d2a21", glow: "#6ef58f", star: "#ccffdb" },
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawScene(canvas) {
    const pal = PALETTES[canvas.closest(".card")?.dataset.palette] || PALETTES.cyan;
    const seed = Number(canvas.closest(".card")?.dataset.seed) || 7;
    const rnd = mulberry32(seed * 7919 + 13);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    const CELL = 4;
    const cols = Math.floor(W / CELL), rows = Math.floor(H / CELL);

    // 天空渐变带
    for (let y = 0; y < rows; y += 1) {
      const p = y / rows;
      const band = p < 0.45 ? pal.sky[0] : p < 0.75 ? pal.sky[1] : pal.sky[2];
      ctx.fillStyle = band;
      ctx.fillRect(0, y * CELL, W, CELL);
    }

    // 星星
    const starCount = Math.round(cols * rows * 0.06);
    for (let i = 0; i < starCount; i += 1) {
      const x = Math.floor(rnd() * cols);
      const y = Math.floor(rnd() * rows * 0.6);
      if (rnd() < 0.35) {
        ctx.fillStyle = pal.star;
        ctx.globalAlpha = 0.35 + rnd() * 0.6;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        ctx.globalAlpha = 1;
      }
    }

    // 月亮 / 星球
    const mx = Math.floor(cols * (0.62 + rnd() * 0.2));
    const my = Math.floor(rows * (0.18 + rnd() * 0.12));
    ctx.fillStyle = pal.glow;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(mx * CELL, my * CELL, CELL * 3, CELL * 3);
    ctx.fillRect((mx - 1) * CELL, (my + 1) * CELL, CELL, CELL);
    ctx.fillRect((mx + 3) * CELL, (my + 1) * CELL, CELL, CELL);
    ctx.globalAlpha = 1;

    // 远山（按列高度合成）
    function ridge(baseY, amp, color, freq) {
      ctx.fillStyle = color;
      for (let x = 0; x < cols; x += 1) {
        const n =
          Math.sin(x * freq + seed) * 0.5 +
          Math.sin(x * freq * 2.3 + seed * 1.7) * 0.3 +
          Math.sin(x * freq * 0.7 + seed * 0.4) * 0.2;
        const h = Math.max(1, Math.round(baseY + n * amp));
        ctx.fillRect(x * CELL, h * CELL, CELL, (rows - h) * CELL);
      }
    }

    ridge(Math.floor(rows * 0.62), 4, pal.far, 0.45);
    ridge(Math.floor(rows * 0.78), 3, pal.near, 0.7);

    // 地平线光
    ctx.fillStyle = pal.glow;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, Math.floor(rows * 0.79) * CELL, W, CELL);
    ctx.globalAlpha = 1;

    // 前景扫描线，强化 CRT 感
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }

  $$(".card-canvas").forEach((c) => {
    // 用设备像素比放大，保持像素锐利
    drawScene(c);
  });

  /* ── 5. 可交互终端 ─────────────────────────────────────── */
  const termForm = $("#termForm");
  const termInput = $("#termInput");
  const termOut = $("#termOut");
  const termChips = $("#termChips");
  const history = [];
  let histIdx = -1;

  const WORK_LINES = [
    "01 starhusk        Godot 4 2D 银河城 — 开发中，灰盒阶段",
    "02 Hermes Fleet    多智能体编排（看板派卡 / 角色化 profile / 审查闸门）",
    "03 Hindsight       本地语义记忆 + 健康哨兵",
    "04 HFT-Trend       永续量化：回测 → 滑点建模 → 影子校验 → 执行",
    "05 Reading Pipeline 英文精读 → Obsidian 归档",
    "06 NASEEM Bios     本页：纯静态街机外壳",
  ];

  const COMMANDS = {
    help() {
      return [
        "可用命令：",
        "  whoami     我是谁",
        "  works      六张卡带",
        "  stats      token 账本摘要",
        "  ledger     模型用量明细",
        "  stack      日常技术栈",
        "  contact    怎么联系",
        "  boot       重放开机动画",
        "  sound on|off  开关 8-bit 音效",
        "  date       当前时间",
        "  clear      清屏",
        "  ls / cat / echo / sudo  传统艺能",
      ];
    },
    whoami() {
      return [
        "肖丰 · Serene — 独立开发者",
        "AI 工程 / 实时图形 / 量化系统",
        "白天让智能体排队干活，深夜给像素角色调手感。",
      ];
    },
    works() { return WORK_LINES; },
    stats() {
      if (!totals) return ["账本未生成，先跑 tools/export-stats.py"];
      return [
        `tokens     ${fmtNum(totals.tokens)}`,
        `API 调用   ${fmtNum(totals.api_calls)}`,
        `会话       ${fmtNum(totals.sessions)}`,
        `模型       ${totals.models} 个 / ${totals.providers} 个渠道`,
        `跨度       ${totals.first_day} → ${totals.last_day}（${totals.span_days} 天，活跃 ${totals.active_days} 天）`,
      ];
    },
    ledger() {
      if (!S || !S.models) return ["无数据"];
      return S.models.slice(0, 8).map(
        (m) => `${m.model.padEnd(16, " ")} ${String(m.share).padStart(5, " ")}%  ${fmtCompact(m.total)}`
      );
    },
    stack() {
      return [
        "语言    Python / TypeScript / GDScript",
        "AI      Hermes Agent · 多模型编排 · MCP · 本地推理",
        "图形    three.js / GLSL / Godot 4",
        "基建    macOS · launchd · Docker · Cloudflare Pages",
        "工具    Obsidian · git · 一柜子脚本",
      ];
    },
    contact() {
      return [
        "GITHUB  https://github.com/AtaleFeng",
        "EMAIL   hello@example.com（占位，待换）",
      ];
    },
    date() { return [new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })]; },
    ls() { return ["works/   ledger/   terminal/   contact/   secret/"]; },
    boot() { playBoot(); boot.classList.remove("is-done"); return ["重新启动…"]; },
    sudo() { return ["对不起，这台机器没有 root，只有深夜。"]; },
    hi() { return ["你好呀 👋 敲 help 看看能聊什么。"]; },
    hello() { return ["你好。欢迎来到 night-shift。"]; },
  };

  function print(text, cls) {
    if (!termOut) return;
    const p = document.createElement("p");
    p.className = "term-line" + (cls ? " " + cls : "");
    p.textContent = text;
    termOut.appendChild(p);
    termOut.scrollTop = termOut.scrollHeight;
  }

  function runCommand(raw) {
    const input = (raw || "").trim();
    print("serene@night-shift:~$ " + input, "term-cmd");
    if (!input) return;

    const [cmd, ...rest] = input.split(/\s+/);
    const key = cmd.toLowerCase();

    if (key === "clear") {
      termOut.textContent = "";
      return;
    }
    if (key === "echo") {
      print(rest.join(" ") || "");
      return;
    }
    if (key === "cat") {
      print(rest.length ? `${rest.join(" ")}: 这台机器只读。试试 works / stats。` : "cat: 缺少操作数");
      return;
    }
    if (key === "sound") {
      const want = (rest[0] || "").toLowerCase();
      if (want === "on" || want === "off") {
        Sound.on = want === "on";
        localStorage.setItem("naseem-sound", Sound.on ? "on" : "off");
        paintSoundBtn();
        print("sound " + want);
        if (Sound.on) Sound.ok();
      } else {
        print("用法: sound on|off");
      }
      return;
    }
    if (Object.prototype.hasOwnProperty.call(COMMANDS, key)) {
      const lines = COMMANDS[key]() || [];
      lines.forEach((l, i) => print(l, i === 0 ? "" : ""));
      Sound.blip(620, 0.05);
      return;
    }
    Sound.err();
    print(`command not found: ${cmd}`, "term-err");
    print("敲 help 看可用命令。", "term-sys");
  }

  if (termForm) {
    termForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = termInput.value;
      if (v.trim()) {
        history.push(v.trim());
        histIdx = history.length;
      }
      runCommand(v);
      termInput.value = "";
    });
  }

  if (termInput) {
    termInput.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!history.length) return;
        histIdx = Math.max(0, histIdx - 1);
        termInput.value = history[histIdx] || "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        histIdx = Math.min(history.length, histIdx + 1);
        termInput.value = history[histIdx] || "";
      }
    });
  }

  if (termChips) {
    termChips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-cmd]");
      if (!btn) return;
      runCommand(btn.dataset.cmd);
      if (termInput) termInput.focus({ preventScroll: true });
    });
  }
})();
