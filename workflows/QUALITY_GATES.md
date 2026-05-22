# Quality Gates

Bir is asagidaki kontrollerden gecmeden `DONE` sayilmaz.

## Kod Kapisi

- Kod ilgili branchte olmalidir.
- Commit mesaji task ile iliskili olmalidir.
- PR acilmis olmalidir.
- PR aciklamasinda kapsam, test ve risk yazmalidir.

## Test Kapisi

Minimum kontroller:

- Lint gecer.
- Unit testler gecer.
- Build gecer.
- Kritik akislarda e2e veya smoke test gecer.
- Yeni ozellik icin en az bir test veya acik test notu vardir.

## Demo Kapisi

- Demo URL calisir.
- Login gerekiyorsa test kullanicisi vardir.
- Ana akis mobil ve desktopta kontrol edilmistir.
- Konsolda kritik hata yoktur.

## Git Kapisi

- Tum degisiklikler pushlanmistir.
- PR merge edilmistir veya musterinin review etmesi icin hazirdir.
- Main branch CI status basarilidir.
- Release notu veya sprint raporu hazirdir.

## Dokumantasyon Kapisi

- README gunceldir.
- `.env.example` vardir.
- Kurulum komutlari yazilidir.
- Bilinen limitler yazilidir.

## Guvenlik Kapisi

- Secret veya API key repoya girmemistir.
- Dependency audit sonucu kritik acik icermemelidir.
- Kisisel veri isleniyorsa not dusulmustur.

## Definition of Done

Bir task ancak su cumle dogruysa tamamdir:

"Kod pushlandi, testler gecti, demo calisiyor, PR veya merge durumu net, musteriye anlatilabilir rapor hazir."
