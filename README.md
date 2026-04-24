# 🐉 Metin2Market

Marketplace do kupowania i sprzedawania przedmiotów na prywatnych serwerach Metin2.
Inspirowany odealo.com, zbudowany w stylu Metin2.

## Funkcje
- 🛒 Przeglądanie i dodawanie ogłoszeń
- 🔐 Rejestracja / logowanie (JWT)
- 🔍 Filtrowanie po kategorii, serwerze, wyszukiwaniu
- 📱 Responsywny design (Mobile-first)
- ⚔️ Klimat Metin2 (złoty, ciemny, gotycki)

## Stack
- **Backend**: Node.js + Express
- **Baza danych**: SQLite (better-sqlite3)
- **Frontend**: Vanilla JS + CSS (bez frameworka — szybkie ładowanie)
- **Auth**: JWT (jsonwebtoken + bcryptjs)

---

## 🚀 Wdrożenie — krok po kroku

### 1. GitHub

```bash
# Stwórz nowe repo na github.com, potem:
git init
git add .
git commit -m "Initial commit — Metin2Market"
git remote add origin https://github.com/TWOJ_LOGIN/metin2market.git
git push -u origin main
```

### 2. Render.com (bezpłatny hosting)

1. Wejdź na [render.com](https://render.com) i zaloguj się przez GitHub
2. Kliknij **"New +"** → **"Web Service"**
3. Wybierz swoje repo `metin2market`
4. Wypełnij:
   - **Name**: `metin2market`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. W sekcji **Environment Variables** dodaj:
   - `JWT_SECRET` → wpisz losowy string, np. `AbCdEfGh1234567890XyZ`
   - `DB_PATH` → `/opt/render/project/src/data.db`
6. Kliknij **"Create Web Service"**
7. Czekaj ~2 minuty — strona będzie dostępna pod adresem `https://metin2market.onrender.com`

> ⚠️ **Uwaga**: Darmowy plan Render usypia serwer po 15 min braku ruchu.
> Pierwsze wejście może trwać 30-60s. Możesz użyć [UptimeRobot](https://uptimerobot.com) do pingowania co 5 min.

---

## 🛠️ Lokalny rozwój

```bash
# Zainstaluj zależności
npm install

# Skopiuj env
cp .env.example .env

# Uruchom serwer deweloperski
npm run dev
# lub
npm start

# Otwórz http://localhost:3000
```

---

## 📁 Struktura projektu

```
metin2market/
├── server.js          # Punkt wejścia Express
├── db.js              # SQLite init + seed
├── render.yaml        # Konfiguracja Render.com
├── routes/
│   ├── auth.js        # POST /api/auth/register, /login, GET /me
│   ├── offers.js      # CRUD ogłoszeń
│   ├── categories.js  # Kategorie
│   └── servers.js     # Serwery Metin2
├── middleware/
│   └── auth.js        # JWT middleware
└── public/
    ├── index.html     # SPA shell
    ├── css/style.css  # Design Metin2
    └── js/app.js      # Frontend SPA logic
```

---

## 🔮 Plany rozbudowy

- [ ] System wiadomości między użytkownikami
- [ ] Oceny i recenzje sprzedawców
- [ ] Upload zdjęć (Cloudinary lub podobne)
- [ ] Panel admina
- [ ] System escrow (bezpieczna płatność)
- [ ] Powiadomienia email (Resend / SendGrid)
- [ ] System raportowania ogłoszeń

---

## Licencja
MIT — używaj swobodnie!
