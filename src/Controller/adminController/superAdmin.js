const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../../Model/userModel/userModel');
const UserAdditionalInfo = require('../../Model/userModel/additionalInfo');
const CoachProfile = require('../../Model/paidSessionModel/coach');
const CoachSchedule = require('../../Model/paidSessionModel/coachSchedule');
const UserSubscription = require('../../Model/paidSessionModel/userSubscription');
const Session = require('../../Model/paidSessionModel/session');
const Product = require('../../Model/ProductsModel/product');
const Order = require('../../Model/ProductsModel/orderSchema');

const { createAdminValidation } = require('../../validator/superAdminValidator');

const validDays = [
  'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'
];


// ========================= USER / OFFICIAL =========================

exports.createUser = async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;
    const validRoles = ['admin','seller','coach','coachmanager'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const { error } = createAdminValidation({ name, phone, email, password });
    if (error) {
      return res.status(400).json({ errors: error.details.map(e => e.message) });
    }

    if (await User.findOne({ phone })) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    if (await UserAdditionalInfo.findOne({ email })) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ phone, password: hashedPassword, role });
    const info = await UserAdditionalInfo.create({ userId: user._id, name, email });

    user.additionalInfo = info._id;
    await user.save();

    if (role === 'coach') {
      await CoachProfile.create({
        user: user._id,
        monthlyFee: 5000,
        currency: 'INR',
        feeUpdatedBy: req.user.id,
        feeUpdatedAt: new Date()
      });
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllUsers = async (_, res) => {
  const users = await User.find()
    .select('phone role createdAt isActive')
    .populate('additionalInfo','name email');

  res.json({ users });
};

exports.getOfficals = async (_, res) => {
  const users = await User.find({
    role: { $in:['admin','coach','seller','coachmanager'] }
  })
  .select('phone role createdAt isActive')
  .populate('additionalInfo','name email');

  res.json({ users });
};

exports.deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message:'User not found' });
  if (user.role === 'superadmin') {
    return res.status(403).json({ message:'Cannot delete superadmin' });
  }

  if (user.additionalInfo) {
    await UserAdditionalInfo.findByIdAndDelete(user.additionalInfo);
  }

  await User.findByIdAndDelete(user._id);
  res.json({ message:'User deleted' });
};


// ========================= COACH PROFILE =========================

exports.createCoachProfile = async (req, res) => {
  const { coachId } = req.params;
  const { monthlyFee = 5000, experience = 0, bio = '' } = req.body;

  const coach = await User.findById(coachId).where('role').equals('coach');
  if (!coach) return res.status(404).json({ message:'Coach not found' });

  if (await CoachProfile.findOne({ user: coachId })) {
    return res.status(400).json({ message:'Profile already exists' });
  }

  const profile = await CoachProfile.create({
    user: coachId,
    monthlyFee,
    currency:'INR',
    experience,
    bio,
    feeUpdatedBy: req.user.id,
    feeUpdatedAt: new Date()
  });

  res.status(201).json({ profile });
};

exports.updateCoachProfile = async (req, res) => {
  const { coachId } = req.params;

  const profile = await CoachProfile.findOneAndUpdate(
    { user: coachId },
    req.body,
    { new:true }
  );

  if (!profile) {
    return res.status(404).json({ message:'Coach profile not found' });
  }

  res.json({ profile });
};

exports.getCoachProfile = async (req, res) => {
  const profile = await CoachProfile.findOne({ user:req.params.coachId })
    .populate({
      path:'user',
      populate:{ path:'additionalInfo', select:'name email' }
    });

  if (!profile) return res.status(404).json({ message:'Profile not found' });

  const activeSubscriptions = await UserSubscription.countDocuments({
    coach:req.params.coachId,
    isActive:true
  });

  const totalSessions = await Session.countDocuments({
    coach:req.params.coachId
  });

  res.json({
    profile,
    activeSubscriptions,
    totalSessions
  });
};

exports.toggleCoachStatus = async (req, res) => {
  const profile = await CoachProfile.findOne({ user:req.params.coachId });
  if (!profile) return res.status(404).json({ message:'Profile not found' });

  profile.isActive = !profile.isActive;
  await profile.save();

  res.json({ isActive: profile.isActive });
};


// ========================= COACH SCHEDULE (AVAILABILITY) =========================

