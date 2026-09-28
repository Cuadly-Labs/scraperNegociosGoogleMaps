#!/usr/bin/env python3
"""Small SQLite bridge used by Next when Node has no built-in node:sqlite."""

import json
import sqlite3
import sys


def main() -> int:
    request = json.load(sys.stdin)
    db_path = request["dbPath"]
    action = request["action"]
    sql = request.get("sql", "")
    params = request.get("params", [])

    connection = sqlite3.connect(db_path, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout = 30000")
    connection.execute("PRAGMA foreign_keys = ON")

    try:
        if action == "exec":
            connection.executescript(sql)
            connection.commit()
            value = None
        elif action == "run":
            before = connection.total_changes
            cursor = connection.execute(sql, params)
            connection.commit()
            value = {
                "changes": connection.total_changes - before,
                "lastInsertRowid": cursor.lastrowid,
            }
        elif action == "get":
            row = connection.execute(sql, params).fetchone()
            value = dict(row) if row else None
        elif action == "all":
            value = [dict(row) for row in connection.execute(sql, params).fetchall()]
        else:
            raise ValueError(f"Unknown SQLite action: {action}")

        print(json.dumps({"ok": True, "value": value}, ensure_ascii=False))
        return 0
    except Exception as error:
        connection.rollback()
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        return 1
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
