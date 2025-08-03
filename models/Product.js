import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [1, 'Product name must be at least 1 character'],
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  sensors: [{
    type: String,
    trim: true
  }],
  amperreadings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AmperReading'
  }]
}, {
  timestamps: true
});

// Index for efficient queries
productSchema.index({ name: 1 });

export default mongoose.model('Product', productSchema);