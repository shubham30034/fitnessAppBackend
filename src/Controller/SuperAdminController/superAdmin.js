const User = require('../../Model/userModel/userModel');
const UserAdditionalInfo = require('../../Model/userModel/additionalInfo');
const bcrypt = require('bcryptjs');
const {createAdminValidation} = require("../../validator/superAdminValidator")
const CoachSchedule = require('../../Model/paidSessionModel/coachSheduleSchema');


// validation required for all controllers


// Create officals
exports.createUser = async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;

    // Only allow valid roles
    const validRoles = ['admin', 'seller', 'coach'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const { error } = createAdminValidation({ name, phone, email, password });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message),
      });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    const existingEmail = await UserAdditionalInfo.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ phone, password: hashedPassword, role });
    await user.save();

    const additionalInfo = new UserAdditionalInfo({ name, userId: user._id, email });
    await additionalInfo.save();

    user.additionalInfo = additionalInfo._id;
    await user.save();

    res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
      user,
      additionalInfo,
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
    const users = await User.find({"role":{$in:['admin','coach','seller']}}, 'phone role createdAt')
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



// create coach schedule

const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

exports.createCoachSchedule = async (req, res) => {
  try {
    const { coachId, days, startTime, endTime } = req.body;

    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Optional: Validate days array
    if (!Array.isArray(days) || days.some(day => !validDays.includes(day))) {
      return res.status(400).json({ success: false, message: "Invalid 'days' array" });
    }

    const existing = await CoachSchedule.findOne({ coach: coachId });

    if (existing) {
      await CoachSchedule.findByIdAndUpdate(existing._id, { days, startTime, endTime });
      return res.status(200).json({ success: true, message: 'Schedule updated successfully' });
    } else {
      await CoachSchedule.create({ coach: coachId, days, startTime, endTime });
      return res.status(201).json({ success: true, message: 'Schedule created successfully' });
    }
  } catch (err) {
    console.error("Error in creating schedule:", err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};



exports.editCoachSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params; // Schedule _id to edit
    const { days, startTime, endTime } = req.body;

    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Validate days array
    if (days && (!Array.isArray(days) || days.some(day => !validDays.includes(day)))) {
      return res.status(400).json({ success: false, message: "Invalid 'days' array" });
    }

    const schedule = await CoachSchedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }

    // Update only provided fields
    if (days) schedule.days = days;
    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;

    await schedule.save();

    res.status(200).json({ success: true, message: "Schedule updated successfully", schedule });
  } catch (err) {
    console.error("Error editing schedule:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};