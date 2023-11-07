
# MySQL + NodeJS demo

Демо ДБ MySQL в связке с NodeJS (Express) и щепоткой hbs


## Установка

Для работы потребуется:
* локальный MySQL сервер (версии 8+), можно в open server запустить или через MySQL Workbench
* NodeJs с пакетным менеджером npm ([тык](https://nodejs.org/en/download))
* Git (разумеется)
---
1. Первым делом клонируем репозиторий на машину
```
git clone https://github.com/Cinium/mysql-nodejs-demo.git
cd mysql-nodejs-demo
```
2. Устанавливаем необходимые пакеты (их всего парочка)

```bash
  npm install
```
3. Создать и запустить локальную БД MySQL
4. В `/index.js` в функции `mysql.createPool` (14 строка) меняем значения  `database`, `user`, `password` на ваши
5. Запускаем все с помощью
```
npm run start
```
6. Открываем в браузере `http://localhost:3000/`


### С помощью веб-интерфейса в браузере можно удобно управлять БД и формировать отчеты