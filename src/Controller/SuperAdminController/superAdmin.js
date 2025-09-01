const mongoose = require('mongoose');
const User = require('../../Model/userModel/userModel');
const UserAdditionalInfo = require('../../Model/userModel/additionalInfo');
const bcrypt = require('bcryptjs');
const {createAdminValidation} = require("../../validator/superAdminValidator")
const CoachSchedule = require('../../Model/paidSessionModel/coachSchedule');
const UserSubscription = require('../../Model/paidSessionModel/userSubscription');
const Session = require('../../Model/paidSessionModel/session');
const Product = require('../../Model/ProductsModel/product');
const Order = require('../../Model/ProductsModel/orderSchema');
// CoachScheduleSale functionality now integrated into CoachSchedule



// validation required for all controllers


// Create officals
exports.createUser = async (req, res) => {
  try {
    const { name, phone, email, password, role, monthlyFee = 5000, currency = 'INR', experience, bio } = req.body;

    // Only allow valid roles
    const validRoles = ['admin', 'seller', 'coach', 'coachmanager'];
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

    // If creating a coach, also create CoachProfile
    let coachProfile = null;
    if (role === 'coach') {
      const CoachProfile = require('../../Model/paidSessionModel/coach');
      coachProfile = await CoachProfile.create({
        user: user._id,
        monthlyFee,
        currency,
        feeUpdatedBy: req.user.id,
        feeUpdatedAt: new Date(),
        experience: experience || 0,
        bio: bio || ''
      });
    }

    const response = {
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully`,
      user,
      additionalInfo,
    };

    // Include coach profile info if created
    if (coachProfile) {
      response.coachProfile = {
        monthlyFee: coachProfile.monthlyFee,
        currency: coachProfile.currency,
        experience: coachProfile.experience,
        bio: coachProfile.bio
      };
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get All Users (with additional info populated)
exports.getAllUsers = async (req, res) => {
  try {
    // Populate additionalInfo so you can view email and name
    const users = await User.find({}, 'phone role createdAt isActive')
      .populate('additionalInfo', 'name email');
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};


exports.getOfficals = async (req, res) => {
  try {
    // Populate additionalInfo so you can view email and name
    const users = await User.find({"role":{$in:['admin','coach','seller','coachmanager']}}, 'phone role createdAt isActive')
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
      .populate('products.productId')
      .populate({
        path: 'userId',
        populate: { path: 'additionalInfo', select: 'name email' }
      });

    if (!allOrders || allOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found",
      });
    }

    // Build invoice-like data per order
    const invoices = allOrders.map((order) => ({
      invoiceId: `INV-${order._id}`,
      user: {
        id: order.userId?._id,
        phone: order.userId?.phone,
        name: order.userId?.additionalInfo?.name || '',
        email: order.userId?.additionalInfo?.email || '',
      },
      products: order.products.map(p => ({
        name: p.productId?.name,
        quantity: p.quantity,
        pricePerItem: p.price,
        total: p.price * p.quantity,
      })),
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
      await CoachSchedule.create({ 
        coach: coachId, 
        days, 
        startTime, 
        endTime 
      });
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

// Get all coach schedules
exports.getAllCoachSchedules = async (req, res) => {
  try {
    const schedules = await CoachSchedule.find()
      .populate({
        path: 'coach',
        select: 'phone role createdAt',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    // Get coach profiles separately since CoachSchedule doesn't have coachProfile field
    const formattedSchedules = await Promise.all(schedules.map(async (schedule) => {
      // Get coach profile separately
      const coachProfile = await CoachProfile.findOne({ user: schedule.coach._id });
      
      return {
        _id: schedule._id,
        coach: {
          _id: schedule.coach._id,
          name: schedule.coach.additionalInfo?.name || 'Unknown',
          email: schedule.coach.additionalInfo?.email || 'Unknown',
          phone: schedule.coach.phone
        },
        coachProfile: coachProfile ? {
          monthlyFee: coachProfile.monthlyFee,
          currency: coachProfile.currency,
          specialization: coachProfile.specialization,
          experience: coachProfile.experience,
          bio: coachProfile.bio,
          isActive: coachProfile.isActive
        } : null,
        days: schedule.days,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        monthlyFee: schedule.monthlyFee,
        currency: schedule.currency,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt
      };
    }));

    res.status(200).json({
      success: true,
      count: formattedSchedules.length,
      schedules: formattedSchedules
    });
  } catch (error) {
    console.error('Error fetching coach schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== SUPER ADMIN COACH MANAGEMENT =====================

// Get all coaches with detailed information
exports.getAllCoachesDetailed = async (req, res) => {
  try {
    const coaches = await User.find({ role: 'coach' })
      .populate('additionalInfo', 'name email experience bio')
      .select('-password');

    const coachesWithStats = [];

    for (const coach of coaches) {
      // Get coach profile with fee information
      const coachProfile = await CoachProfile.findOne({ user: coach._id });

      // Get active subscriptions count
      const activeSubscriptions = await UserSubscription.countDocuments({
        coach: coach._id,
        isActive: true
      });

      // Get total sessions conducted
      const totalSessions = await Session.countDocuments({
        coach: coach._id
      });

      // Get coach schedule
      const schedule = await CoachSchedule.findOne({ coach: coach._id });

      coachesWithStats.push({
        ...coach.toObject(),
        monthlyFee: coachProfile?.monthlyFee || 0,
        currency: coachProfile?.currency || 'INR',
        specialization: coachProfile?.specialization || [],
        certification: coachProfile?.certification || [],
        rating: coachProfile?.rating || 0,
        totalSessions: coachProfile?.totalSessions || 0,
        totalClients: coachProfile?.totalClients || 0,
        isActive: coachProfile?.isActive !== false,
        activeSubscriptions,
        totalSessions,
        schedule
      });
    }

    res.status(200).json({
      success: true,
      count: coachesWithStats.length,
      coaches: coachesWithStats
    });
  } catch (error) {
    console.error('Error fetching coaches:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get coach by ID with all details
exports.getCoachDetailed = async (req, res) => {
  try {
    const { coachId } = req.params;

    // Validate coachId parameter
    if (!coachId || coachId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Coach ID is required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(coachId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Coach ID format'
      });
    }

    const coach = await User.findById(coachId)
      .where('role').equals('coach')
      .populate('additionalInfo', 'name email experience bio')
      .select('-password');

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Get coach profile with fee information
    const coachProfile = await CoachProfile.findOne({ user: coachId });

    // Get active subscriptions count
    const activeSubscriptions = await UserSubscription.countDocuments({
      coach: coachId,
      isActive: true
    });

    // Get total sessions conducted
    const totalSessions = await Session.countDocuments({
      coach: coachId
    });

    // Get coach schedule
    const schedule = await CoachSchedule.findOne({ coach: coachId });

    // Get all students for this coach
    const students = await UserSubscription.find({
      coach: coachId,
      isActive: true
    })
      .populate({
        path: 'client',
        select: 'phone role createdAt',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    res.status(200).json({
      success: true,
      coach: {
        ...coach.toObject(),
        monthlyFee: coachProfile?.monthlyFee || 0,
        currency: coachProfile?.currency || 'INR',
        specialization: coachProfile?.specialization || [],
        certification: coachProfile?.certification || [],
        rating: coachProfile?.rating || 0,
        totalSessions: coachProfile?.totalSessions || 0,
        totalClients: coachProfile?.totalClients || 0,
        isActive: coachProfile?.isActive !== false,
        activeSubscriptions,
        totalSessions,
        schedule,
        students: students.map(sub => ({
          subscriptionId: sub._id,
          startDate: sub.startDate,
          endDate: sub.endDate,
          student: sub.client
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching coach:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all students across all coaches
exports.getAllStudentsDetailed = async (req, res) => {
  try {
    const subscriptions = await UserSubscription.find({
      isActive: true
    })
      .populate({
        path: 'client',
        select: 'phone role createdAt',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      })
      .populate({
        path: 'coach',
        select: 'phone role',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    // Get Session model for calculating sessions
    const Session = require('../../Model/paidSessionModel/session');

    const students = await Promise.all(subscriptions.map(async (sub) => {
      // Calculate total sessions for this student
      const totalSessions = await Session.countDocuments({
        users: sub.client._id,
        status: { $in: ['completed', 'ongoing'] }
      });

      // Calculate total spent based on subscription duration and monthly fee
      const startDate = new Date(sub.startDate);
      const endDate = new Date(sub.endDate);
      const currentDate = new Date();
      
      // Calculate months between start and current date (or end date if subscription ended)
      const endDateForCalculation = currentDate > endDate ? endDate : currentDate;
      const monthsDiff = Math.max(0, (endDateForCalculation.getFullYear() - startDate.getFullYear()) * 12 + 
        (endDateForCalculation.getMonth() - startDate.getMonth()));
      
      // Calculate total spent (monthly fee * number of months)
      const totalSpent = sub.monthlyFee * Math.max(1, monthsDiff);

      return {
        subscriptionId: sub._id,
        startDate: sub.startDate,
        endDate: sub.endDate,
        student: sub.client,
        coach: sub.coach,
        totalSessions: totalSessions,
        totalSpent: totalSpent,
        monthlyFee: sub.monthlyFee,
        sessionsPerMonth: sub.sessionsPerMonth,
        sessionsUsed: sub.sessionsUsed,
        subscriptionType: sub.subscriptionType,
        paymentStatus: sub.paymentStatus,
        isActive: sub.isActive
      };
    }));

    res.status(200).json({
      success: true,
      count: students.length,
      students
    });
  } catch (error) {
    console.error('Error fetching all students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get comprehensive financial overview
exports.getFinancialOverview = async (req, res) => {
  try {
    const coaches = await User.find({ role: 'coach' })
      .populate('additionalInfo', 'name email');

    const financialData = [];

    for (const coach of coaches) {
      // Get active subscriptions
      const activeSubscriptions = await UserSubscription.countDocuments({
        coach: coach._id,
        isActive: true
      });

      // Get total sessions conducted
      const totalSessions = await Session.countDocuments({
        coach: coach._id
      });

      // Get this month's sessions
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const thisMonthSessions = await Session.countDocuments({
        coach: coach._id,
        date: { $gte: startOfMonth }
      });

      financialData.push({
        coachId: coach._id,
        coachName: coach.additionalInfo?.name || 'Unknown',
        coachEmail: coach.additionalInfo?.email || '',
        activeSubscriptions,
        totalSessions,
        thisMonthSessions,
        estimatedRevenue: activeSubscriptions * 1000 // Example: 1000 per subscription
      });
    }

    // Calculate totals
    const totalActiveSubscriptions = financialData.reduce((sum, item) => sum + item.activeSubscriptions, 0);
    const totalRevenue = financialData.reduce((sum, item) => sum + item.estimatedRevenue, 0);

    res.status(200).json({
      success: true,
      summary: {
        totalCoaches: coaches.length,
        totalActiveSubscriptions,
        totalEstimatedRevenue: totalRevenue
      },
      coachData: financialData
    });
  } catch (error) {
    console.error('Error fetching financial overview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get detailed financial data for a specific coach
exports.getCoachFinancialData = async (req, res) => {
  try {
    const { coachId } = req.params;

    // Validate coachId parameter
    if (!coachId || coachId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Coach ID is required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(coachId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Coach ID format'
      });
    }

    const coach = await User.findById(coachId)
      .where('role').equals('coach')
      .populate('additionalInfo', 'name email');

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Get all subscriptions for this coach
    const subscriptions = await UserSubscription.find({
      coach: coachId
    }).populate({
      path: 'client',
      select: 'phone',
      populate: {
        path: 'additionalInfo',
        select: 'name email'
      }
    });

    // Get all sessions for this coach
    const sessions = await Session.find({
      coach: coachId
    }).populate('users', 'phone additionalInfo');

    // Calculate monthly data for the last 6 months
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const startOfMonth = new Date();
      startOfMonth.setMonth(startOfMonth.getMonth() - i);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      const monthSubscriptions = subscriptions.filter(sub => 
        sub.startDate >= startOfMonth && sub.startDate <= endOfMonth
      );

      const monthSessions = sessions.filter(session => 
        session.date >= startOfMonth && session.date <= endOfMonth
      );

      monthlyData.push({
        month: startOfMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        newSubscriptions: monthSubscriptions.length,
        sessionsConducted: monthSessions.length,
        estimatedRevenue: monthSubscriptions.length * 1000
      });
    }

    res.status(200).json({
      success: true,
      coach: {
        id: coach._id,
        name: coach.additionalInfo?.name || 'Unknown',
        email: coach.additionalInfo?.email || ''
      },
      summary: {
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: subscriptions.filter(sub => sub.isActive).length,
        totalSessions: sessions.length,
        totalEstimatedRevenue: subscriptions.length * 1000
      },
      monthlyData
    });
  } catch (error) {
    console.error('Error fetching coach financial data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Force delete coach (Super Admin can delete even with active subscriptions)
exports.forceDeleteCoach = async (req, res) => {
  try {
    const { coachId } = req.params;

    const coach = await User.findById(coachId).where('role').equals('coach');
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Get active subscriptions count for warning
    const activeSubscriptions = await UserSubscription.countDocuments({
      coach: coachId,
      isActive: true
    });

    // Delete all subscriptions for this coach
    await UserSubscription.deleteMany({ coach: coachId });

    // Delete all sessions for this coach
    await Session.deleteMany({ coach: coachId });

    // Delete coach schedule
    await CoachSchedule.findOneAndDelete({ coach: coachId });

    // Delete additional info
    if (coach.additionalInfo) {
      await UserAdditionalInfo.findByIdAndDelete(coach.additionalInfo);
    }

    // Delete coach user
    await User.findByIdAndDelete(coachId);

    res.status(200).json({
      success: true,
      message: `Coach deleted successfully. ${activeSubscriptions} active subscriptions were also terminated.`,
      terminatedSubscriptions: activeSubscriptions
    });
  } catch (error) {
    console.error('Error force deleting coach:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get system overview (all users, coaches, students, revenue)
exports.getSystemOverview = async (req, res) => {
  try {
    // Get all users count by role
    const userCounts = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total active subscriptions
    const totalActiveSubscriptions = await UserSubscription.countDocuments({
      isActive: true
    });

    // Get total sessions
    const totalSessions = await Session.countDocuments();

    // Get total orders and revenue
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    // Get total products
    const totalProducts = await Product.countDocuments();

    // Get this month's stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthSubscriptions = await UserSubscription.countDocuments({
      startDate: { $gte: startOfMonth },
      isActive: true
    });

    const thisMonthSessions = await Session.countDocuments({
      date: { $gte: startOfMonth }
    });

    const thisMonthOrders = await Order.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    const thisMonthRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      overview: {
        users: userCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        subscriptions: {
          total: totalActiveSubscriptions,
          thisMonth: thisMonthSubscriptions
        },
        sessions: {
          total: totalSessions,
          thisMonth: thisMonthSessions
        },
        orders: {
          total: orderStats[0]?.totalOrders || 0,
          thisMonth: thisMonthOrders,
          totalRevenue: orderStats[0]?.totalRevenue || 0,
          thisMonthRevenue: thisMonthRevenue[0]?.totalRevenue || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching system overview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== SELLER FINANCIAL MANAGEMENT =====================

// Get all sellers with their financial data
exports.getAllSellersFinancial = async (req, res) => {
  try {
    const sellers = await User.find({ role: 'seller' })
      .populate('additionalInfo', 'name email');

    const sellersFinancialData = [];

    for (const seller of sellers) {
      // Get all products by this seller
      const products = await Product.find({ sellerId: seller._id });
      
      // Get all orders containing this seller's products
      const orders = await Order.find({
        'products.productId': { $in: products.map(p => p._id) }
      }).populate('products.productId');

      // Calculate total revenue for this seller
      let totalRevenue = 0;
      let totalOrders = 0;
      let totalProductsSold = 0;

      for (const order of orders) {
        for (const orderProduct of order.products) {
          const product = products.find(p => p._id.toString() === orderProduct.productId._id.toString());
          if (product && product.sellerId.toString() === seller._id.toString()) {
            totalRevenue += orderProduct.price * orderProduct.quantity;
            totalProductsSold += orderProduct.quantity;
          }
        }
        totalOrders++;
      }

      // Get this month's stats
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const thisMonthOrders = orders.filter(order => 
        order.createdAt >= startOfMonth
      );

      let thisMonthRevenue = 0;
      for (const order of thisMonthOrders) {
        for (const orderProduct of order.products) {
          const product = products.find(p => p._id.toString() === orderProduct.productId._id.toString());
          if (product && product.sellerId.toString() === seller._id.toString()) {
            thisMonthRevenue += orderProduct.price * orderProduct.quantity;
          }
        }
      }

      sellersFinancialData.push({
        sellerId: seller._id,
        sellerName: seller.additionalInfo?.name || 'Unknown',
        sellerEmail: seller.additionalInfo?.email || '',
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        totalOrders: totalOrders,
        totalProductsSold: totalProductsSold,
        totalRevenue: totalRevenue,
        thisMonthRevenue: thisMonthRevenue,
        thisMonthOrders: thisMonthOrders.length
      });
    }

    // Calculate totals
    const totalSellersRevenue = sellersFinancialData.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalSellersThisMonthRevenue = sellersFinancialData.reduce((sum, item) => sum + item.thisMonthRevenue, 0);

    res.status(200).json({
      success: true,
      summary: {
        totalSellers: sellers.length,
        totalSellersRevenue: totalSellersRevenue,
        totalSellersThisMonthRevenue: totalSellersThisMonthRevenue
      },
      sellersData: sellersFinancialData
    });
  } catch (error) {
    console.error('Error fetching sellers financial data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get detailed financial data for a specific seller
exports.getSellerFinancialData = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const seller = await User.findById(sellerId)
      .where('role').equals('seller')
      .populate('additionalInfo', 'name email');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Get all products by this seller
    const products = await Product.find({ sellerId: sellerId });

    // Get all orders containing this seller's products
    const orders = await Order.find({
      'products.productId': { $in: products.map(p => p._id) }
    }).populate('products.productId');

    // Calculate monthly data for the last 6 months
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const startOfMonth = new Date();
      startOfMonth.setMonth(startOfMonth.getMonth() - i);
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      const monthOrders = orders.filter(order => 
        order.createdAt >= startOfMonth && order.createdAt <= endOfMonth
      );

      let monthRevenue = 0;
      let monthProductsSold = 0;
      let monthOrdersCount = monthOrders.length;

      for (const order of monthOrders) {
        for (const orderProduct of order.products) {
          const product = products.find(p => p._id.toString() === orderProduct.productId._id.toString());
          if (product && product.sellerId.toString() === sellerId) {
            monthRevenue += orderProduct.price * orderProduct.quantity;
            monthProductsSold += orderProduct.quantity;
          }
        }
      }

      monthlyData.push({
        month: startOfMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        orders: monthOrdersCount,
        productsSold: monthProductsSold,
        revenue: monthRevenue
      });
    }

    // Get top selling products
    const productSales = {};
    for (const order of orders) {
      for (const orderProduct of order.products) {
        const product = products.find(p => p._id.toString() === orderProduct.productId._id.toString());
        if (product && product.sellerId.toString() === sellerId) {
          const productId = product._id.toString();
          if (!productSales[productId]) {
            productSales[productId] = {
              productId: product._id,
              productName: product.name,
              totalSold: 0,
              totalRevenue: 0
            };
          }
          productSales[productId].totalSold += orderProduct.quantity;
          productSales[productId].totalRevenue += orderProduct.price * orderProduct.quantity;
        }
      }
    }

    const topSellingProducts = Object.values(productSales)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    res.status(200).json({
      success: true,
      seller: {
        id: seller._id,
        name: seller.additionalInfo?.name || 'Unknown',
        email: seller.additionalInfo?.email || '',
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length
      },
      financialData: {
        totalOrders: orders.length,
        totalRevenue: monthlyData.reduce((sum, month) => sum + month.revenue, 0),
        totalProductsSold: monthlyData.reduce((sum, month) => sum + month.productsSold, 0),
        monthlyData,
        topSellingProducts
      }
    });
  } catch (error) {
    console.error('Error fetching seller financial data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get comprehensive financial overview (coaches + sellers)
exports.getComprehensiveFinancialOverview = async (req, res) => {
  try {
    // Get coaches financial data
    const coaches = await User.find({ role: 'coach' })
      .populate('additionalInfo', 'name email');

    let coachesRevenue = 0;
    const coachesData = [];

    for (const coach of coaches) {
      const activeSubscriptions = await UserSubscription.countDocuments({
        coach: coach._id,
        isActive: true
      });

      const estimatedRevenue = activeSubscriptions * 1000; // Adjust based on your pricing
      coachesRevenue += estimatedRevenue;

      coachesData.push({
        coachId: coach._id,
        coachName: coach.additionalInfo?.name || 'Unknown',
        activeSubscriptions,
        estimatedRevenue
      });
    }

    // Get sellers financial data
    const sellers = await User.find({ role: 'seller' })
      .populate('additionalInfo', 'name email');

    let sellersRevenue = 0;
    const sellersData = [];

    for (const seller of sellers) {
      const products = await Product.find({ sellerId: seller._id });
      const orders = await Order.find({
        'products.productId': { $in: products.map(p => p._id) }
      }).populate('products.productId');

      let sellerRevenue = 0;
      for (const order of orders) {
        for (const orderProduct of order.products) {
          const product = products.find(p => p._id.toString() === orderProduct.productId._id.toString());
          if (product && product.sellerId.toString() === seller._id.toString()) {
            sellerRevenue += orderProduct.price * orderProduct.quantity;
          }
        }
      }

      sellersRevenue += sellerRevenue;

      sellersData.push({
        sellerId: seller._id,
        sellerName: seller.additionalInfo?.name || 'Unknown',
        totalProducts: products.length,
        totalRevenue: sellerRevenue
      });
    }

    // Get this month's stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthCoachesRevenue = coachesData.reduce((sum, coach) => sum + coach.estimatedRevenue, 0);
    const thisMonthSellersRevenue = sellersData.reduce((sum, seller) => sum + seller.totalRevenue, 0);

    res.status(200).json({
      success: true,
      summary: {
        totalRevenue: coachesRevenue + sellersRevenue,
        coachesRevenue: coachesRevenue,
        sellersRevenue: sellersRevenue,
        thisMonthRevenue: thisMonthCoachesRevenue + thisMonthSellersRevenue
      },
      coachesData,
      sellersData
    });
  } catch (error) {
    console.error('Error fetching comprehensive financial overview:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get seller performance analytics
exports.getSellerPerformanceAnalytics = async (req, res) => {
  try {
    const sellers = await User.find({ role: 'seller' })
      .populate('additionalInfo', 'name email');

    const analytics = [];

    for (const seller of sellers) {
      const products = await Product.find({ sellerId: seller._id });
      const orders = await Order.find({
        'products.productId': { $in: products.map(p => p._id) }
      }).populate('products.productId');

      // Calculate performance metrics
      let totalRevenue = 0;
      let totalProductsSold = 0;
      let totalOrders = 0;

      for (const order of orders) {
        for (const orderProduct of order.products) {
          const product = products.find(p => p._id.toString() === orderProduct.productId._id.toString());
          if (product && product.sellerId.toString() === seller._id.toString()) {
            totalRevenue += orderProduct.price * orderProduct.quantity;
            totalProductsSold += orderProduct.quantity;
          }
        }
        totalOrders++;
      }

      // Calculate average order value
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate product performance
      const productPerformance = products.map(product => {
        const productOrders = orders.filter(order => 
          order.products.some(op => op.productId._id.toString() === product._id.toString())
        );

        let productRevenue = 0;
        let productQuantity = 0;

        for (const order of productOrders) {
          const orderProduct = order.products.find(op => 
            op.productId._id.toString() === product._id.toString()
          );
          if (orderProduct) {
            productRevenue += orderProduct.price * orderProduct.quantity;
            productQuantity += orderProduct.quantity;
          }
        }

        return {
          productId: product._id,
          productName: product.name,
          revenue: productRevenue,
          quantitySold: productQuantity,
          isActive: product.isActive
        };
      });

      analytics.push({
        sellerId: seller._id,
        sellerName: seller.additionalInfo?.name || 'Unknown',
        sellerEmail: seller.additionalInfo?.email || '',
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        totalOrders: totalOrders,
        totalProductsSold: totalProductsSold,
        totalRevenue: totalRevenue,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        productPerformance: productPerformance.sort((a, b) => b.revenue - a.revenue)
      });
    }

    res.status(200).json({
      success: true,
      analytics: analytics.sort((a, b) => b.totalRevenue - a.totalRevenue)
    });
  } catch (error) {
    console.error('Error fetching seller performance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== SUPER ADMIN SELLER MANAGEMENT =====================

// Get all sellers with detailed information
exports.getAllSellers = async (req, res) => {
  try {
    console.log('getAllSellers called');
    
    const sellers = await User.find({ role: 'seller' })
      .populate('additionalInfo', 'name email')
      .select('phone role createdAt additionalInfo');

    console.log('Found sellers:', sellers.length);
    console.log('Sellers data:', sellers);

    const sellersWithDetails = [];

    for (const seller of sellers) {
      // Get seller's products
      const products = await Product.find({ sellerId: seller._id });
      
      // Get seller's orders
      const orders = await Order.find({
        'products.productId': { $in: products.map(p => p._id) }
      });

      // Calculate total revenue
      let totalRevenue = 0;
      let totalOrders = 0;

      for (const order of orders) {
        for (const orderProduct of order.products) {
          const product = products.find(p => p._id.toString() === orderProduct.productId.toString());
          if (product && product.sellerId.toString() === seller._id.toString()) {
            totalRevenue += orderProduct.price * orderProduct.quantity;
          }
        }
        totalOrders++;
      }

      sellersWithDetails.push({
        _id: seller._id,
        name: seller.additionalInfo?.name || 'Unknown',
        email: seller.additionalInfo?.email || '',
        phone: seller.phone,
        role: seller.role,
        createdAt: seller.createdAt,
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        totalOrders: totalOrders,
        totalRevenue: totalRevenue,
        status: seller.isActive ? 'active' : 'inactive'
      });
    }

    const finalSellers = sellersWithDetails.sort((a, b) => b.totalRevenue - a.totalRevenue);
    console.log('Final sellers response:', finalSellers);
    
    res.status(200).json({
      success: true,
      sellers: finalSellers
    });
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get detailed information for a specific seller
exports.getSellerDetailed = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const seller = await User.findById(sellerId)
      .where('role').equals('seller')
      .populate('additionalInfo', 'name email');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Get seller's products
    const products = await Product.find({ sellerId: sellerId });
    
    // Get seller's orders
    const orders = await Order.find({
      'products.productId': { $in: products.map(p => p._id) }
    }).populate('products.productId');

    // Calculate detailed metrics
    let totalRevenue = 0;
    let totalProductsSold = 0;
    let monthlyRevenue = {};
    let productPerformance = [];

    for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey] = 0;
      }

      for (const orderProduct of order.products) {
        const product = products.find(p => p._id.toString() === orderProduct.productId._id.toString());
        if (product && product.sellerId.toString() === sellerId) {
          const revenue = orderProduct.price * orderProduct.quantity;
          totalRevenue += revenue;
          totalProductsSold += orderProduct.quantity;
          monthlyRevenue[monthKey] += revenue;
        }
      }
    }

    // Calculate product performance
    for (const product of products) {
      const productOrders = orders.filter(order => 
        order.products.some(op => op.productId._id.toString() === product._id.toString())
      );

      let productRevenue = 0;
      let productQuantity = 0;

      for (const order of productOrders) {
        const orderProduct = order.products.find(op => 
          op.productId._id.toString() === product._id.toString()
        );
        if (orderProduct) {
          productRevenue += orderProduct.price * orderProduct.quantity;
          productQuantity += orderProduct.quantity;
        }
      }

      productPerformance.push({
        productId: product._id,
        productName: product.name,
        productPrice: product.price,
        revenue: productRevenue,
        quantitySold: productQuantity,
        isActive: product.isActive,
        createdAt: product.createdAt
      });
    }

    res.status(200).json({
      success: true,
      seller: {
        _id: seller._id,
        name: seller.additionalInfo?.name || 'Unknown',
        email: seller.additionalInfo?.email || '',
        phone: seller.phone,
        role: seller.role,
        createdAt: seller.createdAt,
        isActive: seller.isActive
      },
      metrics: {
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        totalOrders: orders.length,
        totalProductsSold: totalProductsSold,
        totalRevenue: totalRevenue,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0
      },
      monthlyRevenue: Object.entries(monthlyRevenue).map(([month, revenue]) => ({
        month,
        revenue
      })).sort((a, b) => b.month.localeCompare(a.month)),
      productPerformance: productPerformance.sort((a, b) => b.revenue - a.revenue)
    });
  } catch (error) {
    console.error('Error fetching seller details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete a seller
exports.deleteSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;

    const seller = await User.findById(sellerId).where('role').equals('seller');
    
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Check if seller has active products
    const activeProducts = await Product.find({ 
      sellerId: sellerId, 
      isActive: true 
    });

    if (activeProducts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete seller with active products. Please deactivate products first.'
      });
    }

    // Delete seller's products
    await Product.deleteMany({ sellerId: sellerId });
    
    // Delete seller's additional info
    await UserAdditionalInfo.findOneAndDelete({ userId: sellerId });
    
    // Delete the seller
    await User.findByIdAndDelete(sellerId);

    res.status(200).json({
      success: true,
      message: 'Seller deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting seller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update seller information
exports.updateSeller = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { name, email, phone, isActive } = req.body;

    // Check if seller exists
    const seller = await User.findById(sellerId).where('role').equals('seller');
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Update user phone if provided
    if (phone && phone !== seller.phone) {
      // Check if phone already exists
      const existingUser = await User.findOne({ phone, _id: { $ne: sellerId } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered'
        });
      }
      seller.phone = phone;
    }

    // Update user active status if provided
    if (isActive !== undefined) {
      seller.isActive = isActive;
    }

    await seller.save();

    // Update additional info if provided
    if (seller.additionalInfo) {
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;

      if (Object.keys(updateData).length > 0) {
        await UserAdditionalInfo.findByIdAndUpdate(seller.additionalInfo, updateData);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Seller updated successfully'
    });
  } catch (error) {
    console.error('Error updating seller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== SUPER ADMIN COACH SCHEDULE SALE MANAGEMENT =====================

// Create a new coach schedule sale
exports.createCoachScheduleSale = async (req, res) => {
  try {
    const {
      coachId,
      title,
      description,
      sessionType,
      price,
      duration,
      maxParticipants,
      schedule,
      category,
      difficulty
    } = req.body;

    // Validate coach exists and is a coach
    const coach = await User.findById(coachId).where('role').equals('coach');
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    const scheduleSale = new CoachSchedule({
      coach: coachId,
      title,
      description,
      sessionType,
      price,
      duration,
      maxParticipants,
      days: schedule.days,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      category,
      difficulty,
      createdBy: req.user.id
    });

    await scheduleSale.save();

    res.status(201).json({
      success: true,
      message: 'Coach schedule sale created successfully',
      scheduleSale
    });
  } catch (error) {
    console.error('Error creating coach schedule sale:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all coach schedule sales
exports.getAllCoachScheduleSales = async (req, res) => {
  try {
    const scheduleSales = await CoachSchedule.find({ title: { $ne: 'Coaching Session' } })
      .populate({
        path: 'coach',
        select: 'phone',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      })
      .populate({
        path: 'createdBy',
        select: 'phone',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    const formattedSales = scheduleSales.map(sale => ({
      _id: sale._id,
      title: sale.title,
      description: sale.description,
      sessionType: sale.sessionType,
      price: sale.price,
      duration: sale.duration,
      maxParticipants: sale.maxParticipants,
      schedule: sale.schedule,
      category: sale.category,
      difficulty: sale.difficulty,
      isActive: sale.isActive,
      totalBookings: sale.totalBookings,
      totalRevenue: sale.totalRevenue,
      coach: {
        _id: sale.coach._id,
        name: sale.coach.additionalInfo?.name || 'Unknown',
        email: sale.coach.additionalInfo?.email || '',
        phone: sale.coach.phone
      },
      createdBy: {
        _id: sale.createdBy._id,
        name: sale.createdBy.additionalInfo?.name || 'Unknown',
        email: sale.createdBy.additionalInfo?.email || ''
      },
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt
    }));

    res.status(200).json({
      success: true,
      scheduleSales: formattedSales
    });
  } catch (error) {
    console.error('Error fetching coach schedule sales:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get specific coach schedule sale
exports.getCoachScheduleSale = async (req, res) => {
  try {
    const { saleId } = req.params;

    const scheduleSale = await CoachSchedule.findById(saleId)
      .populate({
        path: 'coach',
        select: 'phone',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      })
      .populate({
        path: 'createdBy',
        select: 'phone',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    if (!scheduleSale) {
      return res.status(404).json({
        success: false,
        message: 'Coach schedule sale not found'
      });
    }

    res.status(200).json({
      success: true,
      scheduleSale
    });
  } catch (error) {
    console.error('Error fetching coach schedule sale:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update coach schedule sale
exports.updateCoachScheduleSale = async (req, res) => {
  try {
    const { saleId } = req.params;
    const updateData = req.body;

    const scheduleSale = await CoachSchedule.findByIdAndUpdate(
      saleId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!scheduleSale) {
      return res.status(404).json({
        success: false,
        message: 'Coach schedule sale not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coach schedule sale updated successfully',
      scheduleSale
    });
  } catch (error) {
    console.error('Error updating coach schedule sale:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete coach schedule sale
exports.deleteCoachScheduleSale = async (req, res) => {
  try {
    const { saleId } = req.params;

    const scheduleSale = await CoachSchedule.findByIdAndDelete(saleId);

    if (!scheduleSale) {
      return res.status(404).json({
        success: false,
        message: 'Coach schedule sale not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coach schedule sale deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting coach schedule sale:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get coach schedule sales analytics
exports.getCoachScheduleSalesAnalytics = async (req, res) => {
  try {
    const totalSales = await CoachSchedule.countDocuments({ title: { $ne: 'Coaching Session' } });
    const activeSales = await CoachSchedule.countDocuments({ title: { $ne: 'Coaching Session' }, isActive: true });
    const totalRevenue = await CoachSchedule.aggregate([
      { $match: { title: { $ne: 'Coaching Session' } } },
      { $group: { _id: null, total: { $sum: '$totalRevenue' } } }
    ]);

    const salesByCategory = await CoachSchedule.aggregate([
      { $match: { title: { $ne: 'Coaching Session' } } },
      { $group: { _id: '$category', count: { $sum: 1 }, revenue: { $sum: '$totalRevenue' } } }
    ]);

    const salesByCoach = await CoachSchedule.aggregate([
      { $match: { title: { $ne: 'Coaching Session' } } },
      { $lookup: { from: 'users', localField: 'coach', foreignField: '_id', as: 'coachInfo' } },
      { $unwind: '$coachInfo' },
      { $lookup: { from: 'useradditionalinfos', localField: 'coachInfo.additionalInfo', foreignField: '_id', as: 'additionalInfo' } },
      { $unwind: '$additionalInfo' },
      { $group: { 
        _id: '$coach', 
        coachName: { $first: '$additionalInfo.name' },
        count: { $sum: 1 }, 
        revenue: { $sum: '$totalRevenue' },
        bookings: { $sum: '$totalBookings' }
      }}
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        totalSales,
        activeSales,
        totalRevenue: totalRevenue[0]?.total || 0,
        salesByCategory,
        salesByCoach
      }
    });
  } catch (error) {
    console.error('Error fetching coach schedule sales analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== COACH FEE MANAGEMENT =====================

const CoachProfile = require('../../Model/paidSessionModel/coach');

// Update coach monthly fee
exports.updateCoachFee = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { monthlyFee, currency = 'INR' } = req.body;

    // Validate coachId
    if (!coachId) {
      return res.status(400).json({
        success: false,
        message: 'Coach ID is required'
      });
    }

    // Validate monthlyFee
    if (monthlyFee === undefined || monthlyFee === null) {
      return res.status(400).json({
        success: false,
        message: 'Monthly fee is required'
      });
    }

    if (typeof monthlyFee !== 'number' || monthlyFee < 0) {
      return res.status(400).json({
        success: false,
        message: 'Monthly fee must be a positive number'
      });
    }

    // Validate currency
    if (!['INR', 'USD', 'EUR'].includes(currency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid currency. Must be INR, USD, or EUR'
      });
    }

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Update or create coach profile
    const coachProfile = await CoachProfile.findOneAndUpdate(
      { user: coachId },
      {
        monthlyFee,
        currency,
        feeUpdatedBy: req.user.id,
        feeUpdatedAt: new Date()
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Coach fee updated successfully',
      coachProfile: {
        coachId,
        monthlyFee: coachProfile.monthlyFee,
        currency: coachProfile.currency,
        feeUpdatedAt: coachProfile.feeUpdatedAt
      }
    });
  } catch (error) {
    console.error('Error updating coach fee:', error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid coach ID format',
        error: 'Please provide a valid coach ID'
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating coach fee',
      error: error.message
    });
  }
};

// Get coach fee
exports.getCoachFee = async (req, res) => {
  try {
    const { coachId } = req.params;

    const coachProfile = await CoachProfile.findOne({ user: coachId });
    
    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    res.status(200).json({
      success: true,
      coachFee: {
        coachId,
        monthlyFee: coachProfile.monthlyFee,
        currency: coachProfile.currency,
        feeUpdatedAt: coachProfile.feeUpdatedAt,
        feeUpdatedBy: coachProfile.feeUpdatedBy
      }
    });
  } catch (error) {
    console.error('Error fetching coach fee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all coaches with their fees
exports.getAllCoachesWithFees = async (req, res) => {
  try {
    // Validate that CoachProfile model is available
    if (!CoachProfile) {
      console.error('CoachProfile model not found');
      return res.status(500).json({
        success: false,
        message: 'Internal server error: Model not available'
      });
    }

    const coaches = await User.find({ role: 'coach' })
      .populate('additionalInfo', 'name email')
      .select('-password');

    if (!coaches) {
      return res.status(200).json({
        success: true,
        count: 0,
        coaches: []
      });
    }

    const coachesWithFees = await Promise.all(
      coaches.map(async (coach) => {
        try {
          const coachProfile = await CoachProfile.findOne({ user: coach._id });
          return {
            id: coach._id,
            name: coach.additionalInfo?.name || 'Unknown',
            email: coach.additionalInfo?.email || '',
            phone: coach.phone || '',
            role: coach.role,
            monthlyFee: coachProfile?.monthlyFee || 0,
            currency: coachProfile?.currency || 'INR',
            feeUpdatedAt: coachProfile?.feeUpdatedAt,
            isActive: coachProfile?.isActive !== false
          };
        } catch (profileError) {
          console.error(`Error fetching profile for coach ${coach._id}:`, profileError);
          // Return coach data without profile if there's an error
          return {
            id: coach._id,
            name: coach.additionalInfo?.name || 'Unknown',
            email: coach.additionalInfo?.email || '',
            phone: coach.phone || '',
            role: coach.role,
            monthlyFee: 0,
            currency: 'INR',
            feeUpdatedAt: null,
            isActive: true
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      count: coachesWithFees.length,
      coaches: coachesWithFees
    });
  } catch (error) {
    console.error('Error fetching coaches with fees:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching coaches with fees',
      error: error.message
    });
  }
};

// Bulk update coach fees
exports.bulkUpdateCoachFees = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { coachId, monthlyFee, currency }

    // Validate input
    if (!updates) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates must be an array'
      });
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array must not be empty'
      });
    }

    // Validate each update object
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      if (!update.coachId) {
        return res.status(400).json({
          success: false,
          message: `Update at index ${i} is missing coachId`
        });
      }
      if (typeof update.monthlyFee !== 'number' || update.monthlyFee < 0) {
        return res.status(400).json({
          success: false,
          message: `Update at index ${i} has invalid monthlyFee: ${update.monthlyFee}`
        });
      }
    }

    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const results = [];

    for (const update of updates) {
      const { coachId, monthlyFee, currency = 'INR' } = update;

      try {
        // Validate coach exists
        const coachUser = await User.findById(coachId).where('role').equals('coach');
        if (!coachUser) {
          results.push({
            coachId,
            success: false,
            message: 'Coach not found'
          });
          continue;
        }

        // Update coach profile
        const coachProfile = await CoachProfile.findOneAndUpdate(
          { user: coachId },
          {
            monthlyFee,
            currency,
            feeUpdatedBy: req.user.id,
            feeUpdatedAt: new Date()
          },
          { new: true, upsert: true }
        );

        results.push({
          coachId,
          success: true,
          message: 'Fee updated successfully',
          monthlyFee: coachProfile.monthlyFee,
          currency: coachProfile.currency
        });
      } catch (error) {
        console.error(`Error updating fee for coach ${coachId}:`, error);
        results.push({
          coachId,
          success: false,
          message: 'Error updating fee',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.status(200).json({
      success: true,
      message: `Bulk update completed. ${successCount} successful, ${failureCount} failed`,
      results
    });
  } catch (error) {
    console.error('Error in bulk update coach fees:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== SUPER ADMIN COACH PROFILE MANAGEMENT =====================

// Create coach profile
exports.createCoachProfile = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { monthlyFee = 5000, currency = 'INR', experience, bio, specialization } = req.body;

    console.log('Backend - Received request body:', req.body);
    console.log('Backend - Specialization from request:', specialization);
    console.log('Backend - Specialization type:', typeof specialization);
    console.log('Backend - Is specialization array:', Array.isArray(specialization));

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Check if profile already exists
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const existingProfile = await CoachProfile.findOne({ user: coachId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Coach profile already exists'
      });
    }

    // Create new coach profile
    const profileData = {
      user: coachId,
      monthlyFee,
      currency,
      feeUpdatedBy: req.user.id,
      feeUpdatedAt: new Date(),
      experience: experience || 0,
      bio: bio || '',
      specialization: specialization || []
    };

    console.log('Backend - Profile data being sent to model:', profileData);
    console.log('Backend - Specialization in profileData:', profileData.specialization);

    const coachProfile = await CoachProfile.create(profileData);

    res.status(201).json({
      success: true,
      message: 'Coach profile created successfully',
      coachProfile: {
        coachId,
        monthlyFee: coachProfile.monthlyFee,
        currency: coachProfile.currency,
        experience: coachProfile.experience,
        bio: coachProfile.bio,
        specialization: coachProfile.specialization,
        feeUpdatedAt: coachProfile.feeUpdatedAt
      }
    });
  } catch (error) {
    console.error('Error creating coach profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update coach profile
exports.updateCoachProfile = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { monthlyFee, currency, experience, bio, specialization, isActive, rating } = req.body;

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Find and update coach profile
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const updateData = {};
    if (monthlyFee !== undefined) {
      updateData.monthlyFee = monthlyFee;
      updateData.feeUpdatedBy = req.user.id;
      updateData.feeUpdatedAt = new Date();
    }
    if (currency) updateData.currency = currency;
    if (experience !== undefined) updateData.experience = experience;
    if (bio !== undefined) updateData.bio = bio;
    if (specialization) updateData.specialization = specialization;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (rating !== undefined) updateData.rating = rating;

    const coachProfile = await CoachProfile.findOneAndUpdate(
      { user: coachId },
      updateData,
      { new: true }
    );

    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coach profile updated successfully',
      coachProfile: {
        coachId,
        monthlyFee: coachProfile.monthlyFee,
        currency: coachProfile.currency,
        experience: coachProfile.experience,
        bio: coachProfile.bio,
        specialization: coachProfile.specialization,
        isActive: coachProfile.isActive,
        rating: coachProfile.rating,
        feeUpdatedAt: coachProfile.feeUpdatedAt
      }
    });
  } catch (error) {
    console.error('Error updating coach profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get coach profile
exports.getCoachProfile = async (req, res) => {
  try {
    const { coachId } = req.params;

    // Check if coach exists
    const coachUser = await User.findById(coachId)
      .where('role').equals('coach')
      .populate('additionalInfo', 'name email');

    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Get coach profile
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const coachProfile = await CoachProfile.findOne({ user: coachId });

    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    // Get additional statistics
    const activeSubscriptions = await UserSubscription.countDocuments({
      coach: coachId,
      isActive: true
    });

    const totalSessions = await Session.countDocuments({
      coach: coachId
    });

    res.status(200).json({
      success: true,
      coachProfile: {
        coachId,
        coachName: coachUser.additionalInfo?.name || 'Unknown',
        coachEmail: coachUser.additionalInfo?.email || '',
        monthlyFee: coachProfile.monthlyFee,
        currency: coachProfile.currency,
        experience: coachProfile.experience,
        bio: coachProfile.bio,
        specialization: coachProfile.specialization,
        isActive: coachProfile.isActive,
        rating: coachProfile.rating,
        totalSessions: coachProfile.totalSessions,
        totalClients: coachProfile.totalClients,
        activeSubscriptions,
        totalSessionsConducted: totalSessions,
        feeUpdatedAt: coachProfile.feeUpdatedAt,
        createdAt: coachProfile.createdAt,
        updatedAt: coachProfile.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching coach profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete coach profile
exports.deleteCoachProfile = async (req, res) => {
  try {
    const { coachId } = req.params;

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Check if coach has active subscriptions
    const activeSubscriptions = await UserSubscription.countDocuments({
      coach: coachId,
      isActive: true
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete coach profile with ${activeSubscriptions} active subscriptions`
      });
    }

    // Delete coach profile
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const deletedProfile = await CoachProfile.findOneAndDelete({ user: coachId });

    if (!deletedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coach profile deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting coach profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all coach profiles with detailed information
exports.getAllCoachProfiles = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, specialization } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (specialization) filter.specialization = { $in: [specialization] };

    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const coachProfiles = await CoachProfile.find(filter)
      .populate({
        path: 'user',
        select: 'phone role createdAt',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await CoachProfile.countDocuments(filter);

    // Get additional statistics for each coach
    const profilesWithStats = await Promise.all(
      coachProfiles.map(async (profile) => {
        const activeSubscriptions = await UserSubscription.countDocuments({
          coach: profile.user._id,
          isActive: true
        });

        const totalSessions = await Session.countDocuments({
          coach: profile.user._id
        });

        return {
          id: profile._id,
          coachId: profile.user._id,
          coachName: profile.user.additionalInfo?.name || 'Unknown',
          coachEmail: profile.user.additionalInfo?.email || '',
          phone: profile.user.phone,
          monthlyFee: profile.monthlyFee,
          currency: profile.currency,
          experience: profile.experience,
          bio: profile.bio,
          specialization: profile.specialization,
          isActive: profile.isActive,
          rating: profile.rating,
          totalSessions: profile.totalSessions,
          totalClients: profile.totalClients,
          activeSubscriptions,
          totalSessionsConducted: totalSessions,
          feeUpdatedAt: profile.feeUpdatedAt,
          createdAt: profile.createdAt
        };
      })
    );

    res.status(200).json({
      success: true,
      count: profilesWithStats.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      coachProfiles: profilesWithStats
    });
  } catch (error) {
    console.error('Error fetching coach profiles:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== SUPER ADMIN COACH CERTIFICATION MANAGEMENT =====================

// Add coach certification
exports.addCoachCertification = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { name, issuingBody, year, expiryDate } = req.body;

    // Validation
    if (!name || !issuingBody || !year) {
      return res.status(400).json({
        success: false,
        message: 'Certification name, issuing body, and year are required'
      });
    }

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Find coach profile and add certification
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const coachProfile = await CoachProfile.findOne({ user: coachId });
    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    const newCertification = {
      name,
      issuingBody,
      year: parseInt(year),
      expiryDate: expiryDate ? new Date(expiryDate) : undefined
    };

    coachProfile.certification.push(newCertification);
    await coachProfile.save();

    res.status(200).json({
      success: true,
      message: 'Certification added successfully',
      certification: newCertification
    });
  } catch (error) {
    console.error('Error adding coach certification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Remove coach certification
exports.removeCoachCertification = async (req, res) => {
  try {
    const { coachId, certificationId } = req.params;

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Find coach profile and remove certification
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const coachProfile = await CoachProfile.findOne({ user: coachId });
    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    // Remove certification by index (assuming certificationId is the index)
    const certIndex = parseInt(certificationId);
    if (certIndex < 0 || certIndex >= coachProfile.certification.length) {
      return res.status(404).json({
        success: false,
        message: 'Certification not found'
      });
    }

    const removedCert = coachProfile.certification.splice(certIndex, 1)[0];
    await coachProfile.save();

    res.status(200).json({
      success: true,
      message: 'Certification removed successfully',
      removedCertification: removedCert
    });
  } catch (error) {
    console.error('Error removing coach certification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== SUPER ADMIN COACH RATING & STATISTICS =====================

// Update coach rating
exports.updateCoachRating = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { rating } = req.body;

    // Validation
    if (rating === undefined || rating < 0 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 0 and 5'
      });
    }

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Update coach rating
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const coachProfile = await CoachProfile.findOneAndUpdate(
      { user: coachId },
      { rating: parseFloat(rating) },
      { new: true }
    );

    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coach rating updated successfully',
      rating: coachProfile.rating
    });
  } catch (error) {
    console.error('Error updating coach rating:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update coach statistics
exports.updateCoachStatistics = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { totalSessions, totalClients } = req.body;

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Update coach statistics
    const updateData = {};
    if (totalSessions !== undefined) updateData.totalSessions = parseInt(totalSessions);
    if (totalClients !== undefined) updateData.totalClients = parseInt(totalClients);

    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const coachProfile = await CoachProfile.findOneAndUpdate(
      { user: coachId },
      updateData,
      { new: true }
    );

    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Coach statistics updated successfully',
      statistics: {
        totalSessions: coachProfile.totalSessions,
        totalClients: coachProfile.totalClients
      }
    });
  } catch (error) {
    console.error('Error updating coach statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Toggle coach active status
exports.toggleCoachStatus = async (req, res) => {
  try {
    const { coachId } = req.params;

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Get current status and toggle
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const coachProfile = await CoachProfile.findOne({ user: coachId });
    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    const newStatus = !coachProfile.isActive;
    coachProfile.isActive = newStatus;
    await coachProfile.save();

    res.status(200).json({
      success: true,
      message: `Coach ${newStatus ? 'activated' : 'deactivated'} successfully`,
      isActive: newStatus
    });
  } catch (error) {
    console.error('Error toggling coach status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};