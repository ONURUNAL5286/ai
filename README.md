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

Bu repoda ilk calisan MVP olarak Telegram'dan sprint plani alip GitHub Issues uzerinde proje/task yapisi acan bot bulunur.

Gerekenler:
- Node.js 20 veya uzeri
- Telegram bot token
- GitHub token
- GitHub repository: `ONURUNAL5286/ai`

Tek komutla calistirma:

```powershell
.\office.cmd
```

Bu komut sunlari ayni terminalde baslatir:

- Dashboard
- Telegram sprint botu
- `projects/` altindaki calistirilabilir proje onizlemeleri

Terminalde su formatta log gorursun:

```text
[dashboard] AI Agent Office Dashboard running at http://localhost:4100
[bot] AI Agent Office bot started for ONURUNAL5286/ai
[project:kobi-teklif-ve-tahsilat-takip] ... running at http://localhost:3000
```

Kapatmak icin ayni terminalde `Ctrl+C` kullan.

Ilk kurulum:

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

Calismadan once token ve GitHub ayarlarini kontrol etmek icin:

```powershell
npm.cmd run doctor
```

Sadece ana arayuz panelini acmak icin:

```powershell
.\dashboard.cmd
```

veya:

```powershell
npm.cmd run dashboard
```

Panel terminalde yazan adreste acilir. Varsayilan:

```text
http://localhost:4100
```

Bu panel `projects/` altindaki projeleri, agent tasklarini, durumlari ve calistirma komutlarini gosterir.

`.env` icine sunlari gir:

```text
TELEGRAM_BOT_TOKEN=...
GITHUB_TOKEN=...
GITHUB_REPO=ONURUNAL5286/ai
```

Telegram'dan bota `/start` yaz. Sonra `templates/SPRINT_PLAN.md` formatinda `SPRINT BASLAT` ile baslayan bir mesaj gonder.

Bot basarili calisirsa:

1. `projects/<proje-adi>/` altinda ayri calisan proje klasoru olusturur.
2. Proje icin `README.md`, `package.json`, `server.js` ve `public/index.html` dosyalari yazar.
3. Sprint planini `sprints/` altina kaydeder.
4. Agent task checklist dosyasini `tasks/` altina kaydeder.
5. Bir ana sprint issue acar.
6. `Ana ozellikler` altindaki her madde icin ayri task issue acar.
7. `Olmazsa olmazlar` altindaki her madde icin ayri requirement issue acar.
8. QA smoke test ve delivery report icin ek bir task issue acar.
9. Ana sprint issue altina task listesini yorum olarak ekler.

Farkli `Proje adi` ile gelen sprintler farkli `projects/<proje-adi>/` klasorlerine yazilir. Ayni proje adi ile gelen sprintler ayni proje klasoru altinda yeni `sprints/` ve `tasks/` dosyalari olarak tutulur.

Var olan bir projeyi guncellemek icin sprint mesajina bunu ekle:

```text
Mevcut proje: kobi-teklif-ve-tahsilat-takip
```

veya:

```text
Proje slug: kobi-teklif-ve-tahsilat-takip
```

Bu alan varsa bot yeni proje acmaz, verilen `projects/<slug>/` klasorunu gunceller. Alan yoksa repo icindeki mevcut proje adlariyla yakin eslesme arar.

Test amacli GitHub issue acmadan denemek icin:

```text
DRY_RUN=true
```

## GitHub Token Yetkisi

GitHub token'in issue acabilmesi ve proje dosyalarini repoya yazabilmesi gerekir. Fine-grained token kullanirsan `ONURUNAL5286/ai` reposu icin su yetkileri ver:

- `Issues: Read and write`
- `Contents: Read and write`

Yeni sprint geldiginde bot farkli projeleri karistirmamak icin dosyalari su yapida olusturur:

```text
projects/
  proje-adi/
    README.md
    package.json
    server.js
    public/index.html
    sprints/sprint-YYYYMMDDTHH.md
    tasks/sprint-YYYYMMDDTHH-tasks.md
```

## Sorun Giderme

Telegram'da mesaj gonderince hic cevap gelmiyorsa en olasi neden botun bilgisayarda calismiyor olmasidir. GitHub'a pushlamak botu calistirmaz; bu MVP yerel bilgisayarinda `npm.cmd start` komutu acik kaldigi surece Telegram mesajlarini dinler.

Kontrol sirasi:

1. `.env` dosyasi var mi?
2. `TELEGRAM_BOT_TOKEN` dogru bot tokeni mi?
3. `GITHUB_TOKEN` issue acma yetkisine sahip mi?
4. `npm.cmd run doctor` basarili mi?
5. `npm.cmd start` terminalde acik kaldi mi?

`npm.cmd start` calisirken terminalde su satiri gormelisin:

```text
AI Agent Office bot started for ONURUNAL5286/ai
```

Bu terminal acik degilse bot Telegram mesajlarini alamaz.

`Sprint islenirken hata olustu: fetch failed` veya `GitHub API network request failed` hatasi gorursen bot Telegram'a ulasiyor ama GitHub API'ye baglanamiyor demektir. Kontrol icin:

```powershell
npm.cmd run doctor
```

GitHub'a ag erisimini ayri kontrol etmek icin:

```powershell
Invoke-WebRequest https://api.github.com/repos/ONURUNAL5286/ai
```

Bu komut da hata verirse sorun kodda degil; internet, DNS, VPN, proxy veya firewall tarafindadir.
