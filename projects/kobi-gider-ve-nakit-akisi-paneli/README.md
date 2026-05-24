# KOBI Gider ve Nakit Akisi Paneli - Gelismis Raporlama

Bu klasor AI Agent Office tarafindan bu projeye ozel olusturuldu. Farkli proje sprintleri farkli `projects/<proje-adi>` klasorlerinde tutulur.

## Goal

Mevcut gelir-gider paneline detayli raporlama, nakit akisi tahmini ve disari aktarma ozellikleri eklemek.

## Target User

KOBI sahipleri, on muhasebe sorumlulari, finans takibi yapan operasyon ekipleri

## Run

Windows'ta en kolay calistirma:

~~~powershell
.start.cmd
~~~

PowerShell ile:

~~~powershell
.start.ps1
~~~

Alternatif:

~~~powershell
npm.cmd start
~~~

Sunucu bos portu otomatik secer. Terminalde su satiri ara:

~~~text
KOBI Gider ve Nakit Akisi Paneli - Gelismis Raporlama running at http://localhost:<port>
~~~

Sonra tarayicida terminalde yazan URL'yi ac.

## Project Structure

- public/index.html: Calisan ilk demo ekran.
- server.js: Basit statik dosya sunucusu.
- start.cmd: Windows icin tek komutla baslatma.
- start.ps1: PowerShell icin tek komutla baslatma.
- AGENT_BOARD.md: Hangi agent hangi maddeyi yapiyor panosu.
- STATUS.md: Sprint durum ozeti.
- sprints/: Bu projeye ait sprint planlari.
- tasks/: Bu projeye ait agent task listeleri.
