const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3200

// Middlewares
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'editor-v2-api',
    timestamp: new Date().toISOString(),
  })
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'LePatron.email - Editor v2 API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      designSystems: '/api/v2/design-systems',
      render: '/api/v2/render',
      emails: '/api/v2/emails',
    },
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`✅ Editor V2 API running on http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
})

module.exports = app
