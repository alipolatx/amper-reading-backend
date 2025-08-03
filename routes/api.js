import express from 'express';
import AmperReading from '../models/AmperReading.js';
import Product from '../models/Product.js';
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

// GET /api/products - Get all products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({})
      .populate('amperreadings')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products,
      meta: {
        count: products.length,
        requestedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/products/:productId/users - Get usernames grouped by product
router.get('/products/:productId/users', async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId).populate('amperreadings');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Group amperreadings by username and get stats for each user
    const userGroups = {};
    
    product.amperreadings.forEach(reading => {
      const username = reading._doc.username;
      if (!userGroups[username]) {
        userGroups[username] = {
          username: username,
          totalReadings: 0,
          latestReading: null,
          averageAmper: 0,
          readings: []
        };
      }
      
      userGroups[username].totalReadings++;
      userGroups[username].readings.push(reading);
      
      if (!userGroups[username].latestReading || 
          reading.createdAt > userGroups[username].latestReading.createdAt) {
        userGroups[username].latestReading = reading;
      }
    });

    // Calculate averages
    Object.keys(userGroups).forEach(username => {
      const readings = userGroups[username].readings;
      const sum = readings.reduce((acc, reading) => acc + reading.amper, 0);
      userGroups[username].averageAmper = readings.length > 0 ? 
        Number((sum / readings.length).toFixed(2)) : 0;
      
      // Remove readings array from response (we only need stats here)
      delete userGroups[username].readings;
    });

    const users = Object.values(userGroups);

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          sensors: product.sensors
        },
        users: users
      },
      meta: {
        productId: productId,
        totalUsers: users.length,
        requestedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching product users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to parse timeRange parameter
const parseTimeRange = (timeRange) => {
  if (!timeRange) return null;
  
  const match = timeRange.match(/^(\d+)([hd])$/);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  // Validate allowed values
  const allowedHours = [1, 6, 12, 24];
  const allowedDays = [7, 30];
  
  if (unit === 'h' && !allowedHours.includes(value)) return null;
  if (unit === 'd' && !allowedDays.includes(value)) return null;
  
  const now = new Date();
  const hoursToSubtract = unit === 'h' ? value : value * 24;
  const startDate = new Date(now.getTime() - (hoursToSubtract * 60 * 60 * 1000));
  
  return startDate;
};

// GET /api/products/:productId/users/:username - Get amperreadings for specific user in product
router.get('/products/:productId/users/:username', async (req, res) => {
  try {
    const { productId, username } = req.params;
    const { limit = 50, page = 1, timeRange } = req.query;

    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const skip = (page - 1) * limit;

    // Parse timeRange if provided
    const startDate = parseTimeRange(timeRange);
    
    // Build query filter
    const baseFilter = {
      _id: { $in: product.amperreadings },
      username: username
    };
    
    // Add time filter if timeRange is provided // TODO: Uncomment this
    // if (startDate) {
    //   baseFilter.createdAt = { $gte: startDate };
    // }

    // Get amperreadings for this user that are also in this product
    const readings = await AmperReading.find(baseFilter)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

    const total = await AmperReading.countDocuments(baseFilter);

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          sensors: product.sensors
        },
        username: username,
        readings: readings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      },
      meta: {
        productId: productId,
        username: username,
        timeRange: timeRange || null,
        filteredFrom: startDate ? startDate.toISOString() : null,
        requestedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching user readings for product:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router; 