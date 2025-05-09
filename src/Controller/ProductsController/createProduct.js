const Product = require("../../Model/ProductsModel/product");
const Category = require("../../Model/ProductsModel/category");
const uploadImageToCloudinary = require("../../utils/uploadImageToCloudinary"); // single file
const { uploadMultipleImagesToCloudinary } = require("../../utils/uploadImageToCloudinary"); // for multiple files

exports.createProduct = async (req, res) => {
  try {

    const { name, description, price, category, quantity, sellerId } = req.body;
    const files = req.files?.productImages;

    // Validate required fields
    if (!name || !description || !price || !category || !quantity || !sellerId || !files) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }



    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Ensure files is always an array
    const imageFiles = Array.isArray(files) ? files : [files];

    // Validate file types
    const supportedTypes = ["jpg", "jpeg", "png"];
    for (let file of imageFiles) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (!supportedTypes.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported file type: ${file.name}`,
        });
      }
    }

    // Upload all images to Cloudinary
    const uploadedImageUrls = await uploadMultipleImagesToCloudinary(imageFiles, "gym-supplements");
    if (!uploadedImageUrls || uploadedImageUrls.length === 0) {
        return res.status(500).json({
            success: false,
            message: "Failed to upload images to Cloudinary",
        });
    }

    // Create new product
    const newProduct = new Product({
      name,
      description,
      price,
      category,
      sellerId,
      productImages: uploadedImageUrls,
      quantity
    });

    await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
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





exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Delete all product images from Cloudinary
    const destroyResults = [];
    for (let imageUrl of product.productImages) {
      const publicId = getCloudinaryPublicId(imageUrl);
      const result = await cloudinary.uploader.destroy(publicId);
      destroyResults.push(result);
    }

    // Delete product from DB
    await Product.findByIdAndDelete(productId);

    res.status(200).json({
      success: true,
      message: "Product and its images deleted successfully",
      destroyResults
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};




