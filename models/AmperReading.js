import mongoose from 'mongoose';

const amperReadingSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [1, 'Username must be at least 1 character'],
      maxlength: [50, 'Username cannot exceed 50 characters']
    },
    amper: {
      type: Number,
      required: [true, 'Amper value is required'],
      min: [0, 'Amper value cannot be negative'],
      max: [100, 'Amper value cannot exceed 100A']
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required']
    },
    sensor: {
      type: String,
      required: false,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
amperReadingSchema.index({ username: 1, createdAt: -1 });
amperReadingSchema.index({ product: 1, createdAt: -1 });
amperReadingSchema.index({ product: 1, username: 1, createdAt: -1 });
amperReadingSchema.index({ product: 1, username: 1, sensor: 1, createdAt: -1 });

// Virtual for checking if amper is high (>= 1.0A)
amperReadingSchema.virtual('isHighAmper').get(function () {
  return this.amper >= 1.0;
});

// Static method to get user statistics
amperReadingSchema.statics.getUserStats = async function (username) {
  const stats = await this.aggregate([
    { $match: { username: username } },
    {
      $group: {
        _id: null,
        totalReadings: { $sum: 1 },
        highAmpCount: {
          $sum: {
            $cond: [{ $gte: ['$amper', 1.0] }, 1, 0]
          }
        },
        lowAmpCount: {
          $sum: {
            $cond: [{ $lt: ['$amper', 1.0] }, 1, 0]
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalReadings: 0,
      highAmpCount: 0,
      lowAmpCount: 0,
      percentage: 0
    };
  }

  const stat = stats[0];
  return {
    totalReadings: stat.totalReadings,
    highAmpCount: stat.highAmpCount,
    lowAmpCount: stat.lowAmpCount,
    percentage:
      stat.totalReadings > 0 ? Math.round((stat.highAmpCount / stat.totalReadings) * 100) : 0
  };
};

// Static method to get recent readings (last 24 hours)
amperReadingSchema.statics.getRecentReadings = async function (username) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    console.log(`🔍 Fetching recent readings for user: ${username}`);
    console.log(`📅 24 hours ago: ${twentyFourHoursAgo.toISOString()}`);

    // Debug: Check what data exists for this user
    const allUserData = await this.find({ username: username })
      .select('createdAt amper')
      .sort({ createdAt: -1 })
      .limit(5);
    console.log(
      '📊 All user data (last 5):',
      allUserData.map(d => ({ createdAt: d.createdAt, amper: d.amper }))
    );

    const readings = await this.find({
      username: username,
      createdAt: { $gte: twentyFourHoursAgo }
    })
      .select('createdAt amper _id')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    console.log(`📊 Found ${readings.length} recent readings for ${username}`);

    // Format data for mobile app with proper date formatting
    const formattedReadings = readings.map(reading => ({
      id: reading._id.toString(),
      timestamp: reading.createdAt.toISOString(),
      amper: Number(reading.amper.toFixed(2)) // Round to 2 decimal places
    }));

    return formattedReadings;
  } catch (error) {
    console.error('❌ Error in getRecentReadings:', error);
    throw error;
  }
};

export default mongoose.model('AmperReading', amperReadingSchema);
