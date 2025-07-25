const SubCategory = require('../../Model/ProductsModel/subCategory');
const {createSubCategoryValidation} = require("../../validator/productValidation")


exports.createSubCategory = async (req, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to create a subcategory",
      });
    }

    // Validate input with Joi
    const { error } = createSubCategoryValidation(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { name, categoryId } = req.body;

    // Check if subcategory already exists
    const alreadyExists = await SubCategory.findOne({ name: name.trim() });
    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        message: "Subcategory already exists",
      });
    }

    // Create new subcategory
    const newSubCategory = new SubCategory({
      name: name.trim(),
      categoryId,
    });

    await newSubCategory.save();

    return res.status(201).json({
      success: true,
      message: "Subcategory created successfully",
      data: newSubCategory,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating subcategory",
      error: error.message,
    });
  }
};

exports.getAllSubCategories = async (req, res) => {
    try {
        const subCategories = await SubCategory.find()
            .populate("categoryId")
            .sort({ createdAt: -1 });
    
        res.status(200).json({
            success: true,
            message: "All subcategories fetched",
            data: subCategories,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};




