const express = require('express');
const cors = require('cors');
const handRaiseRoutes = require('./routes/hand-raise');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: CORS_ORIGINS.length ? CORS_ORIGINS : true
  })
);
app.use(express.json());

app.use('/api', handRaiseRoutes);

app.listen(PORT, () => {
  console.log(`Hand Raise backend listening on port ${PORT}`);
});
