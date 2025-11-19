const Category = require('../../Model/ProductsModel/category');


exports.createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const user = req.user;

        // Authorization check
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to create a category",
            });
        }

        // Check if name is provided
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Valid category name is required",
            });
        }

        const trimmedName = name.trim().toLowerCase();

        // Validate against allowed enum values
        const allowedCategories = ['supplement', 'clothes', 'accessories', 'equipment', 'nutrition', 'wellness', 'technology', 'books', 'apparel', 'footwear'];
        if (!allowedCategories.includes(trimmedName)) {
            return res.status(400).json({
                success: false,
                message: `Category must be one of the following: ${allowedCategories.join(', ')}`,
            });
        }

        // Check for duplicate
        const alreadyExists = await Category.findOne({ name: trimmedName });
        if (alreadyExists) {
            return res.status(400).json({
                success: false,
                message: "Category already exists",
            });
        }

        // Create and save
        const newCategory = new Category({ name: trimmedName });
        await newCategory.save();

        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: newCategory,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating category",
            error: error.message,
        });
    }
};




exports.getAllCategories = async (req, res) => {
    try {
        console.log('🔍 Categories: getAllCategories called');
        console.log('🔍 Categories: Request headers:', req.headers);
        console.log('🔍 Categories: Request method:', req.method);
        console.log('🔍 Categories: Request URL:', req.url);
        
        const categories = await Category.find().sort({ createdAt: -1 });
        console.log('🔍 Categories: Found categories:', categories);

        return res.status(200).json({
            success: true,
            message: "All categories fetched",
            data: categories,
        });
    } catch (error) {
        console.error('🔍 Categories: Error:', error);
        return res.status(500).json({
            success: false,
            message: "Error fetching categories",
            error: error.message,
        });
    }
};




// Update an existing category
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;
        const user = req.user;

        // Authorization check
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to update a category",
            });
        }

        // Check if name is provided
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Valid category name is required",
            });
        }

        const trimmedName = name.trim().toLowerCase();

        // Validate against allowed enum values
        const allowedCategories = ['supplement', 'clothes', 'accessories', 'equipment', 'nutrition', 'wellness', 'technology', 'books', 'apparel', 'footwear'];
        if (!allowedCategories.includes(trimmedName)) {
            return res.status(400).json({
                success: false,
                message: `Category must be one of the following: ${allowedCategories.join(', ')}`,
            });
        }

        // Check if category exists
        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        // Check for duplicate name (excluding current category)
        const duplicateCategory = await Category.findOne({ 
            name: trimmedName, 
            _id: { $ne: id } 
        });
        if (duplicateCategory) {
            return res.status(400).json({
                success: false,
                message: "Category name already exists",
            });
        }

        // Update category
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            {
                name: trimmedName,
                description: description?.trim(),
                isActive: isActive !== undefined ? isActive : existingCategory.isActive,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: updatedCategory,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating category",
            error: error.message,
        });
    }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // Authorization check
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to delete a category",
            });
        }

        // Check if category exists
        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        // Check if category is being used by any products
        const Product = require('../../Model/ProductsModel/createProduct');
        const productsUsingCategory = await Product.findOne({ category: id });
        if (productsUsingCategory) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete category. It is being used by products.",
            });
        }

        // Delete the category
        await Category.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting category",
            error: error.message,
        });
    }
};

// get all products of a category for a specific user






