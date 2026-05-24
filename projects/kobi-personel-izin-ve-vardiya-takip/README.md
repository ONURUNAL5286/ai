# KOBI Servis Operasyon Merkezi - Futuristic UI ve Kalici Kayit

Bu klasor AI Agent Office tarafindan bu projeye ozel olusturuldu. Farkli proje sprintleri farkli `projects/<proje-adi>` klasorlerinde tutulur.

## Goal

Mevcut servis operasyon paneline tarayici icinde kalici veri saklama ve daha modern, futuristic, demo etkisi yuksek bir arayuz tasarimi eklemek.

## Target User

Teknik servis firmalari, saha operasyon yoneticileri, KOBI sahipleri

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
KOBI Servis Operasyon Merkezi - Futuristic UI ve Kalici Kayit running at http://localhost:<port>
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
