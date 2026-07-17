# Admin API URL conventions

## Canonical prefix
All admin CRUD goes under **`/api/admin/...`**.

Auth stays at **`/auth/...`** (also aliased as `/api/auth/...`).

## Soft-delete
| Resource | Mechanism |
|----------|-----------|
| accounts | `ACC_STATUS = 'I'` |
| locations | `LOC_STATUS = 'I'` |
| products | `PRO_STATUS = 'I'` |
| platforms | `PLA_STATUS = 'I'` |
| devices / signs | `status = 'deleted'` |
| charges | `CHA_STATUS = 'I'` (column auto-added on boot) |
| apis | `API_STATUS = 'I'` (column auto-added on boot) |
| metrics | `MET_STATUS = 'I'` |
| scripts | `SCR_STATUS = 'I'` |
| faqs | `FAQ_STATUS = 'I'` |
| users | `IsActive = 0` (cannot soft-delete self) |

## Users
- No public signup (`POST /auth/signup` and `/auth/register` return 403).
- Admins create users via `POST /api/admin/users`.
- Password is bcrypt-hashed into **`PasswordHash`**; default from env **`DEFAULT_PASS_NEW_USER`**.
- Schema columns: `USR_ID`, `FullName`, `Email`, `Phone`, `Role`, `PasswordHash`, `IsActive`, `CreatedAt`.

## Products
Only the **`PRODUCT`** table is used (`/api/admin/products`). Legacy lowercase `products` routes were removed.
