
import mongoose from 'mongoose';

export async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/puestosQuinceBetBack';

  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUri, {
    autoIndex: false,
  });

  console.log('Mongo conectado');
}

export async function disconnectDB() {
  await mongoose.disconnect();
  console.log('Mongo desconectado');
}