# AI Agent Office

Bu klasor, 7/24 calisabilecek ama kalite, maliyet ve insan onayi kapilari olan bir sanal AI yazilim ofisi kurmak icin hazirlandi.

Amac:
- Telefonda sprint plani gonderebilmek.
- Agent ekibinin isi GitHub uzerinden task, branch ve PR olarak yurutmesi.
- Her teslimatin test edilmis, deploy edilmis ve gite pushlanmis olmasi.
- Sprint bittiginde Turkiye piyasasindaki eksik urunleri arastirip yeni sprint onerileri uretmek.
- Kurumsal firmalara guvenilir, raporlanabilir ve demo odakli AI destekli yazilim hizmeti satmak.

Baslangic dosyalari:
- `docs/BLUEPRINT.md`: Genel sistem mimarisi.
- `docs/OPERATING_MODEL.md`: Gunluk calisma modeli.
- `templates/SPRINT_PLAN.md`: Telefonda gonderilecek sprint formati.
- `agents/ROLES.md`: Agent ekibi ve sorumluluklari.
- `workflows/QUALITY_GATES.md`: Bitti sayilma kurallari.
- `business/CORPORATE_OFFER.md`: Kurumsal firmalara teklif taslagi.
- `business/MARKET_RESEARCH_LOOP.md`: Sprint sonrasi Turkiye pazari arastirma dongusu.
- `roadmap/30_DAY_PLAN.md`: Ilk 30 gunluk kurulum plani.

V1 ilkesi:

Agentlar surekli calisir; ama musteriye teslim edilecek her sey test, demo, PR ve insan onayi kapisindan gecer.

## Calistirma

Bu repoda ilk calisan MVP olarak Telegram'dan sprint plani alip GitHub Issues acan bot bulunur.

Gerekenler:
- Node.js 20 veya uzeri
- Telegram bot token
- GitHub token
- GitHub repository: `ONURUNAL5286/ai`

Kurulum:

```bash
cp .env.example .env
npm test
npm start
```

Windows PowerShell'de `.env` dosyasini elle olusturabilir veya su komutu kullanabilirsin:

```powershell
Copy-Item .env.example .env
```

PowerShell `npm.ps1 cannot be loaded` hatasi verirse komutlari soyle calistir:

```powershell
npm.cmd test
npm.cmd start
```

`.env` icine sunlari gir:

```text
TELEGRAM_BOT_TOKEN=...
GITHUB_TOKEN=...
GITHUB_REPO=ONURUNAL5286/ai
```

Telegram'dan bota `/start` yaz. Sonra `templates/SPRINT_PLAN.md` formatinda `SPRINT BASLAT` ile baslayan bir mesaj gonder.

Test amacli GitHub issue acmadan denemek icin:

```text
DRY_RUN=true
```

## GitHub Token Yetkisi

GitHub token'in issue acabilmesi gerekir. Fine-grained token kullanirsan `ONURUNAL5286/ai` reposu icin `Issues: Read and write` yetkisi ver.
