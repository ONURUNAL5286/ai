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

test("uses project name when explicit project fields are empty", async () => {
  const result = await resolveProjectSlug({
    token: "unused",
    repo: "unused",
    sprint: {
      projectName: "KOBI Gider ve Nakit Akisi Paneli",
      existingProject: "",
      projectSlug: "",
    },
    projectDirs: [],
  });

  assert.equal(result.projectSlug, "kobi-gider-ve-nakit-akisi-paneli");
  assert.equal(result.matchType, "new");
});
