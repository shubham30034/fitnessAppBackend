const User = require('../../Model/userModel/userModel');
const UserAdditionalInfo = require('../../Model/userModel/additionalInfo');
const bcrypt = require('bcryptjs');
const {createAdminValidation} = require("../../validator/superAdminValidator")


// validation required for all controllers


// Create Admin
exports.createAdmin = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

      const { error } = createAdminValidation({ name, phone, email, password });
     if (error) {
      return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map(e => e.message),
     });
  }

    // Check if phone is already registered in User collection
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    // Check if email is already registered in UserAdditionalInfo collection
    const existingEmail = await UserAdditionalInfo.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the User document
    const user = new User({
      phone,
      password: hashedPassword,
      role: 'admin'
    });
    await user.save();

    // Create the associated UserAdditionalInfo document
    const additionalInfo = new UserAdditionalInfo({
      name,
      userId: user._id,
      email
      // You can add address or profilePicture if needed.
    });
    await additionalInfo.save();

    // Update the User document with the reference to its additional info
    user.additionalInfo = additionalInfo._id;
    await user.save();

    res.status(201).json({
      message: 'Admin created successfully',
      admin: { user, additionalInfo }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// create Seller
exports.createSeller = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;


      const { error } = createAdminValidation({ name, phone, email, password });
    if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map(e => e.message),
    });
  }

    // Check if phone is already registered
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    // Check if email is already registered
    const existingEmail = await UserAdditionalInfo.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User document with seller role
    const user = new User({
      phone,
      password: hashedPassword,
      role: 'seller'
    });
    await user.save();

    // Create Additional Info
    const additionalInfo = new UserAdditionalInfo({
      name,
      userId: user._id,
      email
    });
    await additionalInfo.save();

    // Link additional info to user
    user.additionalInfo = additionalInfo._id;
    await user.save();

    res.status(201).json({
      message: 'Seller created successfully',
      seller: { user, additionalInfo }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// Create Coach
exports.createCoach = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

      const { error } = createAdminValidation({ name, phone, email, password });
      if (error) {
      return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map(e => e.message),
    });
    }

    // Check phone for duplicate in User collection
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    // Check email for duplicate in UserAdditionalInfo collection
    const existingEmail = await UserAdditionalInfo.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the User document with role 'coach'
    const user = new User({
      phone,
      password: hashedPassword,
      role: 'coach'
    });
    await user.save();

    // Create the associated UserAdditionalInfo document
    const additionalInfo = new UserAdditionalInfo({
      name,
      userId: user._id,
      email
    });
    await additionalInfo.save();

    // Update the User document with the reference to its additional info
    user.additionalInfo = additionalInfo._id;
    await user.save();

    res.status(201).json({
      message: 'Coach created successfully',
      coach: { user, additionalInfo }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get All Users (with additional info populated)
exports.getAllUsers = async (req, res) => {
  try {
    // Populate additionalInfo so you can view email and name
    const users = await User.find({}, 'phone role createdAt')
      .populate('additionalInfo', 'name email');
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};


exports.getOfficals = async (req, res) => {
  try {
    // Populate additionalInfo so you can view email and name
    const users = await User.find({"role":{$in:['admin','coach']}}, 'phone role createdAt')
      .populate('additionalInfo', 'name email');
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};

// Delete User by ID
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deletion if the user is a superadmin
    if (user.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete superadmin' });
    }

    // Delete the additional info document if exists
    if (user.additionalInfo) {
      await UserAdditionalInfo.findByIdAndDelete(user.additionalInfo);
    }
    
    // Delete the user document
    await User.findByIdAndDelete(id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
};

// getProducts Invoice
exports.getAllInvoices = async (req, res) => {
  try {
    const allOrders = await Order.find({})
      .populate('productId')
      .populate('userId');

    if (!allOrders || allOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found",
      });
    }

    // 🧾 Build invoice-like data
    const invoices = allOrders.map((order) => ({
      invoiceId: `INV-${order._id}`,
      userName: order.userId.name,
      userEmail: order.userId.email,
      productName: order.productId.name,
      quantity: order.quantity,
      pricePerItem: order.productId.price,
      totalAmount: order.totalPrice,
      address: order.address,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      orderDate: order.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "All invoices fetched successfully",
      invoices,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error generating invoices",
      error: error.message,
    });
  }
};


