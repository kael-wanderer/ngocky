import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import dashboardRoutes from './routes/dashboard';
import goalRoutes from './routes/goals';
import taskRoutes from './routes/tasks';
import checkInRoutes from './routes/checkins';
import projectRoutes from './routes/projects';
import houseworkRoutes from './routes/housework';
import calendarRoutes from './routes/calendar';
import expenseRoutes from './routes/expenses';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import assetRoutes from './routes/assets';
import learningRoutes from './routes/learning';
import ideaRoutes from './routes/ideas';
import alertRoutes from './routes/alerts';
import scheduledReportRoutes from './routes/scheduled-reports';
import serviceRoutes from './routes/service';
import assistantRoutes from './routes/assistant';

const app = express();

// Middleware
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: config.APP_VERSION });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/checkins', checkInRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/housework', houseworkRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/scheduled-reports', scheduledReportRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/assistant', assistantRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
