const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// Try to load Sharp, with fallback
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.warn('Sharp module not available. Using fallback image processing.');
  sharp = null;
}

// Mobile-optimized image sizes
const MOBILE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 300, height: 300 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 1200 },
  original: null // Keep original size
};

// Profile picture specific sizes
const PROFILE_SIZES = {
  thumbnail: { width: 80, height: 80 },
  small: { width: 150, height: 150 },
  medium: { width: 300, height: 300 },
  large: { width: 500, height: 500 }
};

// Product image specific sizes
const PRODUCT_SIZES = {
  thumbnail: { width: 100, height: 100 },
  small: { width: 200, height: 200 },
  medium: { width: 400, height: 400 },
  large: { width: 800, height: 800 },
  original: null
};

// Quality settings for different use cases
const QUALITY_SETTINGS = {
  high: 90,
  medium: 75,
  low: 60,
  mobile: 70 // Optimized for mobile bandwidth
};

/**
 * Check if Sharp is available
 * @returns {boolean} - Whether Sharp is available
 */
const isSharpAvailable = () => {
  return sharp !== null;
};

/**
 * Optimize image for mobile devices
 * @param {Buffer|string} input - Input image buffer or file path
 * @param {Object} options - Optimization options
 * @returns {Promise<Buffer>} - Optimized image buffer
 */
const optimizeForMobile = async (input, options = {}) => {
  const {
    width = 800,
    height = 800,
    quality = QUALITY_SETTINGS.mobile,
    format = 'webp', // Better compression for mobile
    fit = 'inside', // Maintain aspect ratio
    withoutEnlargement = true
  } = options;

  try {
    if (!isSharpAvailable()) {
      // Fallback: return original image if Sharp is not available
      console.warn('Sharp not available, returning original image');
      if (typeof input === 'string') {
        return fs.readFileSync(input);
      }
      return input;
    }

    let image = sharp(input);

    // Auto-rotate based on EXIF data
    image = image.rotate();

    // Resize image
    if (width && height) {
      image = image.resize(width, height, {
        fit,
        withoutEnlargement
      });
    }

    // Convert to WebP for better mobile performance
    if (format === 'webp') {
      image = image.webp({ quality });
    } else if (format === 'jpeg') {
      image = image.jpeg({ quality, progressive: true });
    } else if (format === 'png') {
      image = image.png({ quality });
    }

    // Strip metadata to reduce file size
    image = image.withMetadata(false);

    return await image.toBuffer();
  } catch (error) {
    console.error('Image optimization failed:', error.message);
    // Fallback: return original image
    if (typeof input === 'string') {
      return fs.readFileSync(input);
    }
    return input;
  }
};

/**
 * Generate multiple sizes for responsive images
 * @param {Buffer|string} input - Input image
 * @param {Object} sizes - Size configurations
 * @param {string} outputDir - Output directory
 * @param {string} filename - Base filename
 * @returns {Promise<Object>} - Generated image paths
 */
const generateResponsiveImages = async (input, sizes, outputDir, filename) => {
  const results = {};

  for (const [sizeName, dimensions] of Object.entries(sizes)) {
    if (!dimensions) {
      // Keep original
      results[sizeName] = filename;
      continue;
    }

    try {
      const optimizedBuffer = await optimizeForMobile(input, {
        width: dimensions.width,
        height: dimensions.height,
        quality: QUALITY_SETTINGS.mobile
      });

      const sizeFilename = `${path.parse(filename).name}_${sizeName}.webp`;
      const outputPath = path.join(outputDir, sizeFilename);

      // Ensure directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write optimized image
      fs.writeFileSync(outputPath, optimizedBuffer);
      results[sizeName] = sizeFilename;
    } catch (error) {
      console.error(`Failed to generate ${sizeName} size:`, error);
      results[sizeName] = filename; // Fallback to original
    }
  }

  return results;
};

/**
 * Optimize profile picture with mobile-specific settings
 * @param {Buffer|string} input - Input image
 * @param {string} outputDir - Output directory
 * @param {string} filename - Base filename
 * @returns {Promise<Object>} - Optimized profile images
 */
const optimizeProfilePicture = async (input, outputDir, filename) => {
  return await generateResponsiveImages(input, PROFILE_SIZES, outputDir, filename);
};

/**
 * Optimize product images with mobile-specific settings
 * @param {Buffer|string} input - Input image
 * @param {string} outputDir - Output directory
 * @param {string} filename - Base filename
 * @returns {Promise<Object>} - Optimized product images
 */
const optimizeProductImage = async (input, outputDir, filename) => {
  return await generateResponsiveImages(input, PRODUCT_SIZES, outputDir, filename);
};

