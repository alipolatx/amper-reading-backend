import express from 'express';
import mongoose from 'mongoose';
import AmperReading from '../models/AmperReading.js';
import Product from '../models/Product.js';
import { validateAmperData, validateUsername } from '../middleware/validation.js';

const router = express.Router();

// POST /api/data - ESP32'den amper verisi al
router.post('/data', validateAmperData, async (req, res) => {
  try {
    const { username, amper, productId,sensor } = req.body;

    // Validate that product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID - product not found'
      });
    }

    const newReading = new AmperReading({
      username,
      amper,
      product: productId,
      sensor
    });

    await newReading.save();

    res.status(201).json({
      success: true,
      message: 'Amper reading saved successfully',
      data: {
        id: newReading._id,
        username: newReading.username,
        amper: newReading.amper,
        product: {
          id: product._id,
          name: product.name,
          sensors: product.sensor
        },
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
    const products = await Product.find({}).populate('amperreadings').sort({ createdAt: -1 });

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

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get all amper readings for this product using the new relationship
    const readings = await AmperReading.find({ product: productId })
      .select('username amper createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Group readings by username and get stats for each user
    const userGroups = {};

    readings.forEach(reading => {
      const username = reading.username;
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

      if (
        !userGroups[username].latestReading ||
        reading.createdAt > userGroups[username].latestReading.createdAt
      ) {
        userGroups[username].latestReading = reading;
      }
    });

    // Calculate averages
    Object.keys(userGroups).forEach(username => {
      const userReadings = userGroups[username].readings;
      const sum = userReadings.reduce((acc, reading) => acc + reading.amper, 0);
      userGroups[username].averageAmper =
        userReadings.length > 0 ? Number((sum / userReadings.length).toFixed(2)) : 0;

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
const parseTimeRange = timeRange => {
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
  const startDate = new Date(now.getTime() - hoursToSubtract * 60 * 60 * 1000);

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

    // Build query filter using the new relationship
    const baseFilter = {
      product: productId,
      username: username
    };

    // Add time filter if timeRange is provided // TODO: Uncomment this
    // if (startDate) {
    //   baseFilter.createdAt = { $gte: startDate };
    // }

    // Get amper readings for this user in this product
    const readings = await AmperReading.find(baseFilter)
      .select('username amper sensor createdAt updatedAt')
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

// GET /api/products/:productId/users/:username/readings - Get amperreadings for specific user in product with sensor filter
router.get('/products/:productId/users/:username/readings', async (req, res) => {
  try {
    const { productId, username } = req.params;
    const { limit = 50, page = 1, timeRange, sensor } = req.query;

    // Decode URL-encoded sensor parameter (convert + to spaces)
    const decodedSensor = sensor ? decodeURIComponent(sensor.replace(/\+/g, ' ')) : sensor;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // If sensor is provided, validate it exists in the product's sensors array
    if (decodedSensor && !product.sensors.includes(decodedSensor)) {
      return res.status(400).json({
        success: false,
        message: `Sensor '${decodedSensor}' not found in product. Available sensors: ${product.sensors.join(', ')}`
      });
    }

    const skip = (page - 1) * limit;

    // Parse timeRange if provided
    const startDate = parseTimeRange(timeRange);

    // Build query filter using the new relationship
    const baseFilter = {
      product: productId,
      username: username
    };

    // Add sensor filter if provided
    if (decodedSensor) {
      baseFilter.sensor = decodedSensor;
    }

    // Add time filter if timeRange is provided
    // if (startDate) {
    //   baseFilter.createdAt = { $gte: startDate };
    // }

    // Get amper readings for this user in this product (optionally filtered by sensor)
    const readings = await AmperReading.find(baseFilter)
      .select('username amper sensor createdAt updatedAt')
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
        sensor: decodedSensor || null,
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
        sensor: decodedSensor || null,
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

// GET /api/products/:productId/sensor - Get users grouped by sensor for a product with pagination
router.get('/products/:productId/sensor', async (req, res) => {
  try {
    const { productId } = req.params;
    const { sensor, limit = 50, page = 1, timeRange } = req.query;

    // Decode URL-encoded sensor parameter (convert + to spaces)
    const decodedSensor = sensor ? decodeURIComponent(sensor.replace(/\+/g, ' ')) : sensor;

    if (!decodedSensor) {
      return res.status(400).json({
        success: false,
        message: 'Sensor parameter is required'
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Validate that the sensor exists in the product's sensors array
    if (!product.sensors.includes(decodedSensor)) {
      return res.status(400).json({
        success: false,
        message: `Sensor '${decodedSensor}' not found in product. Available sensors: ${product.sensors.join(', ')}`
      });
    }

    // Parse timeRange if provided
    const startDate = parseTimeRange(timeRange);

    // Build query filter
    const baseFilter = {
      product: productId,
      sensor: decodedSensor
    };

    // Add time filter if timeRange is provided
    // if (startDate) {
    //   baseFilter.createdAt = { $gte: startDate };
    // }

    // Get all amper readings for this product and sensor
    const readings = await AmperReading.find(baseFilter)
      .select('username amper createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Group readings by username and get stats for each user
    const userGroups = {};

    readings.forEach(reading => {
      const username = reading.username;
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

      if (
        !userGroups[username].latestReading ||
        reading.createdAt > userGroups[username].latestReading.createdAt
      ) {
        userGroups[username].latestReading = reading;
      }
    });

    // Calculate averages and prepare users array
    const allUsers = Object.keys(userGroups).map(username => {
      const userReadings = userGroups[username].readings;
      const sum = userReadings.reduce((acc, reading) => acc + reading.amper, 0);
      const averageAmper =
        userReadings.length > 0 ? Number((sum / userReadings.length).toFixed(2)) : 0;

      return {
        username: username,
        totalReadings: userGroups[username].totalReadings,
        latestReading: userGroups[username].latestReading,
        averageAmper: averageAmper
      };
    });

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(skip, skip + parseInt(limit));
    const total = allUsers.length;

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          sensors: product.sensors
        },
        sensor: decodedSensor,
        users: paginatedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      },
      meta: {
        productId: productId,
        sensor: decodedSensor,
        timeRange: timeRange || null,
        filteredFrom: startDate ? startDate.toISOString() : null,
        totalUsers: total,
        requestedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching users for product by sensor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/products/:productId/users/:username/readings/stats - Get statistics for filtered amper readings
router.get('/products/:productId/users/:username/readings/stats', async (req, res) => {
  try {
    const { productId, username } = req.params;
    const { timeRange, sensor } = req.query;

    // Decode URL-encoded sensor parameter (convert + to spaces)
    const decodedSensor = sensor ? decodeURIComponent(sensor.replace(/\+/g, ' ')) : sensor;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // If sensor is provided, validate it exists in the product's sensors array
    if (decodedSensor && !product.sensors.includes(decodedSensor)) {
      return res.status(400).json({
        success: false,
        message: `Sensor '${decodedSensor}' not found in product. Available sensors: ${product.sensors.join(', ')}`
      });
    }

    // Parse timeRange if provided
    const startDate = parseTimeRange(timeRange);

    // Build query filter using the new relationship
    const baseFilter = {
      product: productId,
      username: username
    };

    // Add sensor filter if provided
    if (decodedSensor) {
      baseFilter.sensor = decodedSensor;
    }

    // Add time filter if timeRange is provided
    // if (startDate) {
    //   baseFilter.createdAt = { $gte: startDate };
    // }

    console.log('🔍 Statistics baseFilter:', JSON.stringify(baseFilter, null, 2));
    
    // Convert productId to ObjectId for aggregation
    const aggregationFilter = {
      ...baseFilter,
      product: new mongoose.Types.ObjectId(productId)
    };
    console.log('🔍 Aggregation filter:', JSON.stringify(aggregationFilter, null, 2));
    
    // Debug: Test if any documents exist with this filter using find()
    const testCount = await AmperReading.countDocuments(baseFilter);
    console.log('📊 Test count with find():', testCount);

    // Get aggregated statistics for all filtered data
    const stats = await AmperReading.aggregate([
      { $match: aggregationFilter },
      {
        $group: {
          _id: null,
          totalReadings: { $sum: 1 },
          minAmper: { $min: '$amper' },
          maxAmper: { $max: '$amper' },
          avgAmper: { $avg: '$amper' },
          offCount: {
            $sum: {
              $cond: [{ $eq: ['$amper', 0] }, 1, 0]
            }
          },
          lowCount: {
            $sum: {
              $cond: [{ $and: [{ $gt: ['$amper', 0] }, { $lt: ['$amper', 0.5] }] }, 1, 0]
            }
          },
          midCount: {
            $sum: {
              $cond: [{ $and: [{ $gte: ['$amper', 0.5] }, { $lt: ['$amper', 1.0] }] }, 1, 0]
            }
          },
          highCount: {
            $sum: {
              $cond: [{ $gte: ['$amper', 1.0] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Handle case when no data is found
    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          product: {
            id: product._id,
            name: product.name,
            sensors: product.sensors
          },
          username: username,
          sensor: decodedSensor || null,
          statistics: {
            totalReadings: 0,
            minAmper: 0,
            maxAmper: 0,
            avgAmper: 0,
            categories: {
              off: 0,
              low: 0,
              mid: 0,
              high: 0
            }
          }
        },
        meta: {
          productId: productId,
          username: username,
          sensor: decodedSensor || null,
          timeRange: timeRange || null,
          filteredFrom: startDate ? startDate.toISOString() : null,
          requestedAt: new Date().toISOString()
        }
      });
    }

    const stat = stats[0];

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          sensors: product.sensors
        },
        username: username,
        sensor: decodedSensor || null,
        statistics: {
          totalReadings: stat.totalReadings,
          minAmper: Number(stat.minAmper.toFixed(2)),
          maxAmper: Number(stat.maxAmper.toFixed(2)),
          avgAmper: Number(stat.avgAmper.toFixed(2)),
          categories: {
            off: stat.offCount,
            low: stat.lowCount,
            mid: stat.midCount,
            high: stat.highCount
          }
        }
      },
      meta: {
        productId: productId,
        username: username,
        sensor: decodedSensor || null,
        timeRange: timeRange || null,
        filteredFrom: startDate ? startDate.toISOString() : null,
        requestedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching amper reading statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
