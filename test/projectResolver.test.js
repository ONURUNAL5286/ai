import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveProjectSlug } from "../src/projectResolver.js";

test("uses explicit project slug before searching existing projects", async () => {
  const result = await resolveProjectSlug({
    token: "unused",
    repo: "unused",
    sprint: {
      projectName: "KOBI Teklif Guncelleme",
      existingProject: "kobi-teklif-ve-tahsilat-takip",
      projectSlug: "",
    },
  });

  assert.equal(result.projectSlug, "kobi-teklif-ve-tahsilat-takip");
  assert.equal(result.matchType, "explicit");
});
