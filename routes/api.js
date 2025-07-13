import express from 'express';
import AmperReading from '../models/AmperReading.js';
import { validateAmperData, validateUsername } from '../middleware/validation.js';

const router = express.Router();

// POST /api/data - ESP32'den amper verisi al
router.post('/data', validateAmperData, async (req, res) => {
  try {
    const { username, amper } = req.body;

    const newReading = new AmperReading({
      username,
      amper
    });

    await newReading.save();

    res.status(201).json({
      success: true,
      message: 'Amper reading saved successfully',
      data: {
        id: newReading._id,
        username: newReading.username,
        amper: newReading.amper,
        timestamp: newReading.createdAt
      }
    });

  } catch (error) {
    console.error('Error saving amper reading:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/user/:username/stats - Kullanıcı istatistikleri
router.get('/user/:username/stats', validateUsername, async (req, res) => {
  try {
    const { username } = req.params;

    const stats = await AmperReading.getUserStats(username);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/user/:username/recent - Son 24 saat verisi
router.get('/user/:username/recent', validateUsername, async (req, res) => {
  try {
    const { username } = req.params;
    
    console.log(`📱 Recent data request for user: ${username}`);

    const recentReadings = await AmperReading.getRecentReadings(username);

    console.log(`✅ Sending ${recentReadings.length} recent readings to mobile app`);

    res.json({
      success: true,
      data: recentReadings,
      meta: {
        count: recentReadings.length,
        requestedAt: new Date().toISOString(),
        timeRange: 'last_24_hours'
      }
    });

  } catch (error) {
    console.error('❌ Error fetching recent readings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching recent data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/health - Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Amper Tracker API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// GET /api/user/:username/all 
router.get('/user/:username/all', validateUsername, async (req, res) => {
  try {
    const { username } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const skip = (page - 1) * limit;
    
    const readings = await AmperReading.find({ username })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await AmperReading.countDocuments({ username });

    res.json({
      success: true,
      data: {
        readings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching all user readings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router; 