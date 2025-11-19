const User = require('../../Model/userModel/userModel');
const UserAdditionalInfo = require('../../Model/userModel/additionalInfo');
const UserSubscription = require('../../Model/paidSessionModel/userSubscription');
const CoachSchedule = require('../../Model/paidSessionModel/coachSchedule');
const Session = require('../../Model/paidSessionModel/session');
const bcrypt = require('bcryptjs');
const { createCoachValidation, updateCoachValidation, coachScheduleValidation } = require('../../validator/coachManagerValidation');
const CoachProfile = require('../../Model/paidSessionModel/coach');
// ===================== COACH MANAGEMENT =====================

// Create a new coach
exports.createCoach = async (req, res) => {
  try {
    const { name, phone, email, password, experience, bio, monthlyFee = 5000, currency = 'INR' } = req.body;

    // Validation
    const { error } = createCoachValidation({ name, phone, email, password, experience, bio });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message),
      });
    }

    // Check if phone already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Check if email already exists
    const existingEmail = await UserAdditionalInfo.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with coach role
    const user = new User({
      phone,
      password: hashedPassword,
      role: 'coach'
    });
    await user.save();

    // Create additional info
    const additionalInfo = new UserAdditionalInfo({
      name,
      email,
      userId: user._id,
      experience: experience || '',
      bio: bio || ''
    });
    await additionalInfo.save();

    // Link additional info to user
    user.additionalInfo = additionalInfo._id;
    await user.save();

    // Create CoachProfile with default monthly fee
    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const coachProfile = await CoachProfile.create({
      user: user._id,
      monthlyFee: monthlyFee, // Use monthlyFee parameter
      currency,
      feeUpdatedBy: req.user.id,
      feeUpdatedAt: new Date(),
      experience: experience || 0,
      bio: bio || ''
    });

    res.status(201).json({
      success: true,
      message: 'Coach created successfully',
      coach: {
        id: user._id,
        name,
        email,
        phone,
        role: user.role,
        experience,
        bio,
        monthlyFee: coachProfile.monthlyFee,
        currency: coachProfile.currency
      }
    });
  } catch (error) {
    console.error('Error creating coach:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all coaches
exports.getAllCoaches = async (req, res) => {
  try {
    console.log('getAllCoaches called');
    const coaches = await User.find({ role: 'coach' })
      .populate('additionalInfo', 'name email')
      .select('-password');

    console.log('Found coaches:', coaches.length);
    console.log('First coach:', coaches[0]);

    res.status(200).json({
      success: true,
      count: coaches.length,
      coaches
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

// Get coach by ID with detailed info
exports.getCoachById = async (req, res) => {
  try {
    const { coachId } = req.params;

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

    // Get coach schedule
    const schedule = await CoachSchedule.findOne({ coach: coachId });

    // Get active subscriptions count
    const activeSubscriptions = await UserSubscription.countDocuments({
      coach: coachId,
      isActive: true
    });

    res.status(200).json({
      success: true,
      coach: {
        ...coach.toObject(),
        schedule,
        activeSubscriptions
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

// Update coach information
exports.updateCoach = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { name, email, experience, bio } = req.body;

    // Validation
    const { error } = updateCoachValidation({ name, email, experience, bio });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message),
      });
    }

    const coach = await User.findById(coachId).where('role').equals('coach');
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Update additional info
    if (coach.additionalInfo) {
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (experience !== undefined) updateData.experience = experience;
      if (bio !== undefined) updateData.bio = bio;

      await UserAdditionalInfo.findByIdAndUpdate(coach.additionalInfo, updateData);
    }

    res.status(200).json({
      success: true,
      message: 'Coach updated successfully'
    });
  } catch (error) {
    console.error('Error updating coach:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete coach
exports.deleteCoach = async (req, res) => {
  try {
    const { coachId } = req.params;

    const coach = await User.findById(coachId).where('role').equals('coach');
    if (!coach) {
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
        message: `Cannot delete coach with ${activeSubscriptions} active subscriptions`
      });
    }

    // Delete additional info
    if (coach.additionalInfo) {
      await UserAdditionalInfo.findByIdAndDelete(coach.additionalInfo);
    }

    // Delete coach schedule
    await CoachSchedule.findOneAndDelete({ coach: coachId });

    // Delete coach user
    await User.findByIdAndDelete(coachId);

    res.status(200).json({
      success: true,
      message: 'Coach deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting coach:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== STUDENT MANAGEMENT =====================

// Get all students for a specific coach
exports.getCoachStudents = async (req, res) => {
  try {
    const { coachId } = req.params;

    const coach = await User.findById(coachId).where('role').equals('coach');
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Get current date for expiration check
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    
    const subscriptions = await UserSubscription.find({
      coach: coachId,
      isActive: true,
      endDate: { $gte: today } // Only include subscriptions that haven't expired yet
    })
      .populate({
        path: 'client',
        select: 'phone role createdAt',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    const students = subscriptions.map(sub => ({
      subscriptionId: sub._id,
      startDate: sub.startDate,
      endDate: sub.endDate,
      student: sub.client
    }));

    res.status(200).json({
      success: true,
      count: students.length,
      students
    });
  } catch (error) {
    console.error('Error fetching coach students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all students across all coaches
exports.getAllStudents = async (req, res) => {
  try {
    console.log('Getting all students...');
    
    // First check total subscriptions count
    const totalSubscriptions = await UserSubscription.countDocuments();
    console.log('Total subscriptions in database:', totalSubscriptions);
    
    const activeSubscriptions = await UserSubscription.countDocuments({ isActive: true });
    console.log('Active subscriptions in database:', activeSubscriptions);
    
    // Get current date for expiration check
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    console.log('Current date for expiration check:', today.toISOString());
    
    // Check for expired but still active subscriptions
    const expiredButActive = await UserSubscription.countDocuments({
      isActive: true,
      endDate: { $lt: today }
    });
    console.log('Expired but still active subscriptions:', expiredButActive);
    
    const subscriptions = await UserSubscription.find({
      isActive: true,
      endDate: { $gte: today } // Only include subscriptions that haven't expired yet
    })
      .populate({
        path: 'client',
        select: 'phone role createdAt additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email userId'
        }
      })
      .populate({
        path: 'coach',
        select: 'phone role additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email userId'
        }
      });

    console.log('Found subscriptions:', subscriptions.length);
    console.log('Raw subscriptions:', JSON.stringify(subscriptions, null, 2));
    
    // Debug each subscription individually
    subscriptions.forEach((sub, index) => {
      console.log(`\n--- Subscription ${index + 1} ---`);
      console.log('Subscription ID:', sub._id);
      console.log('Client (student):', sub.client);
      console.log('Coach:', sub.coach);
      console.log('Client additionalInfo:', sub.client?.additionalInfo);
      console.log('Coach additionalInfo:', sub.coach?.additionalInfo);
      
      // Check if additionalInfo exists
      if (sub.client && !sub.client.additionalInfo) {
        console.log('WARNING: Client has no additionalInfo populated');
      }
      if (sub.coach && !sub.coach.additionalInfo) {
        console.log('WARNING: Coach has no additionalInfo populated');
      }
    });

    // If no active subscriptions found, try to get all subscriptions for debugging
    let allSubscriptions = [];
    if (subscriptions.length === 0) {
      console.log('No active subscriptions found, checking all subscriptions...');
      allSubscriptions = await UserSubscription.find({})
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
      console.log('All subscriptions found:', allSubscriptions.length);
      console.log('All subscriptions data:', JSON.stringify(allSubscriptions, null, 2));
    }

    const students = subscriptions.map(sub => ({
      subscriptionId: sub._id,
      startDate: sub.startDate,
      endDate: sub.endDate,
      student: sub.client,
      coach: sub.coach
    }));

    console.log('Processed students:', students.length);
    console.log('Processed students data:', JSON.stringify(students, null, 2));

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

// Get inactive/expired subscriptions for analysis
exports.getInactiveSubscriptions = async (req, res) => {
  try {
    console.log('Getting inactive subscriptions for analysis...');
    
    // Get current date for expiration check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Current date for expiration check:', today.toISOString());
    
    // Get inactive subscriptions (either isActive: false OR expired by date)
    const inactiveSubscriptions = await UserSubscription.find({
      $or: [
        { isActive: false }, // Explicitly inactive
        { 
          isActive: true, 
          endDate: { $lt: today } // Expired but still marked as active
        }
      ]
    })
      .populate({
        path: 'client',
        select: 'phone role createdAt additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email userId'
        }
      })
      .populate({
        path: 'coach',
        select: 'phone role additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email userId'
        }
      })
      .sort({ endDate: -1 }); // Sort by end date, most recent first

    console.log('Found inactive subscriptions:', inactiveSubscriptions.length);
    
    // Process the data for analysis
    const processedSubscriptions = inactiveSubscriptions.map(sub => {
      const endDate = new Date(sub.endDate);
      const isExpired = endDate < today;
      const daysSinceExpiry = isExpired ? Math.floor((today - endDate) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        subscriptionId: sub._id,
        student: {
          id: sub.client?._id,
          name: sub.client?.additionalInfo?.name || 'N/A',
          email: sub.client?.additionalInfo?.email || 'N/A',
          phone: sub.client?.phone || 'N/A',
          joinedDate: sub.client?.createdAt
        },
        coach: {
          id: sub.coach?._id,
          name: sub.coach?.additionalInfo?.name || 'N/A',
          email: sub.coach?.additionalInfo?.email || 'N/A',
          phone: sub.coach?.phone || 'N/A'
        },
        subscription: {
          startDate: sub.startDate,
          endDate: sub.endDate,
          monthlyFee: sub.monthlyFee,
          currency: sub.currency,
          platform: sub.platform,
          subscriptionType: sub.subscriptionType,
          sessionsPerMonth: sub.sessionsPerMonth,
          sessionsUsed: sub.sessionsUsed,
          paymentStatus: sub.paymentStatus
        },
        status: {
          isActive: sub.isActive,
          isExpired: isExpired,
          daysSinceExpiry: daysSinceExpiry,
          expirationReason: sub.expirationReason || (isExpired ? 'automatic_expiration' : 'manual_cancellation'),
          expiredAt: sub.expiredAt
        },
        analysis: {
          durationInDays: Math.floor((endDate - new Date(sub.startDate)) / (1000 * 60 * 60 * 24)),
          totalRevenue: sub.monthlyFee * Math.ceil((endDate - new Date(sub.startDate)) / (1000 * 60 * 60 * 24 * 30)),
          utilizationRate: sub.sessionsPerMonth > 0 ? (sub.sessionsUsed / sub.sessionsPerMonth) * 100 : 0
        }
      };
    });

    // Calculate summary statistics
    const totalInactive = processedSubscriptions.length;
    const expiredByDate = processedSubscriptions.filter(sub => sub.status.isExpired).length;
    const manuallyCancelled = processedSubscriptions.filter(sub => !sub.status.isExpired && !sub.status.isActive).length;
    const totalRevenueLost = processedSubscriptions.reduce((sum, sub) => sum + sub.analysis.totalRevenue, 0);
    const averageUtilization = processedSubscriptions.length > 0 
      ? processedSubscriptions.reduce((sum, sub) => sum + sub.analysis.utilizationRate, 0) / processedSubscriptions.length 
      : 0;

    res.status(200).json({
      success: true,
      count: totalInactive,
      summary: {
        totalInactive,
        expiredByDate,
        manuallyCancelled,
        totalRevenueLost,
        averageUtilization: Math.round(averageUtilization * 10) / 10
      },
      subscriptions: processedSubscriptions
    });
  } catch (error) {
    console.error('Error fetching inactive subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== FINANCIAL MANAGEMENT =====================


// Get financial overview for all coaches
exports.getFinancialOverview = async (req, res) => {
  try {
    console.log('=== getFinancialOverview called ===');
    console.log('Request headers:', req.headers);
    console.log('Request query:', req.query);
    console.log('Request user:', req.user);
    
    const { period = 'month', coachId } = req.query;
    console.log('Query parameters:', { period, coachId });
    
    // Build coach filter
    let coachFilter = { role: 'coach' };
    if (coachId && coachId !== 'all' && coachId !== 'undefined') {
      try {
        // Validate that coachId is a valid ObjectId
        const mongoose = require('mongoose');
        if (mongoose.Types.ObjectId.isValid(coachId)) {
          coachFilter._id = coachId;
        } else {
          console.log('Invalid coachId format:', coachId);
        }
      } catch (error) {
        console.log('Error validating coachId:', error);
      }
    }
    
    console.log('Coach filter:', coachFilter);
    
    const coaches = await User.find(coachFilter)
      .populate('additionalInfo', 'name email');
    
    console.log('Found coaches for financial overview:', coaches.length);
    console.log('Coaches data:', coaches.map(c => ({ id: c._id, name: c.additionalInfo?.name, email: c.additionalInfo?.email })));
    
    // Check if there are any subscriptions in the database
    const totalSubscriptions = await UserSubscription.countDocuments();
    console.log('Total subscriptions in database:', totalSubscriptions);
    
    // Show all subscriptions in database for debugging
    const allSubscriptions = await UserSubscription.find({}).limit(10);
    console.log('Sample subscriptions in database:', allSubscriptions.map(sub => ({
      id: sub._id,
      coach: sub.coach,
      client: sub.client,
      monthlyFee: sub.monthlyFee,
      isActive: sub.isActive,
      endDate: sub.endDate,
      paymentStatus: sub.paymentStatus
    })));
    
    // Check if there are any sessions in the database
    const totalSessions = await Session.countDocuments();
    console.log('Total sessions in database:', totalSessions);
    
    // Show sample sessions in database for debugging
    const allSessions = await Session.find({}).limit(10);
    console.log('Sample sessions in database:', allSessions.map(session => ({
      id: session._id,
      coach: session.coach,
      date: session.date,
      status: session.status,
      sessionType: session.sessionType
    })));

    const financialData = [];

    for (const coach of coaches) {
      console.log(`Processing coach: ${coach._id} - ${coach.additionalInfo?.name}`);
      
      // Get active subscriptions with their fees (already checking endDate)
      const activeSubscriptionsData = await UserSubscription.find({
        coach: coach._id,
        isActive: true,
        endDate: { $gte: new Date() }
      });
      
      const activeSubscriptions = activeSubscriptionsData.length;
      const totalSubscriptionRevenue = activeSubscriptionsData.reduce((sum, sub) => sum + (sub.monthlyFee || 0), 0);
      
      console.log(`Coach ${coach._id} active subscriptions:`, activeSubscriptions);
      console.log(`Coach ${coach._id} subscription details:`, activeSubscriptionsData.map(sub => ({
        id: sub._id,
        monthlyFee: sub.monthlyFee,
        isActive: sub.isActive,
        endDate: sub.endDate,
        paymentStatus: sub.paymentStatus
      })));
      console.log(`Coach ${coach._id} total subscription revenue:`, totalSubscriptionRevenue);

      // Get total sessions conducted
      const totalSessions = await Session.countDocuments({
        coach: coach._id
      });
      console.log(`Coach ${coach._id} total sessions:`, totalSessions);

      // Get period-based sessions based on the period parameter
      let startDate = new Date();
      let endDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'quarter':
          const currentQuarter = Math.floor(startDate.getMonth() / 3);
          startDate.setMonth(currentQuarter * 3, 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'year':
          startDate.setMonth(0, 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
      }

      const periodSessions = await Session.countDocuments({
        coach: coach._id,
        date: { $gte: startDate, $lte: endDate }
      });
      console.log(`Coach ${coach._id} period sessions (${period}):`, periodSessions, 'Date range:', startDate, 'to', endDate);

      // Calculate revenue - use ONLY actual subscription fees, no fallback to sessions
      const estimatedRevenue = totalSubscriptionRevenue; // Only real subscription revenue
      const periodRevenue = 0; // No period revenue calculation for now
      
      console.log(`Coach ${coach._id} revenue calculation:`, {
        activeSubscriptions,
        totalSubscriptionRevenue,
        estimatedRevenue,
        totalSessions,
        periodSessions,
        periodRevenue
      });

      financialData.push({
        coachId: coach._id,
        coachName: coach.additionalInfo?.name || 'Unknown',
        coachEmail: coach.additionalInfo?.email || '',
        activeSubscriptions,
        totalSubscriptionRevenue,
        totalSessions,
        periodSessions,
        estimatedRevenue, // Based on actual subscription fees or session count
        periodRevenue // Based on period sessions
      });
    }

    // Calculate totals
    const totalActiveSubscriptions = financialData.reduce((sum, item) => sum + item.activeSubscriptions, 0);
    const totalRevenue = financialData.reduce((sum, item) => sum + item.estimatedRevenue, 0);
    const totalPeriodRevenue = financialData.reduce((sum, item) => sum + item.periodRevenue, 0);
    const totalPeriodSessions = financialData.reduce((sum, item) => sum + item.periodSessions, 0);
    
    console.log('=== Total Calculations ===');
    console.log('Total Active Subscriptions:', totalActiveSubscriptions);
    console.log('Total Revenue (from subscriptions):', totalRevenue);
    console.log('Total Period Revenue (from sessions):', totalPeriodRevenue);
    console.log('Total Period Sessions:', totalPeriodSessions);
    console.log('Financial Data Array:', financialData);

    const response = {
      success: true,
      summary: {
        totalCoaches: coaches.length,
        totalActiveSubscriptions,
        totalEstimatedRevenue: totalRevenue,
        totalPeriodRevenue,
        totalPeriodSessions,
        period
      },
      coachData: financialData,
      financial: {
        totalCoaches: coaches.length,
        totalActiveSubscriptions,
        totalEstimatedRevenue: totalRevenue,
        totalPeriodRevenue,
        totalPeriodSessions,
        period,
        coachData: financialData
      }
    };
    
    console.log('=== Financial overview response ===');
    console.log('Response summary:', response.summary);
    console.log('Response financial:', response.financial);
    console.log('Coach data count:', response.coachData.length);
    
    res.status(200).json(response);
  } catch (error) {
    console.error('=== Error fetching financial overview ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
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
        estimatedRevenue: monthSubscriptions.length * 1000 // Adjust based on your pricing
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

// ===================== COACH SCHEDULE MANAGEMENT =====================

// Create or update coach schedule
exports.manageCoachSchedule = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { 
      days, 
      startTime, 
      endTime, 
      title, 
      description, 
      sessionType, 
      duration, 
      maxParticipants, 
      category, 
      difficulty, 
      timezone 
    } = req.body;

    // Validation
    const { error } = coachScheduleValidation({ days, startTime, endTime });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message),
      });
    }

    const coach = await User.findById(coachId).where('role').equals('coach');
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    const existingSchedule = await CoachSchedule.findOne({ coach: coachId });

    if (existingSchedule) {
      // Update existing schedule
      if (days) existingSchedule.days = days;
      if (startTime) existingSchedule.startTime = startTime;
      if (endTime) existingSchedule.endTime = endTime;
      if (title) existingSchedule.title = title;
      if (description) existingSchedule.description = description;
      if (sessionType) existingSchedule.sessionType = sessionType;
      if (duration) existingSchedule.duration = duration;
      if (maxParticipants) existingSchedule.maxParticipants = maxParticipants;
      if (category) existingSchedule.category = category;
      if (difficulty) existingSchedule.difficulty = difficulty;
      if (timezone) existingSchedule.timezone = timezone;
      
      await existingSchedule.save();
      
      res.status(200).json({
        success: true,
        message: 'Coach schedule updated successfully',
        schedule: existingSchedule
      });
    } else {
      // Create new schedule
      const newSchedule = await CoachSchedule.create({
        coach: coachId,
        days: days || [],
        startTime: startTime || '09:00',
        endTime: endTime || '10:00',
        title: title || 'Coaching Session',
        description: description || '',
        sessionType: sessionType || 'individual',
        duration: duration || 60,
        maxParticipants: maxParticipants || 1,
        category: category || 'fitness',
        difficulty: difficulty || 'beginner',
        timezone: timezone || 'Asia/Kolkata'
      });

      res.status(201).json({
        success: true,
        message: 'Coach schedule created successfully',
        schedule: newSchedule
      });
    }
  } catch (error) {
    console.error('Error managing coach schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get coach schedule
exports.getCoachSchedule = async (req, res) => {
  try {
    const { coachId } = req.params;

    const coach = await User.findById(coachId).where('role').equals('coach');
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    const schedule = await CoachSchedule.findOne({ coach: coachId });

    res.status(200).json({
      success: true,
      schedule: schedule || null
    });
  } catch (error) {
    console.error('Error fetching coach schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== COACH FEE MANAGEMENT =====================



// Update coach monthly fee
exports.updateCoachFee = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { monthlyFee, currency = 'INR' } = req.body;

    // Validation
    if (!monthlyFee || monthlyFee < 0) {
      return res.status(400).json({
        success: false,
        message: 'Monthly fee must be a positive number'
      });
    }

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
    res.status(500).json({
      success: false,
      message: 'Server error',
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
    const coaches = await User.find({ role: 'coach' })
      .populate('additionalInfo', 'name email')
      .select('-password');

    const coachesWithFees = await Promise.all(
      coaches.map(async (coach) => {
        const coachProfile = await CoachProfile.findOne({ user: coach._id });
        return {
          id: coach._id,
          name: coach.additionalInfo?.name || 'Unknown',
          email: coach.additionalInfo?.email || '',
          phone: coach.phone,
          role: coach.role,
          monthlyFee: coachProfile?.monthlyFee || 0,
          currency: coachProfile?.currency || 'INR',
          feeUpdatedAt: coachProfile?.feeUpdatedAt,
          isActive: coachProfile?.isActive !== false
        };
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
      message: 'Server error',
      error: error.message
    });
  }
};

// Create or initialize coach profile
exports.createCoachProfile = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { monthlyFee = 5000, currency = 'INR', experience, bio, specialization } = req.body;

    // Check if coach exists
    const coachUser = await User.findById(coachId).where('role').equals('coach');
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    // Check if profile already exists
    const existingProfile = await CoachProfile.findOne({ user: coachId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Coach profile already exists'
      });
    }

    // Create new coach profile
    const coachProfile = await CoachProfile.create({
      user: coachId,
      monthlyFee: monthlyFee, // Use monthlyFee parameter
      currency,
      feeUpdatedBy: req.user.id,
      feeUpdatedAt: new Date(),
      experience: experience || 0,
      bio: bio || '',
      specialization: specialization || []
    });

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

// Get all coach profiles with detailed information
exports.getAllCoachProfiles = async (req, res) => {
  try {
    console.log('getAllCoachProfiles called');
    const { page = 1, limit = 10, isActive, specialization } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (specialization) filter.specialization = { $in: [specialization] };

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
    
    console.log('Found coach profiles:', coachProfiles.length);
    console.log('Total coach profiles in database:', total);

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

    console.log('Returning coach profiles response:', {
      success: true,
      count: profilesWithStats.length,
      total,
      coachProfiles: profilesWithStats
    });

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

// Update coach statistics (total sessions and clients)
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
