const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const healthRoutes = require('./routes/health');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRoutes);

app.get('/', (req, res) => {
  res.send('MarketLink Apex API is running...');
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
