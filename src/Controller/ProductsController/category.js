const Category = require('../../models/Category');


exports.createCategory = async (req, res) => {

 try {
    const { name } = req.body;
    const user = req.user;

 
    if(!user || user.role !== 'superadmin') {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to create a category",
        });
    }

    if (!name) {
        return res.status(400).json({
            success: false,
            message: "Category name is required",
        });
    }
    
   const alreadyExists = await Category.findOne({name})

   if(alreadyExists) {
    return res.status(400).json({
        success: false,
        message: "Category already exists",
    });
   }


    const newCategory = new Category({
        name,
    });

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


}



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






