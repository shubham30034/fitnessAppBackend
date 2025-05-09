const SubCategory = require('../../Model/ProductsModel/subCategory');



exports.createSubCategory = async (req, res) => {
    try {
        const { name, categoryId } = req.body;
        const user = req.user;
    
        if (!user || user.role !== 'superadmin') {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to create a subcategory",
        });
        }
    
        if (!name || !categoryId) {
        return res.status(400).json({
            success: false,
            message: "Subcategory name and category ID are required",
        });
        }
    
        const alreadyExists = await SubCategory.findOne({ name });
    
        if (alreadyExists) {
        return res.status(400).json({
            success: false,
            message: "Subcategory already exists",
        });
        }
    
        const newSubCategory = new SubCategory({
        name,
        categoryId,
        });
    
        await newSubCategory.save();
    
        return res.status(201).json({
        success: true,
        message: "Subcategory created successfully",
        subCategory: newSubCategory,
        });
    
    } catch (error) {
    
        return res.status(500).json({
        success: false,
        message: "Error creating subcategory",
        error: error.message,
        });
    
    }

}




exports.getAllSubCategories = async (req, res) => {
    try {
        const subCategories = await SubCategory.find()
            .populate("categoryId")
            .sort({ createdAt: -1 });
    
        res.status(200).json({
            success: true,
            message: "All subcategories fetched",
            subCategories,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};