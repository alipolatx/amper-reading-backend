import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [1, 'Product name must be at least 1 character'],
      maxlength: [100, 'Product name cannot exceed 100 characters']
    },
    sensors: [
      {
        type: String,
        trim: true
      }
    ]
  },
  {
    timestamps: true
  }
);

// Index for efficient queries
productSchema.index({ name: 1 });

// Virtual populate for amperreadings
productSchema.virtual('amperreadings', {
  ref: 'AmperReading',
  localField: '_id',
  foreignField: 'product'
});

// Ensure virtual fields are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export default mongoose.model('Product', productSchema);