/**
 * Upload optimized images to Cloudinary
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} folder - Cloudinary folder
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (imageBuffer, folder, options = {}) => {
  const {
    width = 800,
    height = 800,
    quality = QUALITY_SETTINGS.mobile,
    format = 'webp'
  } = options;

  try {
    // Optimize image before upload
    const optimizedBuffer = await optimizeForMobile(imageBuffer, {
      width,
      height,
      quality,
      format
    });

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width, height, crop: 'fill', quality },
          { format: 'webp' }
        ]
      },
      (error, result) => {
        if (error) throw error;
        return result;
      }
    ).end(optimizedBuffer);

    return result;
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Generate image URLs for different screen sizes
 * @param {string} baseUrl - Base image URL
 * @param {string} filename - Image filename
 * @returns {Object} - Responsive image URLs
 */
const generateResponsiveUrls = (baseUrl, filename) => {
  const baseName = path.parse(filename).name;
  const extension = '.webp';

  return {
    thumbnail: `${baseUrl}/${baseName}_thumbnail${extension}`,
    small: `${baseUrl}/${baseName}_small${extension}`,
    medium: `${baseUrl}/${baseName}_medium${extension}`,
    large: `${baseUrl}/${baseName}_large${extension}`,
    original: `${baseUrl}/${filename}`
  };
};

/**
 * Validate image file for mobile optimization
 * @param {Object} file - Multer file object
 * @returns {Object} - Validation result
 */
const validateImageFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, and WebP images are allowed'
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Image size must be less than 10MB'
    };
  }

  return { valid: true };
};

/**
 * Clean up old image files
 * @param {string} directory - Directory path
 * @param {string} baseFilename - Base filename to clean up
 */
const cleanupOldImages = (directory, baseFilename) => {
  try {
    if (!fs.existsSync(directory)) return;

    const baseName = path.parse(baseFilename).name;
    const files = fs.readdirSync(directory);

    files.forEach(file => {
      if (file.startsWith(baseName) && file !== baseFilename) {
        const filePath = path.join(directory, file);
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error('Error cleaning up old images:', error);
  }
};

/**
 * Get optimal image size based on device type
 * @param {string} deviceType - Device type (mobile, tablet, desktop)
 * @param {string} imageType - Image type (profile, product, general)
 * @returns {Object} - Optimal size configuration
 */
const getOptimalSize = (deviceType = 'mobile', imageType = 'general') => {
  const sizeMap = {
    mobile: {
      profile: { width: 150, height: 150 },
      product: { width: 300, height: 300 },
      general: { width: 400, height: 400 }
    },
    tablet: {
      profile: { width: 300, height: 300 },
      product: { width: 600, height: 600 },
      general: { width: 800, height: 800 }
    },
    desktop: {
      profile: { width: 500, height: 500 },
      product: { width: 800, height: 800 },
      general: { width: 1200, height: 1200 }
    }
  };

  return sizeMap[deviceType]?.[imageType] || sizeMap.mobile.general;
};

/**
 * Simple image copy function for fallback when Sharp is not available
 * @param {string} sourcePath - Source image path
 * @param {string} destPath - Destination path
 * @param {string} newFilename - New filename
 * @returns {string} - New filename
 */
const copyImageAsFallback = (sourcePath, destPath, newFilename) => {
  try {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    
    const destFilePath = path.join(destPath, newFilename);
    fs.copyFileSync(sourcePath, destFilePath);
    return newFilename;
  } catch (error) {
    console.error('Error copying image:', error);
    return path.basename(sourcePath);
  }
};

/**
 * Generate fallback responsive images when Sharp is not available
 * @param {string} inputPath - Input image path
 * @param {Object} sizes - Size configurations
 * @param {string} outputDir - Output directory
 * @param {string} filename - Base filename
 * @returns {Promise<Object>} - Generated image paths (all pointing to original)
 */
const generateFallbackResponsiveImages = async (inputPath, sizes, outputDir, filename) => {
  const results = {};

  for (const [sizeName, dimensions] of Object.entries(sizes)) {
    if (!dimensions) {
      results[sizeName] = filename;
      continue;
    }

    try {
      // For fallback, just copy the original image with different names
      const fallbackFilename = `${path.parse(filename).name}_${sizeName}.jpg`;
      const copiedFilename = copyImageAsFallback(inputPath, outputDir, fallbackFilename);
      results[sizeName] = copiedFilename;
    } catch (error) {
      console.error(`Failed to generate fallback ${sizeName} size:`, error);
      results[sizeName] = filename; // Fallback to original
    }
  }

  return results;
};

module.exports = {
  optimizeForMobile,
  generateResponsiveImages,
  optimizeProfilePicture,
  optimizeProductImage,
  uploadToCloudinary,
  generateResponsiveUrls,
  validateImageFile,
  cleanupOldImages,
  getOptimalSize,
  isSharpAvailable,
  copyImageAsFallback,
  generateFallbackResponsiveImages,
  MOBILE_SIZES,
  PROFILE_SIZES,
  PRODUCT_SIZES,
  QUALITY_SETTINGS
};
