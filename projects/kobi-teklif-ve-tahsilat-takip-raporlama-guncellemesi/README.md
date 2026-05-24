# KOBI Teklif ve Tahsilat Takip - Raporlama Guncellemesi

Bu klasor AI Agent Office tarafindan bu projeye ozel olusturuldu. Farkli proje sprintleri farkli `projects/<proje-adi>` klasorlerinde tutulur.

## Goal

Var olan projeye raporlama ekrani ve tahsilat ozetleri eklemek

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
KOBI Teklif ve Tahsilat Takip - Raporlama Guncellemesi running at http://localhost:<port>
~~~

Sonra tarayicida terminalde yazan URL'yi ac.

## Project Structure

- public/index.html: Calisan ilk demo ekran.
- server.js: Basit statik dosya sunucusu.
- start.cmd: Windows icin tek komutla baslatma.
- start.ps1: PowerShell icin tek komutla baslatma.
- sprints/: Bu projeye ait sprint planlari.
- tasks/: Bu projeye ait agent task listeleri.
