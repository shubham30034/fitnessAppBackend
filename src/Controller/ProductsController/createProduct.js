const Product = require("../../Model/ProductsModel/product");
const mongoose = require("mongoose");
const Category = require("../../Model/ProductsModel/category");
const fs = require('fs');
const path = require('path');
const { uploadMultipleImagesToCloudinary } = require("../../Utils/imageUploader");
const {createProductValidation,updateProductValidation} = require("../../validator/productValidation")

// creatre Profduct
exports.createProduct = async (req, res) => {
  try {

    const sellerId = req.user.id; // Assuming user ID is stored in req.user after authentication
    const { name, description, price, category, quantity} = req.body;

 
  const { error } = createProductValidation({ name, description, price, category, quantity, sellerId });
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      sellerId,
      productImages: [], // initially empty
      quantity
    });

    await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "Product created, now upload images separately",
      product: newProduct,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};


// update existing product
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const sellerId = req.user.id; // From authentication middleware
    const { name, description, price, category, quantity } = req.body;

    console.log("Updating product:", name, description, price, category, quantity);

    // Validate required fields
   const { error } = updateProductValidation({ productId, name, description, price, category, quantity });
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Find product and check ownership
    const product = await Product.findOne({ _id: productId, sellerId });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found or unauthorized" });
    }

    // Update fields
    product.name = name;
    product.description = description;
    product.price = price;
    product.category = category;
    product.quantity = quantity;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message,
    });
  }
};


// upload multiple images for a product
exports.uploadProductImages = async (req, res) => {
  try {
    const productId = req.params.productId;
    const product = await Product.findById(productId);
    if (!product) {
      // Delete uploaded files if product not found
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const existingCount = product.productImages.length;
    const newCount = req.files.length;

    if (existingCount + newCount > 3) {
      // Delete uploaded files as they exceed max limit
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });

      return res.status(400).json({
        success: false,
        message: `Upload failed. You can only upload ${3 - existingCount} more image(s).`
      });
    }

    // Save filenames
    const filenames = req.files.map(file => file.filename);
    product.productImages.push(...filenames);
    await product.save();

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      product
    });

  } catch (error) {
    // Delete uploaded files if error occurs
    if (req.files) {
      req.files.forEach(file => {
        fs.unlinkSync(file.path);
      });
    }
    res.status(500).json({ success: false, message: "Upload failed", error: error.message });
  }
};

//  update specific product image
exports.updateSpecificProductImage = async (req, res) => {
  try {
    const productId = req.params.productId;
    const oldFilename = req.body.filename; // filename to replace


    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      if (req.files) {
        req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      }
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    if (!oldFilename) {
      if (req.files) {
        req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      }
      return res.status(400).json({ success: false, message: "Please provide filename to replace" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No new image uploaded" });
    }

    // Find product
    const product = await Product.findById(productId);
    if (!product) {
      req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    console.log("Product images array:", product.productImages);

    // Find index of old filename ignoring case and spaces
    const idx = product.productImages.findIndex(img => {
      const imgNormalized = img.trim().toLowerCase();
      const oldNormalized = oldFilename.trim().toLowerCase();
      console.log(`Comparing "${imgNormalized}" with "${oldNormalized}"`);
      return imgNormalized === oldNormalized;
    });

    console.log("Found index:", idx);

    if (idx === -1) {
      req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
      return res.status(400).json({ success: false, message: "Old filename not found in product images" });
    }

    // Delete old image file from disk
    const imageDir = path.join(__dirname, `../../../uploads/products/${productId}`);
    const oldFilePath = path.join(imageDir, product.productImages[idx]);
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
      console.log(`Deleted old file: ${oldFilePath}`);
    } else {
      console.log(`Old file not found on disk: ${oldFilePath}`);
    }

    // Replace old filename with new filename
    const newFilename = req.files[0].filename;
    product.productImages[idx] = newFilename;

    await product.save();

    res.status(200).json({
      success: true,
      message: "Product image updated successfully",
      product
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (req.files) {
      req.files.forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));
    }
    res.status(500).json({ success: false, message: "Update failed", error: error.message });
  }
};


// get all products with pagination and filters
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category")
      .populate("sellerId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "All products fetched",
      products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



// Get all products created by the logged-in seller
exports.getOwnProducts = async (req, res) => {
  try {
    const sellerId = req.user.id; // Set by your authentication middleware


    // 1. Validate seller ID
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: "Invalid seller ID" });
    }

    // 2. Optional: Add filters (e.g., search, category, pagination)
    const { search, category, page = 1, limit = 10 } = req.query;
    const query = { sellerId };

    if (search) {
      query.name = { $regex: search, $options: 'i' }; // case-insensitive search by name
    }

    if (category) {
      query.category = category;
    }

    // 3. Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    // 4. Response
    res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      products
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// get a single product by ID
exports.getSingleProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId)
      .populate("category")
      .populate("sellerId", "name email");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// delete a product and its images
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const sellerId = req.user.id; // Assuming user is authenticated and ID is attached to req.user

    // 1. Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    if(!sellerId){
      return res.status(400).json({
        success:false,
        message:"unable to find userId"
      })
    }

    // 2. Find the product
    const product = await Product.findOne({ _id: productId, sellerId });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or unauthorized' });
    }

    // 3. Delete product images from filesystem
    const imageDir = path.join(__dirname, `../../uploads/products/${productId}`);
    if (fs.existsSync(imageDir)) {
      fs.readdirSync(imageDir).forEach(file => {
        const filePath = path.join(imageDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // delete each image
        }
      });

      // Remove the image directory after deleting files
      fs.rmdirSync(imageDir);
    }

    // 4. Delete the product from the database
    await Product.findByIdAndDelete(productId);

    res.status(200).json({ success: true, message: 'Product deleted successfully' });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
