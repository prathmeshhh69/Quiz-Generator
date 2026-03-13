require('dotenv').config();

const mongoose = require('mongoose');

const URI = process.env.MONGO_URI;

mongoose.connect(URI)
  .then(() => console.log('Local MongoDB connected successfully!'))
  .catch((err) => console.log('Error:', err.message));