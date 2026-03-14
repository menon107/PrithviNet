import express from 'express'
import cors from 'cors'
import pollutionRoutes from './routes/pollution.js'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/v1/pollution', pollutionRoutes)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`[backend] running on http://localhost:${PORT}`)
})
