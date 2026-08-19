import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { apiTypeLabel } from "./index.ts";
import type { ApiType } from "./detect.ts";

// The README makes claims that go stale silently. It listed "7 detection
// paths" for three backends past the point where that was true, and a
// comment in index.ts named ds4 as the only backend allowed to enable
// request compat well after SGLang and ninfer had joined it. Both were
// written accurately and neither was checked by anything.
//
// So the parts that assert a fact are read back and compared against the
// code. Prose is left alone.

const README = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "README.md"),
  "utf8",
);

/** Every backend the chain can report, minus the generic fallback. */
const BACKENDS: ApiType[] = [
  "mtplx",
  "omlx",
  "lmstudio",
  "llamacpp",
  "ollama",
  "sglang",
  "vllm",
  "ds4",
  "ninfer",
];

describe("the README", () => {
  it("gives every backend a row in the detection table", () => {
    for (const backend of BACKENDS) {
      const label = apiTypeLabel(backend);
      expect(README, `no detection-table row mentions "${label}"`).toMatch(
        new RegExp(`^\\|\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m"),
      );
    }
  });

  it("names every backend in the opening sentence", () => {
    const opening = README.split("\n").find((line) => line.startsWith("A Pi extension")) ?? "";
    for (const backend of BACKENDS) {
      expect(opening, `opening sentence omits "${apiTypeLabel(backend)}"`).toContain(
        apiTypeLabel(backend),
      );
    }
  });

  // A count is the claim most likely to be left behind, because adding a
  // backend touches the table and the sentence but not a number buried in a
  // bullet. Spelling it out rather than digitising it does not help: the
  // rule here is that no bare count of backends appears at all.
  it("states no backend count that a new backend would falsify", () => {
    const counts = README.match(
      /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+[\w-]*\s*(detection paths?|backends|detectors)/gi,
    );
    expect(counts, `README hard-codes a backend count: ${counts?.join(", ")}`).toBeNull();
  });
});
