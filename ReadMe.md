# CMIOFS — Construction Material Inventory and Order Fulfillment System

A full-stack web application for managing construction material inventory, purchase orders, and delivery fulfillment for construction sites.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| State Management | Zustand + TanStack Query |
| Backend | Django 4.2 + Django REST Framework |
| Authentication | JWT (djangorestframework-simplejwt) |
| Database (Dev) | SQLite |
| Database (Prod) | PostgreSQL via Supabase |

---

## Features

- **Inventory Management** — Full item catalogue with real-time stock levels, search, filters, and category management
- **Purchase Orders** — Formal multi-stage procurement workflow (Draft → Approved → Fulfilled) with goods receipt tracking
- **Delivery Orders** — Outbound material dispatch to construction sites with status tracking
- **Transaction Ledger** — Immutable audit log of every stock movement
- **Role-Based Access Control** — System Admin, Purchasing Manager, and Warehouse Staff roles
- **Reports** — Stock summary, low-stock alerts, PO dashboard, and inventory valuation

---

## Project Structure

```
cmiofs/
├── backend/                  # Django project
│   ├── accounts/             # Custom user model and authentication
│   ├── config/               # Django settings, URLs, WSGI
│   ├── core/                 # Shared utilities and base models
│   ├── dispatch/             # Delivery order management
│   ├── inventory/            # Items, categories, transactions
│   ├── purchasing/           # Purchase orders and goods receipts
│   ├── reports/              # Reporting endpoints
│   ├── suppliers/            # Supplier management
│   ├── manage.py
│   └── requirements.txt
└── frontend/                 # React + Vite project
    ├── src/
    │   ├── api/              # Axios API functions per module
    │   ├── components/       # Reusable UI components and layout
    │   ├── pages/            # Page components per module
    │   ├── store/            # Zustand global state
    │   ├── hooks/            # Custom React hooks
    │   └── utils/            # Helpers and constants
    ├── index.html
    └── vite.config.js
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20 LTS
- Git

---

### Backend Setup

**1. Navigate to the backend folder and create a virtual environment:**
```bash
cd backend
python -m venv venv
```

**2. Activate the virtual environment:**

- Windows:
```powershell
venv\Scripts\activate
```
- Mac/Linux:
```bash
source venv/bin/activate
```

**3. Install dependencies:**
```bash
pip install -r requirements.txt
```

**4. Create your `.env` file** inside `backend/`:
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Generate a secret key:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**5. Run migrations:**
```bash
python manage.py makemigrations accounts
python manage.py makemigrations
python manage.py migrate
```

**6. Create a superuser:**
```bash
python manage.py createsuperuser
```

**7. Set the superuser role via Django shell:**
```bash
python manage.py shell
```
```python
from accounts.models import User
u = User.objects.get(username='your_username')
u.role = 'SYSTEM_ADMIN'
u.save()
exit()
```

**8. Start the development server:**
```bash
python manage.py runserver
```

Backend runs at `http://127.0.0.1:8000`
API docs available at `http://127.0.0.1:8000/api/docs/`

---

### Frontend Setup

**1. Navigate to the frontend folder:**
```bash
cd frontend
```

**2. Install dependencies:**
```bash
npm install
```

**3. Start the development server:**
```bash
npm run dev
```

Frontend runs at `http://localhost:5173`

> The Vite proxy forwards all `/api` requests to Django on port 8000 automatically. No extra configuration needed.

---

### Running Both Servers

You need two terminals open simultaneously:

**Terminal 1 — Django:**
```bash
cd backend
venv\Scripts\activate   # or source venv/bin/activate on Mac/Linux
python manage.py runserver
```

**Terminal 2 — React:**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser and log in with your superuser credentials.

---

## User Roles

| Role | Description |
|------|-------------|
| `SYSTEM_ADMIN` | Full access to all modules. Manages user accounts and system settings. |
| `PURCHASING_MANAGER` | Creates and approves purchase orders. Manages items and suppliers. |
| `WAREHOUSE_STAFF` | Updates stock levels, receives goods, and dispatches deliveries. |

> User accounts are created by the System Admin — there is no self-registration.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/token/` | Obtain JWT tokens |
| POST | `/api/v1/auth/token/refresh/` | Refresh access token |
| GET / POST | `/api/v1/items/` | List or create inventory items |
| GET / PATCH / DELETE | `/api/v1/items/:id/` | Retrieve, update, or delete an item |
| GET | `/api/v1/inventory/transactions/` | View transaction ledger |
| POST | `/api/v1/inventory/stock-in/` | Manual stock entry |
| GET / POST | `/api/v1/purchase-orders/` | List or create purchase orders |
| POST | `/api/v1/purchase-orders/:id/approve/` | Approve a PO |
| POST | `/api/v1/purchase-orders/:id/receive/` | Record goods receipt |
| GET / POST | `/api/v1/delivery-orders/` | List or create delivery orders |
| POST | `/api/v1/delivery-orders/:id/dispatch/` | Dispatch materials |

Full API documentation: `http://127.0.0.1:8000/api/docs/`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for development, `False` for production |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hosts |
| `DATABASE_URL` | Database connection string |
| `CORS_ALLOWED_ORIGINS` | Allowed origins for CORS (frontend URL) |

> Never commit your `.env` file. It is listed in `.gitignore`.

---

## Database

The project uses **SQLite** for local development (zero configuration required). For production, switch to **PostgreSQL via Supabase** by updating `DATABASE_URL` in your `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Then install the PostgreSQL adapter:
```bash
pip install psycopg2-binary
```

---

## Contributing

1. Create a new branch for your feature:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and commit:
```bash
git add .
git commit -m "feat: description of your change"
```

3. Push and open a pull request:
```bash
git push origin feature/your-feature-name
```

---

## License

This project is developed for academic purposes.