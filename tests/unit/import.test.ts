import { describe, it, expect } from "vitest";
import {
  parseMeasurement,
  parseDimensions,
  parseImportRows,
} from "../../src/lib/import-parser";
describe("Catalog import parsing", () => {
  it("retains every SKU on a shared OCR line", () => {
    const rows = parseImportRows(
      'ROUND BOWL\nMR-508 8" 42 OZ 1 DZ MR-509 9" 60 OZ 1 DZ',
      "m",
      1,
    );
    expect(rows.map((i) => i.sku)).toEqual(["MR-508", "MR-509"]);
    expect(rows.map((i) => i.capacityOz)).toEqual([42, 60]);
  });
  it("normalizes quart capacities", () => {
    expect(
      parseImportRows('BOWL\nME-4107 7 1/2" 2 QT', "me", 1)[0].capacityOz,
    ).toBe(64);
  });
  it("preserves printed fractional inches", () => {
    expect(parseMeasurement("10 1/4")).toBe(10.25);
    expect(parseMeasurement("35/8")).toBe(3.625);
    expect(parseMeasurement("1/0")).toBeNull();
  });
  it("parses three dimensional pieces", () => {
    expect(parseDimensions('12" x 8 1/2" x 2"')).toEqual({
      length: 12,
      width: 8.5,
      height: 2,
    });
  });
  it("retains original text, capacity, case pack, and provenance", () => {
    const [i] = parseImportRows(
      'ROUND BOWL BLUE\nMR-508 8 1/2" x 2" 42 OZ 1 DZ',
      "mars",
      11,
    );
    expect(i.sku).toBe("MR-508");
    expect(i.capacityOz).toBe(42);
    expect(i.casePack).toBe("1 DZ");
    expect(i.pdfPage).toBe(11);
    expect(i.color).toBe("blue");
    expect(i.reviewNeeded).toBe(true);
    expect(i.specification).toContain("8 1/2");
  });
  it("corrects OCR digits only in the numerical SKU part", () => {
    const [i] = parseImportRows(
      'PLATE TAN\nNS-IIOT 10 1/4" 2 DZ',
      "nessico",
      136,
    );
    expect(i.sku).toBe("NS-110T");
  });
  it("deduplicates repeated rows without losing distinct variants", () => {
    const r = parseImportRows(
      'PLATE\nNS-110 10"\nNS-110 10"\nNS-110T 10"',
      "n",
      1,
    );
    expect(r.map((i) => i.sku)).toEqual(["NS-110", "NS-110T"]);
  });
});
