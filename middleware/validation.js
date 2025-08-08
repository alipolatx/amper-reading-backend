const validateAmperData = (req, res, next) => {
  const { username, amper, productId } = req.body;

  // Check required fields
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username is required'
    });
  }

  if (amper === undefined || amper === null) {
    return res.status(400).json({
      success: false,
      message: 'Amper value is required'
    });
  }

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: 'Product ID is required'
    });
  }

  // Validate username
  if (typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Username must be a non-empty string'
    });
  }

  if (username.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Username cannot exceed 50 characters'
    });
  }

  // Validate amper value
  const amperNum = Number(amper);
  if (isNaN(amperNum)) {
    return res.status(400).json({
      success: false,
      message: 'Amper value must be a valid number'
    });
  }

  if (amperNum < 0) {
    return res.status(400).json({
      success: false,
      message: 'Amper value cannot be negative'
    });
  }

  if (amperNum > 100) {
    return res.status(400).json({
      success: false,
      message: 'Amper value cannot exceed 100A'
    });
  }

  // Validate productId format (MongoDB ObjectId)
  if (typeof productId !== 'string' || !/^[0-9a-fA-F]{24}$/.test(productId)) {
    return res.status(400).json({
      success: false,
      message: 'Product ID must be a valid MongoDB ObjectId'
    });
  }

  // Clean and set validated data
  req.body.username = username.trim();
  req.body.amper = amperNum;
  req.body.productId = productId.trim();

  next();
};

const validateUsername = (req, res, next) => {
  const { username } = req.params;

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid username is required'
    });
  }

  if (username.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Username cannot exceed 50 characters'
    });
  }

  req.params.username = username.trim();
  next();
};

export { validateAmperData, validateUsername }; 