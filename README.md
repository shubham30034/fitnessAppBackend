FitnessApp

Running locally

- Copy `.env.example` to `.env` and set environment variables (see below)
- Install deps and run:
```
npm install
npm run dev
```

Required environment variables

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `REFRESH_TOKEN`
- `RAZORPAY_KEY`
- `RAZORPAY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_REDIRECT_URI`

Tests

Run all tests:
```
npm test
```
Watch mode:
```
npm run test:watch
```
Coverage:
```
npm run coverage
```

Metrics

- Enable request timing logs: set `LOG_REQUEST_TIME=true` in `.env`.
- Recent requests (superadmin only): `GET /api/v1/superadmin/metrics/requests?limit=50`.
