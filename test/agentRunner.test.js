import assert from "node:assert/strict";
import { test } from "node:test";
import { appHtmlForProject } from "../src/agentRunner.js";

test("prioritizes service/futuristic sprint over legacy HR project slug", () => {
  const html = appHtmlForProject("kobi-personel-izin-ve-vardiya-takip", "KOBI Servis Operasyon Merkezi", [
    { task: "Is emirleri localStorage kullanilarak tarayicida kalici tutulmali" },
    { task: "Futuristic koyu tema uygulanmali" },
    { task: "Yeni teknisyen ekleme formu olmali" },
  ]);

  assert.match(html, /localStorage/);
  assert.match(html, /Yeni Is Emri/);
  assert.match(html, /Teknisyen Ekle/);
  assert.doesNotMatch(html, /Haftalik Vardiya Plani/);
});

test("generic fallback creates an operational app, not a DONE-only list", () => {
  const html = appHtmlForProject("ozel-proje", "Ozel Operasyon Paneli", [
    { task: "Musteri talebi kaydi" },
    { task: "Onceliklendirme ve filtreleme" },
    { task: "Raporlama ozeti" },
  ]);

  assert.match(html, /Yeni Kayit/);
  assert.match(html, /Operasyon Listesi/);
  assert.match(html, /addRecord/);
  assert.doesNotMatch(html, /<span class="done">DONE<\/span>/);
});
