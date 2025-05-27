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
        const allowedCategories = ['suppliment', 'clothes', 'accessories'];
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
            category: newCategory,
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
        const categories = await Category.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "All categories fetched",
            categories,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching categories",
            error: error.message,
        });
    }
};




// get all products of a category for a specific user






