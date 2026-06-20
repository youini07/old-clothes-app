import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import requestsRouter from './routes/requests';
import adminRouter from './routes/admin';
import driverRouter from './routes/driver';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 라우터 등록
app.use('/api/auth', authRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/driver', driverRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running!' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
