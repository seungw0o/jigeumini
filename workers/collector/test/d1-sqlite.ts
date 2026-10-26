import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

// node:sqlite 위에 올린 최소한의 D1Database 대역. 테스트에 쓰는 prepare/bind/all/first/run/batch만 흉내 낸다
export function createTestD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));

  const statement = (sql: string, params: SQLInputValue[] = []) => ({
    sql,
    bind: (...values: unknown[]) => statement(sql, values as SQLInputValue[]),
    async all<T>() {
      const results = db.prepare(sql).all(...params) as T[];
      return { results, success: true, meta: { changes: 0 } };
    },
    async first<T>() {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async run() {
      const { changes } = db.prepare(sql).run(...params);
      return { results: [], success: true, meta: { changes: Number(changes) } };
    },
  });

  type Statement = ReturnType<typeof statement> & { sql?: string };
  // D1 batch처럼 한 트랜잭션으로 차례대로 실행한다. SELECT는 결과를, 나머지는 changes를 돌려준다
  async function batch(statements: Statement[]) {
    db.exec("BEGIN");
    try {
      const out: unknown[] = [];
      for (const s of statements) out.push(/^\s*(SELECT|WITH)\b/i.test(s.sql ?? "") ? await s.all() : await s.run());
      db.exec("COMMIT");
      return out;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return { prepare: (sql: string) => statement(sql), batch } as unknown as D1Database;
}
