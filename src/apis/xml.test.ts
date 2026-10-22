import { describe, expect, test } from "vitest";
import { readXmlItems, readXmlTag } from "./xml";

describe("readXmlItems", () => {
  test("trims values, keeps missing fields absent, reads self-closing tags as empty", () => {
    const xml = `<r><msgBody>
      <itemList>
        <ROUTE_NO> 318 </ROUTE_NO>
        <ROUTE_TP>2  </ROUTE_TP>
        <CAR_REG_NO/>
      </itemList>
      <itemList><ROUTE_NO>604</ROUTE_NO></itemList>
    </msgBody></r>`;
    expect(readXmlItems(xml, "itemList")).toEqual([
      { ROUTE_NO: "318", ROUTE_TP: "2", CAR_REG_NO: "" },
      { ROUTE_NO: "604" },
    ]);
  });

  test("decodes entities and CDATA", () => {
    const xml = "<itemList><A>a &amp; b &#47; &#x41;</A><B><![CDATA[ <raw> ]]></B></itemList>";
    expect(readXmlItems(xml, "itemList")).toEqual([{ A: "a & b / A", B: "<raw>" }]);
  });

  test("returns [] when there are no items (e.g. <msgBody/>)", () => {
    expect(readXmlItems("<ServiceResult><msgBody/></ServiceResult>", "itemList")).toEqual([]);
  });
});

describe("readXmlTag", () => {
  test("distinguishes absent from empty", () => {
    expect(readXmlTag("<a><headerCd> 4 </headerCd></a>", "headerCd")).toBe("4");
    expect(readXmlTag("<a><msgBody/></a>", "msgBody")).toBe("");
    expect(readXmlTag("<a></a>", "headerCd")).toBe(undefined);
  });
});
