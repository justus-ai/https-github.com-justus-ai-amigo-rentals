# Truehost Frontend + Render Backend Setup

Use this when the website is hosted on Truehost and the API runs on Render.

## 1) Set Backend Environment (Render)

In Render service environment variables:

- `PORT=5000`
- `APP_BASE_URL=https://<your-render-api-domain>`
- `CORS_ORIGINS=https://amigorentals.co.ke,https://www.amigorentals.co.ke`

If this is first deployment, also set:

- `ADMIN_INITIAL_USERNAME=justus`
- `ADMIN_INITIAL_PASSWORD=<strong-password>`

## 2) Set Frontend Build Variable (Truehost)

Before building frontend assets, set:

- `VITE_API_BASE_URL=https://<your-render-api-domain>`

Example:

```bash
VITE_API_BASE_URL=https://your-service.onrender.com npm run build
```

Upload the resulting `dist/` files to Truehost.

## 3) Verify API Directly

Run these checks from any terminal:

```bash
curl -i https://<your-render-api-domain>/api/properties
curl -i -X POST https://<your-render-api-domain>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"justus","password":"<your-password>"}'
```

Expected result:

- `/api/properties` returns JSON.
- `/api/auth/login` returns `200` and a JSON token.

## 4) Verify Website Uses Render API

Open browser DevTools on `https://amigorentals.co.ke`:

- Submit admin login.
- In Network tab, confirm request URL starts with `https://<your-render-api-domain>/api/...`.
- Confirm response is JSON (not HTML).

## 5) Common Failure Pattern

If `https://amigorentals.co.ke/api/...` returns `index.html`, the frontend is not pointed at Render.
Rebuild frontend with correct `VITE_API_BASE_URL` and redeploy static assets.
