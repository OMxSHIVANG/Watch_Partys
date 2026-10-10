const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function wipe() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully!');
    
    console.log('Dropping database...');
    await mongoose.connection.db.dropDatabase();
    
    console.log('✅ All data has been deleted. The database is completely clean.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to wipe the database. Make sure your MONGO_URI and password are correct in .env!');
    console.error('Error details:', err.message);
    process.exit(1);
  }
}

wipe();
