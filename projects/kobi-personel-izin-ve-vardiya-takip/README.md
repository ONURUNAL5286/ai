# KOBI Personel Izin ve Vardiya Takip - Akilli Depo Operasyon Paneli

Bu klasor AI Agent Office tarafindan bu projeye ozel olusturuldu. Farkli proje sprintleri farkli `projects/<proje-adi>` klasorlerinde tutulur.

## Goal

Mevcut projeyi tamamen degistirerek KOBI depolari icin stok hareketi, raf konumu, sevkiyat hazirligi ve kritik stok uyarilarini yoneten akilli depo operasyon paneline cevirmek.

## Target User

Depo sorumlulari, operasyon yoneticileri, KOBI sahipleri

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
KOBI Personel Izin ve Vardiya Takip - Akilli Depo Operasyon Paneli running at http://localhost:<port>
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
