# AI Agent Office Blueprint

## Hedef

AI Agent Office, yazilim projelerini sprint mantigiyla ureten, test eden, deploy eden ve GitHub'a pushlayan sanal bir ekip modelidir. Sistem 7/24 calisabilir, fakat her teslimatta kalite kapilari ve insan onayi bulunur.

## Ana Bilesenler

1. Mobil sprint girisi
   - Telegram bot veya WhatsApp Business uzerinden sprint plani alinir.
   - Ilk MVP icin Telegram daha hizli ve esnektir.

2. Sprint Planner Agent
   - Gelen serbest metni user story, acceptance criteria, task listesi ve test planina cevirir.
   - Eksik bilgi varsa sprinti `NEEDS_CLARIFICATION` durumuna alir.

3. Project Manager Agent
   - Tasklari GitHub Issues veya Linear uzerinde acar.
   - Oncelik, bagimlilik ve teslim tarihi belirler.

4. Engineering Agents
   - Frontend, backend, database, devops ve QA agentlari tasklari ayri branchlerde calisir.
   - Her task sonunda draft PR acar.

5. Quality Gate
   - Test, lint, build, e2e, security scan ve deploy kontrolleri calisir.
   - Gecmeyen PR merge edilmez.

6. Delivery Reporter
   - Sprint sonunda musteriye demo linki, tamamlanan isler, test sonucu ve kalan riskleri raporlar.

7. Market Research Agent
   - Sprint bittiginde Turkiye piyasasinda eksik urunleri ve dikey firsatlari arastirir.
   - Yeni sprint onerileri uretir.

## Onerilen V1 Teknoloji Yigini

- Sprint girisi: Telegram Bot
- Task yonetimi: GitHub Issues
- Kod deposu: GitHub
- Agent calistirma: Codex, Claude Code, Cursor Agents veya GitHub coding agents
- Orkestrasyon: n8n veya Node.js tabanli basit orchestrator
- CI/CD: GitHub Actions
- Frontend deploy: Vercel
- Backend deploy: Railway, Fly.io veya AWS
- Test: unit test, integration test, Playwright e2e
- Raporlama: Markdown sprint raporu + PDF opsiyonu

## Veri Akisi

1. Kullanici telefondan sprint planini yollar.
2. Bot sprint planini `incoming_sprints` kuyruguna ekler.
3. Sprint Planner Agent plani normalize eder.
4. Project Manager Agent GitHub Issues olusturur.
5. Engineering Agents issue basina branch acar.
6. Agentlar kod yazar, test ekler ve PR acar.
7. CI kalite kapilarini calistirir.
8. QA Agent demo URL uzerinden kontrol yapar.
9. Insan reviewer onaylarsa PR merge edilir.
10. Delivery Reporter musteri raporunu hazirlar.
11. Market Research Agent yeni urun firsatlari ve yeni sprint onerir.

## Kritik Kural

Sistem hic durmadan fikir ve gelistirme uretebilir; fakat musteriye giden teslimatlar kontrollu olmalidir. Kurumsal guvenin temeli hiz degil, izlenebilirliktir.
