import dotenv from 'dotenv';
dotenv.config();

import { hashSync } from 'bcryptjs';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(MONGODB_URI!);
  console.log('Connected to MongoDB');

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('ADMIN_EMAIL is not defined');
    process.exit(1);
  }

  const { User } = await import('./models/User.js');

  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    console.log('Admin user already exists');
    await mongoose.disconnect();
    return;
  }

  const password = process.argv[2];
  if (!password) {
    console.error('Usage: npx ts-node src/seed.ts <admin-password>');
    console.error('This will hash the password and create the admin user');
    process.exit(1);
  }

  const hashedPassword = hashSync(password, 10);

  await User.create({
    email: adminEmail,
    password: hashedPassword,
    name: 'Admin',
    role: 'admin',
  });

  console.log('Admin user created successfully');
  console.log(`Email: ${adminEmail}`);

  // Also print the hash for env file
  console.log('\nAdd this to your .env file:');
  console.log(`ADMIN_PASSWORD_HASH=${hashedPassword}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
