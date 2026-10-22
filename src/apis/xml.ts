// 대전 BIS 응답처럼 한 단계짜리 평평한 XML만 읽는 작은 리더. 속성, 중첩 구조는 지원하지 않는다.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/);
  if (cdata) return cdata[1].trim();
  return raw
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name[0] === "#") {
        const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isNaN(code) ? whole : String.fromCodePoint(code);
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .trim();
}

/** 첫 번째 `<tag>값</tag>`의 값. 없으면 undefined, `<tag/>`면 "" */
export function readXmlTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}\\s*>)`));
  if (!match) return undefined;
  return decode(match[1] ?? "");
}

/** `<itemTag>` 블록마다 자식 태그를 { 태그: 값 } 으로. 값은 trim, 빠진 태그는 키가 없다 */
export function readXmlItems(xml: string, itemTag: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const blocks = xml.matchAll(new RegExp(`<${itemTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${itemTag}\\s*>`, "g"));
  for (const [, body] of blocks) {
    const item: Record<string, string> = {};
    for (const field of body.matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/\1\s*>)/g)) {
      item[field[1]] = decode(field[2] ?? "");
    }
    items.push(item);
  }
  return items;
}
