# KOBI Teklif ve Tahsilat Takip

Bu klasor AI Agent Office tarafindan bu projeye ozel olusturuldu. Farkli proje sprintleri farkli `projects/<proje-adi>` klasorlerinde tutulur.

## Goal

Kucuk ve orta olcekli hizmet firmalarinin teklif, musteri ve tahsilat sureclerini tek panelden takip edebilecegi calisan bir web uygulamasi olusturmak.

## Target User

5-50 calisani olan KOBI sahipleri, satis ekipleri ve operasyon sorumlulari

## Run

Windows'ta en kolay calistirma:

~~~powershell
.\start.cmd
~~~

PowerShell ile:

~~~powershell
.\start.ps1
~~~

Alternatif:

~~~powershell
npm.cmd start
~~~

Sunucu bos portu otomatik secer. Terminalde su satiri ara:

~~~text
KOBI Teklif ve Tahsilat Takip running at http://localhost:<port>
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
