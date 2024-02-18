import express, { Request, Response } from 'express';
import { collectDefaultMetrics, register } from 'prom-client';
import { HTTPServerMetricRecord } from './types';

const app = express();
const PORT = 3000;

// Initialize default Prometheus metrics
collectDefaultMetrics();

// Expose Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
});

app.get('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start the HTTP server
const server = app.listen(PORT, () => {
  console.log(`Prometheus metrics endpoint listening on port ${PORT}`);
});

// Export HTTP server for testing or additional manipulation
export default server;

// Define custom types if needed
export type { HTTPServerMetricRecord };