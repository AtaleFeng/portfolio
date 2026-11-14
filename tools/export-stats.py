#!/usr/bin/env python3
"""把本机 Hermes 的 token 账本（~/.hermes/state.db）导出成作品集首页可用的静态数据。

产物:
  assets/stats.js   window.STATS = {...}   (用 <script> 引入，file:// 也能跑)
  assets/stats.json 同内容, 便于其它用途

只读数据库，不写入任何东西。
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sqlite3
import sys

DB = os.path.expanduser("~/.hermes/state.db")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TZ = dt.timezone(dt.timedelta(hours=8))


def day_str(ts):
    if not ts:
        return None
    return dt.datetime.fromtimestamp(ts, TZ).date().isoformat()


def main() -> int:
    if not os.path.exists(DB):
        print(f"no database at {DB}", file=sys.stderr)
        return 1

    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)

    totals = con.execute(
        """
        select coalesce(sum(api_call_count),0),
               coalesce(sum(input_tokens),0),
               coalesce(sum(output_tokens),0),
               coalesce(sum(cache_read_tokens),0),
               coalesce(sum(cache_write_tokens),0),
               coalesce(sum(reasoning_tokens),0),
               count(distinct model),
               count(distinct billing_provider),
               min(first_seen), max(last_seen)
        from session_model_usage
        """
    ).fetchone()

    calls, tok_in, tok_out, cache_read, cache_write, reasoning, models, providers, first_ts, last_ts = totals
    total_tokens = tok_in + tok_out + cache_read + cache_write + reasoning

    session_count = con.execute("select count(*) from sessions").fetchone()[0]

    # 每天：会话数（sessions.started_at）与 token 量（usage.last_seen 归集）
    sessions_by_day: dict[str, int] = {}
    for (ts,) in con.execute("select started_at from sessions where started_at > 0"):
        d = day_str(ts)
        if d:
            sessions_by_day[d] = sessions_by_day.get(d, 0) + 1

    tokens_by_day: dict[str, int] = {}
    for ts, n in con.execute(
        """select last_seen, input_tokens + output_tokens + cache_read_tokens
           + cache_write_tokens + reasoning_tokens from session_model_usage"""
    ):
        d = day_str(ts)
        if d:
            tokens_by_day[d] = tokens_by_day.get(d, 0) + (n or 0)

    days = sorted(set(sessions_by_day) | set(tokens_by_day))
    daily = [
        {
            "d": d,
            "sessions": sessions_by_day.get(d, 0),
            "tokens": tokens_by_day.get(d, 0),
        }
        for d in days
    ]

    model_rows = con.execute(
        """
        select model,
               billing_provider,
               sum(api_call_count) as calls,
               sum(input_tokens) as tok_in,
               sum(output_tokens) as tok_out,
               sum(cache_read_tokens) as cache_read,
               sum(cache_write_tokens) as cache_write,
               sum(reasoning_tokens) as reasoning
        from session_model_usage
        where model <> ''
        group by model, billing_provider
        order by (sum(input_tokens) + sum(output_tokens) + sum(cache_read_tokens)
                  + sum(cache_write_tokens) + sum(reasoning_tokens)) desc
        """
    ).fetchall()

    model_list = []
    for m, prov, calls_m, ti, to, cr, cw, rs in model_rows:
        total = (ti or 0) + (to or 0) + (cr or 0) + (cw or 0) + (rs or 0)
        model_list.append(
            {
                "model": m,
                "provider": prov or "custom",
                "calls": calls_m or 0,
                "input": ti or 0,
                "output": to or 0,
                "cache": (cr or 0) + (cw or 0),
                "reasoning": rs or 0,
                "total": total,
                "share": round(total / total_tokens * 100, 1) if total_tokens else 0,
            }
        )

    first_day, last_day = day_str(first_ts), day_str(last_ts)
    span_days = None
    if first_day and last_day:
        span_days = (
            dt.date.fromisoformat(last_day) - dt.date.fromisoformat(first_day)
        ).days + 1

    payload = {
        "generated_at": dt.datetime.now(TZ).isoformat(timespec="seconds"),
        "source": "~/.hermes/state.db",
        "totals": {
            "tokens": total_tokens,
            "input": tok_in,
            "output": tok_out,
            "cache_read": cache_read,
            "cache_write": cache_write,
            "reasoning": reasoning,
            "api_calls": calls,
            "sessions": session_count,
            "models": models,
            "providers": providers,
            "active_days": len(days),
            "first_day": first_day,
            "last_day": last_day,
            "span_days": span_days,
        },
        "daily": daily,
        "models": model_list,
    }

    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    blob = json.dumps(payload, ensure_ascii=False, indent=2)
    with open(os.path.join(ROOT, "assets", "stats.json"), "w", encoding="utf-8") as f:
        f.write(blob + "\n")
    with open(os.path.join(ROOT, "assets", "stats.js"), "w", encoding="utf-8") as f:
        f.write("/* generated by tools/export-stats.py — do not edit */\n")
        f.write("window.STATS = " + blob + ";\n")

    t = payload["totals"]
    print(
        f"ok · {t['tokens']:,} tokens · {t['api_calls']:,} calls · "
        f"{t['sessions']} sessions · {t['models']} models · "
        f"{len(daily)} active days ({first_day} → {last_day})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