exports.createCoachSchedule = async (req, res) => {
  const { coachId, days, startTime, endTime } = req.body;

  if (!Array.isArray(days) || days.some(d => !validDays.includes(d))) {
    return res.status(400).json({ message:'Invalid days' });
  }

  const existing = await CoachSchedule.findOne({ coach:coachId });
  if (existing) {
    existing.days = days;
    existing.startTime = startTime;
    existing.endTime = endTime;
    await existing.save();
    return res.json({ message:'Schedule updated' });
  }

  await CoachSchedule.create({ coach:coachId, days, startTime, endTime });
  res.status(201).json({ message:'Schedule created' });
};

exports.editCoachSchedule = async (req, res) => {
  const schedule = await CoachSchedule.findById(req.params.scheduleId);
  if (!schedule) return res.status(404).json({ message:'Schedule not found' });

  Object.assign(schedule, req.body);
  await schedule.save();

  res.json({ message:'Schedule updated' });
};

exports.getAllCoachSchedules = async (_, res) => {
  const schedules = await CoachSchedule.find()
    .populate({
      path:'coach',
      populate:{ path:'additionalInfo', select:'name email' }
    });

  res.json({ schedules });
};


// ========================= COACH VIEW =========================

exports.getAllCoachesDetailed = async (_, res) => {
  const coaches = await User.find({ role:'coach' })
    .populate('additionalInfo','name email');

  const data = await Promise.all(coaches.map(async c => {
    const profile = await CoachProfile.findOne({ user:c._id });
    const subs = await UserSubscription.countDocuments({ coach:c._id, isActive:true });
    const sessions = await Session.countDocuments({ coach:c._id });

    return {
      id:c._id,
      name:c.additionalInfo?.name,
      email:c.additionalInfo?.email,
      monthlyFee:profile?.monthlyFee || 0,
      isActive:profile?.isActive !== false,
      activeSubscriptions:subs,
      totalSessions:sessions
    };
  }));

  res.json({ coaches:data });
};

exports.getCoachDetailed = async (req, res) => {
  const coach = await User.findById(req.params.coachId)
    .where('role').equals('coach')
    .populate('additionalInfo','name email');

  if (!coach) return res.status(404).json({ message:'Coach not found' });

  const profile = await CoachProfile.findOne({ user:coach._id });
  const students = await UserSubscription.find({ coach:coach._id, isActive:true })
    .populate({
      path:'client',
      populate:{ path:'additionalInfo', select:'name email' }
    });

  res.json({ coach, profile, students });
};


// ========================= STUDENTS =========================

exports.getAllStudentsDetailed = async (_, res) => {
  const subs = await UserSubscription.find({ isActive:true })
    .populate('client','phone')
    .populate('coach','phone');

  res.json({ students:subs });
};


// ========================= SELLER =========================

exports.getAllSellers = async (_, res) => {
  const sellers = await User.find({ role:'seller' })
    .populate('additionalInfo','name email');

  res.json({ sellers });
};

exports.getSellerDetailed = async (req, res) => {
  const seller = await User.findById(req.params.sellerId)
    .where('role').equals('seller')
    .populate('additionalInfo','name email');

  if (!seller) return res.status(404).json({ message:'Seller not found' });

  const products = await Product.find({ sellerId:seller._id });
  const orders = await Order.find({
    'products.productId': { $in: products.map(p=>p._id) }
  });

  res.json({ seller, products, ordersCount:orders.length });
};

exports.updateSeller = async (req, res) => {
  await User.findByIdAndUpdate(req.params.sellerId, req.body);
  res.json({ message:'Seller updated' });
};

exports.deleteSeller = async (req, res) => {
  const activeProducts = await Product.countDocuments({
    sellerId:req.params.sellerId,
    isActive:true
  });

  if (activeProducts > 0) {
    return res.status(400).json({ message:'Deactivate products first' });
  }

  await Product.deleteMany({ sellerId:req.params.sellerId });
  await User.findByIdAndDelete(req.params.sellerId);

  res.json({ message:'Seller deleted' });
};


// ========================= SYSTEM =========================

exports.getSystemOverview = async (_, res) => {
  const users = await User.countDocuments();
  const subscriptions = await UserSubscription.countDocuments({ isActive:true });
  const sessions = await Session.countDocuments();
  const revenue = await Order.aggregate([
    { $group:{ _id:null, total:{ $sum:'$totalPrice' } } }
  ]);

  res.json({
    users,
    subscriptions,
    sessions,
    totalRevenue: revenue[0]?.total || 0
  });
};
