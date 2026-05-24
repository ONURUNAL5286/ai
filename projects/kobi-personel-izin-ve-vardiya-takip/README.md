# KOBI Personel Izin ve Vardiya Takip - Modern UI Guncellemesi

Bu klasor AI Agent Office tarafindan bu projeye ozel olusturuldu. Farkli proje sprintleri farkli `projects/<proje-adi>` klasorlerinde tutulur.

## Goal

Mevcut personel izin ve vardiya takip panelini daha profesyonel, modern, mobil uyumlu ve musteriye demo edilebilir bir operasyon ekranina cevirmek.

## Target User

KOBI sahipleri, insan kaynaklari sorumlulari, operasyon yoneticileri

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
KOBI Personel Izin ve Vardiya Takip - Modern UI Guncellemesi running at http://localhost:<port>
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
