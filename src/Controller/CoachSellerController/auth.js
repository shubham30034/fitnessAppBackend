const User = require('../../Model/userModel/userModel');
const bcrypt = require('bcrypt');
const {generateToken} = require('../../Utils/Jwt');
const RefreshToken = require('../../Model/userModel/refreshToken');
const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../../Model/userModel/blackListedToken');
const {loginValidation, signupValidation} = require("../../validator/coachSellerValidation")
const UserAdditionalInfo = require('../../Model/userModel/additionalInfo');

// Coach & Seller Login
exports.loginWithPassword = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const { error } = loginValidation({ phone, password });
    if (error) {
    return res.status(400).json({
     success: false,
     message: 'Validation failed',
    errors: error.details.map(e => e.message),
     });
   }
    
    const user = await User.findOne({ phone }).populate('additionalInfo');
  
    if(!user){
      return res.status(400).json({
        success:false,
        message:"unable to find offical"
      })
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password not set for this account',
      });
    }

    // Allow only coach, seller, or coachmanager to use this login endpoint
    if (!['coach', 'seller', 'coachmanager'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only coach, seller, or coachmanager accounts can log in here',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }

    const payload = { id: user._id, role: user.role };
    const { accessToken, refreshToken } = await generateToken(payload);

    // Rotate refresh token: allow only one active refresh token per user
    await RefreshToken.deleteOne({ userId: user._id });
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
        email: user.additionalInfo?.email || '',
        name: user.additionalInfo?.name || '',
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login error',
      error: error.message,
    });
  }
};

// Officials Login (admin or superadmin)
exports.loginOfficial = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const { error } = loginValidation({ phone, password });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message),
      });
    }

    const user = await User.findOne({ phone }).populate('additionalInfo');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Unable to find account' });
    }

    if (!['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only admin or superadmin can log in here' });
    }

    if (!user.password) {
      return res.status(400).json({ success: false, message: 'Password not set for this account' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const payload = { id: user._id, role: user.role };
    const { accessToken, refreshToken } = await generateToken(payload);

    await RefreshToken.deleteOne({ userId: user._id });
    await RefreshToken.create({ userId: user._id, token: refreshToken });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
        email: user.additionalInfo?.email || '',
        name: user.additionalInfo?.name || '',
      },
      tokens: { accessToken, refreshToken },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Login error', error: error.message });
  }
};


// Coach & Seller Signup (admin-like self-service; consider restricting in production)
exports.signupWithPassword = async (req, res) => {
  try {
    const { phone, password, role, name, email, address } = req.body;

    const { error } = signupValidation({ phone, password, role, name, email, address });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message),
      });
    }

    let user = await User.findOne({ phone });
    if (user) {
      return res.status(409).json({ success: false, message: 'Account already exists with this phone' });
    }

    const hashed = await bcrypt.hash(password, 10);
    user = await User.create({ phone, password: hashed, role });

    // Optionally create additional info
    if (name || email || address) {
      const info = await UserAdditionalInfo.create({ userId: user._id, name, email, address });
      user.additionalInfo = info._id;
      await user.save();
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Signup error', error: error.message });
  }
};

// controller/coachAuthController.js

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate('additionalInfo');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
        email: user.additionalInfo?.email || '',
        name: user.additionalInfo?.name || '',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving user",
      error: error.message,
    });
  }
};





// Logout
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
   const token = req.headers.authorization?.split(' ')[1]; // Correct extraction
   const accessToken = token


    console.log("refreshToken", refreshToken);

    if (!refreshToken || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token and access token are required',
      });
    }

    // ❌ Delete refresh token from DB
    const deleted = await RefreshToken.deleteOne({ token: refreshToken });

    console.log(deleted, "deleted");

    if (deleted.deletedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    // 🛑 Decode the access token and store in blacklist
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    await BlacklistedToken.create({ token: accessToken, expiresAt });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully, token blacklisted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message,
    });
  }
};

