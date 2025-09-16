import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { router } from './routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(router);
app.use(express.static('public'));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3051;
app.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`API listening on ${base}`);
  console.log(`Frontend URL: ${base}/`);
  console.log(`API Base URL: ${base}/v1`);
});
