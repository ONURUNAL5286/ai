# Orchestration Workflow

Bu dokuman agent ekibinin nasil sirayla calisacagini tanimlar.

## V1 Basit Akis

1. `Sprint Intake`
   - Telegram mesajini al.
   - `templates/SPRINT_PLAN.md` formatina gore dogrula.

2. `Planning`
   - Sprint Planner Agent user story ve tasklari cikarir.
   - Project Manager Agent GitHub Issues acar.

3. `Execution`
   - Her issue icin ayri branch acilir.
   - Uygun agent kodu uygular.
   - Agent test yazar veya test notu ekler.

4. `Review`
   - PR acilir.
   - QA Agent acceptance criteria kontrolu yapar.
   - Security Reviewer Agent temel guvenlik kontrolu yapar.

5. `Delivery`
   - CI gecerse deploy edilir.
   - Delivery Reporter sprint raporu uretir.
   - Human Supervisor musteriye gondermeden once onaylar.

6. `Next Opportunity`
   - Market Research Agent yeni urun firsatlarini listeler.
   - En yuksek puanli fikir yeni sprint adayina donusur.

## Kuyruk Mantigi

Her is bir kuyruk item'i olarak tutulur:

```json
{
  "id": "sprint-001-task-003",
  "project": "kobi-teklif-takip",
  "type": "frontend",
  "status": "PLANNED",
  "priority": "P1",
  "budgetLimit": "low",
  "githubIssue": "https://github.com/org/repo/issues/3",
  "branch": "agent/sprint-001-task-003",
  "requiredChecks": ["lint", "test", "build", "smoke"]
}
```

## Paralel Calisma Kurali

Baslangicta ayni anda en fazla 3 agent calistirilir:

- 1 frontend/backend implementation agent
- 1 QA/reviewer agent
- 1 market/research veya documentation agent

Sistem olgunlasinca paralellik 5-8 agent seviyesine cikarilabilir.
