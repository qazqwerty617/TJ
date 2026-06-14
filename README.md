# 📒 Trading Journal — Инструкция по запуску

## Структура проекта
```
trading-journal/
├── backend/          ← Node.js API сервер
├── web/              ← Next.js веб приложение
```

---

## 🚀 Быстрый старт (локально)

### 1. Настрой базу данных PostgreSQL

Установи PostgreSQL если ещё нет, потом:
```sql
CREATE DATABASE trading_journal;
```

### 2. Настрой backend

```bash
cd trading-journal/backend

# Скопируй .env файл
copy .env.example .env

# Отредактируй .env — заполни DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY

# Применяй схему базы данных
npx prisma generate
npx prisma db push

# Запусти сервер
npm run dev
# → Работает на http://localhost:3001
```

### 3. Запусти веб

```bash
cd trading-journal/web
npm run dev
# → Открой http://localhost:3000
```

---

## 📱 Установка на телефон (как приложение)

1. Открой **http://ВАШ_IP:3000** на телефоне
2. В Chrome (Android): меню → "Добавить на главный экран"
3. В Safari (iPhone): поделиться → "На экран «Домой»"
4. Приложение установится как нативное!

---

## 🖥️ Деплой на VPS

### Backend
```bash
# На VPS:
cd trading-journal/backend
cp .env.example .env
# заполни .env

npm install
npx prisma generate
npx prisma db push

# Запусти через PM2
npm install -g pm2
pm2 start src/index.js --name trading-journal-api
pm2 save
```

### Web (Next.js)
```bash
cd trading-journal/web

# Измени .env.local — поставь URL твоего VPS
# NEXT_PUBLIC_API_URL=http://ВАШ_ДОМЕН_ИЛИ_IP:3001

npm run build
npm start
# Или через PM2:
pm2 start npm --name trading-journal-web -- start
```

### Nginx (опционально)
```nginx
server {
    listen 80;
    server_name твой-домен.com;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

---

## 🔌 Подключение Binance

1. Открой сайт → Настройки → Биржи
2. Нажми "Добавить биржу"
3. В Binance: Профиль → API Management → Создать API
4. Дай права только **"Чтение" (Read Info)** — БЕЗ торговли!
5. Вставь API Key и Secret в форму
6. Нажми "Подключить"

После подключения — система автоматически импортирует все сделки каждые 5 минут!

---

## 📋 Переменные окружения (backend/.env)

```env
DATABASE_URL="postgresql://postgres:ПАРОЛЬ@localhost:5432/trading_journal"
JWT_SECRET="придумай_длинную_случайную_строку"
ENCRYPTION_KEY="ровно_32_символа_случайных!!!!!"
PORT=3001
```

---

## 🔑 Что делать после запуска

1. Зарегистрируйся на `/login`
2. Зайди в **Настройки → Биржи** — подключи Binance
3. Зайди в **Психология** — настрой правила риск-менеджмента
4. Сделай утренний **Check-in** перед торговлей
5. После каждой сделки — заполни **"Почему вошёл?"**
