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

// Update an existing subcategory
exports.updateSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, categoryId, isActive } = req.body;
        const user = req.user;

        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update a subcategory",
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

        // Check if subcategory exists
        const existingSubCategory = await SubCategory.findById(id);
        if (!existingSubCategory) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found",
            });
        }

        // Check if subcategory name already exists (excluding current subcategory)
        const duplicateSubCategory = await SubCategory.findOne({ 
            name: name.trim(), 
            _id: { $ne: id } 
        });
        if (duplicateSubCategory) {
            return res.status(400).json({
                success: false,
                message: "Subcategory name already exists",
            });
        }

        // Update subcategory
        const updatedSubCategory = await SubCategory.findByIdAndUpdate(
            id,
            {
                name: name.trim(),
                description: description?.trim(),
                categoryId,
                isActive: isActive !== undefined ? isActive : existingSubCategory.isActive,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: "Subcategory updated successfully",
            data: updatedSubCategory,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating subcategory",
            error: error.message,
        });
    }
};

// Delete a subcategory
exports.deleteSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to delete a subcategory",
            });
        }

        // Check if subcategory exists
        const existingSubCategory = await SubCategory.findById(id);
        if (!existingSubCategory) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found",
            });
        }

        // Check if subcategory is being used by any products
        const Product = require('../../Model/ProductsModel/createProduct');
        const productsUsingSubcategory = await Product.findOne({ subcategory: id });
        if (productsUsingSubcategory) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete subcategory. It is being used by products.",
            });
        }

        // Delete the subcategory
        await SubCategory.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Subcategory deleted successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting subcategory",
            error: error.message,
        });
    }
};




