import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import queryRoutes from './routes/query.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Per section 16.1: enforce REQUEST_TIMEOUT_MS on all requests
app.use((req: Request, res: Response, next: NextFunction): void => {
  const timeoutMs = (() => {
    const raw = process.env.REQUEST_TIMEOUT_MS
    const n = raw ? Number(raw) : 10000
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10000
  })()

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        schema_version: 'v1',
        error: {
          code: 'TIMEOUT',
          message: 'Request timed out',
        },
        trace: [],
      })
    }
  }, timeoutMs)

  res.on('finish', () => clearTimeout(timer))
  res.on('close', () => clearTimeout(timer))
  next()
})

app.get('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api', queryRoutes)

// 404 handler
app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    schema_version: 'v1',
    error: { code: 'INVALID_QUERY', message: 'API endpoint not found' },
    trace: [],
  })
})

// Global error handler
app.use((error: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[unhandled]', error)
  res.status(500).json({
    schema_version: 'v1',
    error: { code: 'PROVIDER_ERROR', message: 'Internal server error' },
    trace: [],
  })
})

export default app
