import { Router } from 'express'
import { getHeatmapData, getGoogleAQIData, getHourlyData } from '../controllers/pollutionController.js'

const router = Router()

router.get('/heatmap',    getHeatmapData)
router.get('/google-aqi', getGoogleAQIData)
router.get('/hourly',     getHourlyData)

export default router
