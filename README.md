# MyMoney

Личный финансовый трекер Юлии.

- адаптивный интерфейс для ноутбука и телефона;
- установка на телефон как PWA;
- добавление и удаление операций;
- бюджеты, план/факт и прогноз долга;
- локальная работа без интернета;
- синхронизация между устройствами через личную Google Sheet + Google Apps Script.

## Google Sheet
Источник данных: `MyMoney Data`.

## Подключение синхронизации
1. Открыть Google Sheet → Расширения → Apps Script.
2. Вставить содержимое `apps-script-template.gs`.
3. В `SYNC_SECRET` задать длинный личный ключ.
4. Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone.
5. Скопировать URL `/exec`.
6. В MyMoney нажать статус синхронизации и ввести URL + тот же ключ.

## GitHub Pages
Settings → Pages → Deploy from a branch → `main` / `(root)`.

После публикации приложение будет доступно по адресу `https://luluakhro.github.io/MyMoney/`.
