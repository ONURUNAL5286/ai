# Yeni AI Agent Office Sprint

Bu klasor AI Agent Office tarafindan bu projeye ozel olusturuldu. Farkli proje sprintleri farkli `projects/<proje-adi>` klasorlerinde tutulur.

## Goal

Belirtilmedi

## Target User

Belirtilmedi

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
Yeni AI Agent Office Sprint running at http://localhost:<port>
~~~

Sonra tarayicida terminalde yazan URL'yi ac.

## Project Structure

- public/index.html: Calisan ilk demo ekran.
- server.js: Basit statik dosya sunucusu.
- start.cmd: Windows icin tek komutla baslatma.
- start.ps1: PowerShell icin tek komutla baslatma.
- sprints/: Bu projeye ait sprint planlari.
- tasks/: Bu projeye ait agent task listeleri.
