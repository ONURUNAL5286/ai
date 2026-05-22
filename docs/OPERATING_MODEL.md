# Operating Model

## Gunluk Calisma

AI Agent Office her gun su donguyu calistirir:

1. Yeni sprint veya musteri talebi var mi kontrol et.
2. Talebi user story ve tasklara ayir.
3. Tasklari agentlara dagit.
4. Her task icin branch ve PR olustur.
5. Testleri calistir.
6. Demo ortaminda manuel/agent QA yap.
7. Sprint raporu uret.
8. Yeni pazar firsatlarini arastir.

## Durumlar

- `BACKLOG`: Fikir veya is henuz planlanmadi.
- `PLANNED`: Sprint tasklara ayrildi.
- `IN_PROGRESS`: Agent uzerinde calisiyor.
- `BLOCKED`: Eksik bilgi, teknik engel veya maliyet limiti var.
- `IN_REVIEW`: PR acildi, kalite kontrol bekliyor.
- `READY_TO_DEPLOY`: Testler gecti, deploy bekliyor.
- `DONE`: Deploy, test ve rapor tamamlandi.

## Insan Onayi Gereken Noktalar

- Yeni musteri projesi baslatma.
- Ucretli servis veya API anahtari kullanma.
- Production deploy.
- Musteriye teslim raporu gonderme.
- Hukuki, finansal, saglik veya kisisel veri iceren kararlar.

## Maliyet Kontrolu

Her sprint icin maksimum limit belirlenmelidir:

- Maksimum agent calisma saati.
- Maksimum token/API butcesi.
- Maksimum paralel agent sayisi.
- Maksimum deneme/deploy sayisi.

Baslangic icin onerilen limit:

- Ayni anda 3-5 agent.
- Her proje icin gunluk butce limiti.
- Her PR icin maksimum 2 otomatik revizyon denemesi.