// Regenerate Refresh Token
exports.regenerateRefreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN);
    const existingToken = await RefreshToken.findOne({ token: refreshToken });
    if (!existingToken) {
      return res.status(400).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    await RefreshToken.deleteOne({ token: refreshToken });

    const payload = { id: decoded.id, role: decoded.role };
    const { accessToken, refreshToken: newRefreshToken } = await generateToken(payload);

    await RefreshToken.create({
      userId: payload.id,
      token: newRefreshToken,
    });

    res.status(200).json({
      success: true,
      message: 'Tokens regenerated successfully',
      accessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Error regenerating token', error: error.message });
  }
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate('additionalInfo');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
        email: user.additionalInfo?.email || '',
        name: user.additionalInfo?.name || '',
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user', error: error.message });
  }
};

// Get coach clients (for coach users)
exports.getCoachClients = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const UserSubscription = require('../../Model/paidSessionModel/userSubscription');

    const subscriptions = await UserSubscription.find({
      coach: userId,
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

    const clients = subscriptions.map(sub => ({
      subscriptionId: sub._id,
      startDate: sub.startDate,
      endDate: sub.endDate,
      client: sub.client
    }));

    res.status(200).json({
      success: true,
      count: clients.length,
      clients
    });
  } catch (error) {
    console.error('Error fetching coach clients:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== COACH-SPECIFIC OPERATIONS =====================

// Get coach profile (for coach users)
exports.getCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const CoachProfile = require('../../Model/paidSessionModel/coach');
    const UserSubscription = require('../../Model/paidSessionModel/userSubscription');
    const Session = require('../../Model/paidSessionModel/session');

    const user = await User.findById(userId).populate('additionalInfo');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coachProfile = await CoachProfile.findOne({ user: userId });
    if (!coachProfile) {
      return res.status(404).json({ success: false, message: 'Coach profile not found' });
    }

    // Get additional statistics
    const activeSubscriptions = await UserSubscription.countDocuments({
      coach: userId,
      isActive: true
    });

    const totalSessions = await Session.countDocuments({
      coach: userId
    });

    res.status(200).json({
      success: true,
      coachProfile: {
        coachId: userId,
        coachName: user.additionalInfo?.name || 'Unknown',
        coachEmail: user.additionalInfo?.email || '',
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

// Update coach profile (for coach users)
exports.updateCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { experience, bio, specialization } = req.body;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const CoachProfile = require('../../Model/paidSessionModel/coach');

    // Find and update coach profile
    const updateData = {};
    if (experience !== undefined) updateData.experience = experience;
    if (bio !== undefined) updateData.bio = bio;
    if (specialization) updateData.specialization = specialization;

    const coachProfile = await CoachProfile.findOneAndUpdate(
      { user: userId },
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
        coachId: userId,
        experience: coachProfile.experience,
        bio: coachProfile.bio,
        specialization: coachProfile.specialization,
        updatedAt: coachProfile.updatedAt
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

// Get coach dashboard (for coach users)
exports.getCoachDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const UserSubscription = require('../../Model/paidSessionModel/userSubscription');
    const Session = require('../../Model/paidSessionModel/session');
    const CoachProfile = require('../../Model/paidSessionModel/coach');

    // Get active subscriptions count
    const activeSubscriptions = await UserSubscription.countDocuments({
      coach: userId,
      isActive: true
    });

    // Get total sessions conducted
    const totalSessions = await Session.countDocuments({
      coach: userId
    });

    // Get this month's sessions
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthSessions = await Session.countDocuments({
      coach: userId,
      date: { $gte: startOfMonth }
    });

    // Get coach profile
    const coachProfile = await CoachProfile.findOne({ user: userId });

    // Get recent sessions
    const recentSessions = await Session.find({
      coach: userId
    })
      .populate('users', 'phone additionalInfo')
      .sort({ date: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      dashboard: {
        activeSubscriptions,
        totalSessions,
        thisMonthSessions,
        monthlyFee: coachProfile?.monthlyFee || 0,
        currency: coachProfile?.currency || 'INR',
        rating: coachProfile?.rating || 0,
        recentSessions: recentSessions.map(session => ({
          id: session._id,
          date: session.date,
          status: session.status,
          participants: session.users.length
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching coach dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get coach analytics (for coach users)
exports.getCoachAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const UserSubscription = require('../../Model/paidSessionModel/userSubscription');
    const Session = require('../../Model/paidSessionModel/session');

    // Get monthly data for the last 6 months
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

      const monthSubscriptions = await UserSubscription.countDocuments({
        coach: userId,
        startDate: { $gte: startOfMonth, $lte: endOfMonth }
      });

      const monthSessions = await Session.countDocuments({
        coach: userId,
        date: { $gte: startOfMonth, $lte: endOfMonth }
      });

      monthlyData.push({
        month: startOfMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        newSubscriptions: monthSubscriptions,
        sessionsConducted: monthSessions
      });
    }

    res.status(200).json({
      success: true,
      analytics: {
        monthlyData
      }
    });
  } catch (error) {
    console.error('Error fetching coach analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== COACH CHAT FUNCTIONALITY =====================

// Get coach chat rooms
exports.getCoachChatRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const ChatRoom = require('../../Model/paidSessionModel/chatSection/chatRoom');
    const Message = require('../../Model/paidSessionModel/chatSection/message');

    const chatRooms = await ChatRoom.find({ coach: userId })
      .populate({
        path: 'user',
        select: 'phone role',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    // Get last message for each chat room
    const chatRoomsWithLastMessage = await Promise.all(
      chatRooms.map(async (room) => {
        const lastMessage = await Message.findOne({ chatRoom: room._id })
          .sort({ createdAt: -1 })
          .populate('sender', 'additionalInfo');

        const unreadCount = await Message.countDocuments({
          chatRoom: room._id,
          sender: { $ne: userId },
          read: false
        });

        return {
          id: room._id,
          user: room.user,
          lastMessage: lastMessage ? {
            id: lastMessage._id,
            message: lastMessage.message,
            sender: lastMessage.sender,
            createdAt: lastMessage.createdAt
          } : null,
          unreadCount,
          createdAt: room.createdAt
        };
      })
    );

    res.status(200).json({
      success: true,
      count: chatRoomsWithLastMessage.length,
      chatRooms: chatRoomsWithLastMessage
    });
  } catch (error) {
    console.error('Error fetching coach chat rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get chat messages for a specific room
exports.getChatMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const ChatRoom = require('../../Model/paidSessionModel/chatSection/chatRoom');
    const Message = require('../../Model/paidSessionModel/chatSection/message');

    // Verify the chat room belongs to this coach
    const chatRoom = await ChatRoom.findOne({ _id: roomId, coach: userId });
    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    const skip = (page - 1) * limit;
    const messages = await Message.find({ chatRoom: roomId })
      .populate('sender', 'additionalInfo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({ chatRoom: roomId });

    // Mark messages as read
    await Message.updateMany(
      { 
        chatRoom: roomId, 
        sender: { $ne: userId }, 
        read: false 
      },
      { read: true }
    );

    res.status(200).json({
      success: true,
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Send message in chat room
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;
    const { message, attachment } = req.body;

    if (!message && !attachment) {
      return res.status(400).json({
        success: false,
        message: 'Message or attachment is required'
      });
    }

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const ChatRoom = require('../../Model/paidSessionModel/chatSection/chatRoom');
    const Message = require('../../Model/paidSessionModel/chatSection/message');

    // Verify the chat room belongs to this coach
    const chatRoom = await ChatRoom.findOne({ _id: roomId, coach: userId });
    if (!chatRoom) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    const newMessage = await Message.create({
      chatRoom: roomId,
      sender: userId,
      message,
      attachment
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'additionalInfo');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: populatedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Create chat room with a client
exports.createChatRoom = async (req, res) => {
  try {
    const userId = req.user.id;
    const { clientId } = req.body;

    // Check if user is a coach
    if (req.user.role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.'
      });
    }

    const ChatRoom = require('../../Model/paidSessionModel/chatSection/chatRoom');
    const UserSubscription = require('../../Model/paidSessionModel/userSubscription');

    // Verify the client has an active subscription with this coach
    const subscription = await UserSubscription.findOne({
      coach: userId,
      client: clientId,
      isActive: true
    });

    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: 'Client must have an active subscription to create a chat room'
      });
    }

    // Check if chat room already exists
    const existingRoom = await ChatRoom.findOne({
      coach: userId,
      user: clientId
    });

    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: 'Chat room already exists with this client'
      });
    }

    const chatRoom = await ChatRoom.create({
      coach: userId,
      user: clientId
    });

    const populatedRoom = await ChatRoom.findById(chatRoom._id)
      .populate({
        path: 'user',
        select: 'phone role',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      data: populatedRoom
    });
  } catch (error) {
    console.error('Error creating chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
