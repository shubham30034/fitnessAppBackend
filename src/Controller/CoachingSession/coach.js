const axios = require("axios");
const cron = require("node-cron");
const CoachSchedule = require("../../Model/paidSessionModel/coachSchedule");
const UserSubscription = require("../../Model/paidSessionModel/userSubscription");
const CoachProfile = require("../../Model/paidSessionModel/coach");
const CoachZoom = require("../../Model/paidSessionModel/coachZoom");
const Session = require("../../Model/paidSessionModel/session");
const User = require("../../Model/userModel/userModel");
const UserAdditionalInfo = require("../../Model/userModel/additionalInfo");
const InAppProduct = require("../../Model/paidSessionModel/inAppProducts");
const { updateCoachProfileValidation, cancelSessionValidation } = require("../../validator/coachValidation");


// ===================== PUBLIC CONTROLLERS =====================

exports.getAllCoaches = async (req, res) => {
  try {
    // Get distinct coach IDs who have a schedule
    const scheduledCoaches = await CoachSchedule.find().distinct("coach");

    if (!scheduledCoaches.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        coaches: [],
        message: "No coaches have scheduled sessions",
      });
    }

    // Fetch coach users with populated info
    const coaches = await User.find({
      _id: { $in: scheduledCoaches },
      role: "coach",
    })
      .populate({
        path: "additionalInfo",
        select: "name email profilePicture", // Add more fields as needed
      })
     

    res.status(200).json({
      success: true,
      count: coaches.length,
      coaches,
      message: "Coaches fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching scheduled coaches:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


exports.getCoachById = async (req, res) => {
  try {
    const coachId = req.params.coachId;

    const coach = await User.findById(coachId)
      .where("role").equals("coach")
      .populate({
        path: "additionalInfo",
        select: "name email profilePicture bio experience", // Add any more relevant fields
      })
     

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }

    res.status(200).json({
      success: true,
      coach,
      message: "Coach details fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching coach:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


// ===================== USER-SIDE CONTROLLERS =====================

// Note: subscribeToCoach function removed - use in-app purchase endpoints instead:
// POST /api/coaching/inapp/apple/verify-receipt for Apple App Store
// POST /api/coaching/inapp/google/verify-purchase for Google Play Store

exports.getTodaysSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

    const subscription = await UserSubscription.findOne({
      client: userId,
      startDate: { $lte: today },
      endDate: { $gte: today },
      isActive: true,
    });
 

    if (!subscription) {
      return res.status(400).json({ success: false, message: "No active subscription" });
    }

    const schedule = await CoachSchedule.findOne({ coach: subscription.coach });
    
    if (!schedule || !schedule.days.includes(dayName)) {
      return res.status(200).json({ success: false, message: "No session today" });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const session = await Session.findOne({
      coach: subscription.coach,
      users: userId, // because `users` is an array
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not scheduled yet" });
    }

    res.status(200).json({
      success: true,
      session: {
        coach: subscription.coach,
        date: session.date.toDateString(),
        time: `${session.startTime} - ${session.endTime}`,
        join_url: session.zoomJoinUrl,
      },
    });
  } catch (err) {
    console.error("Session Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =============== USER UTILITIES ===============
exports.getMySubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();

    const subscription = await UserSubscription.findOne({
      client: userId,
      startDate: { $lte: today },
      endDate: { $gte: today },
      isActive: true,
    }).populate({ path: 'coach', select: 'phone additionalInfo', populate: { path: 'additionalInfo', select: 'name email' } });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No active subscription' });
    }

    return res.status(200).json({ success: true, subscription });
  } catch (err) {
    console.error('getMySubscription error:', err);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();

    const subscription = await UserSubscription.findOne({ client: userId, isActive: true });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No active subscription to cancel' });
    }

    subscription.isActive = false;
    subscription.endDate = today;
    await subscription.save();

    return res.status(200).json({ success: true, message: 'Subscription cancelled' });
  } catch (err) {
    console.error('cancelSubscription error:', err);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getUserUpcomingSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await Session.find({ users: userId, date: { $gte: today } })
      .sort({ date: 1 })
      .populate({ path: 'coach', select: 'phone additionalInfo', populate: { path: 'additionalInfo', select: 'name email' } });

    const data = sessions.map((s) => ({
      date: s.date,
      time: `${s.startTime} - ${s.endTime}`,
      coach: {
        id: s.coach?._id,
        name: s.coach?.additionalInfo?.name || '',
        email: s.coach?.additionalInfo?.email || '',
      },
      join_url: s.zoomJoinUrl,
    }));

    return res.status(200).json({ success: true, count: data.length, sessions: data });
  } catch (err) {
    console.error('getUserUpcomingSessions error:', err);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};


// ===================== COACH-SIDE CONTROLLERS =====================
exports.getUpcomingCoachSessions = async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== 'coach') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const coachRecord = await User.findById(userId);
    if (!coachRecord) {
      return res.status(403).json({ success: false, message: 'Coach profile not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await Session.find({ coach: coachRecord._id, date: { $gte: today } })
      .populate({
        path: 'users',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    const formattedSessions = sessions.map(session => ({
      date: session.date.toDateString(),
      time: `${session.startTime} - ${session.endTime}`,
      join_url: session.zoomJoinUrl,
      clients: session.users.map(user => ({
        name: user?.additionalInfo?.name || 'N/A',
        email: user?.additionalInfo?.email || 'N/A',
      })),
    }));

    res.status(200).json({
      success: true,
      count: formattedSessions.length,
      sessions: formattedSessions
    });

  } catch (err) {
    console.error("Error fetching coach sessions:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getCoachSchedule = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    const coachRecord = await User.findById(userId).select('_id');
    if (!coachRecord) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found.',
      });
    }

    const schedule = await CoachSchedule.findOne({ coach: coachRecord._id })
      .select('days startTime endTime');
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found for this coach.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Schedule retrieved successfully.',
      schedule,
    });

  } catch (err) {
    console.error("Error fetching coach schedule:", err);
    // Optionally use logger here
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
    });
  }
};

exports.getMyClients = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    const subscriptions = await UserSubscription.find({
      coach: userId,
      isActive: true,
    })
      .populate({
        path: 'client',
        select: '-password -__v', // Exclude sensitive fields
        populate: {
          path: 'additionalInfo',
          select: '-__v',
        },
      });

    const clients = subscriptions.map(sub => ({
      subscriptionId: sub._id,
      client: sub.client,
    }));

    return res.status(200).json({
      success: true,
      message: 'Clients retrieved successfully.',
      count: clients.length,
      clients,
    });

  } catch (err) {
    console.error("Error in getMyClients:", err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
    });
  }
};


// ===================== DAILY CRON JOB =====================
// 
cron.schedule("0 6 * * *", async () => {
  try {
    console.log("⏰ Cron job started: Zoom session generation...");

    // Auto-delete sessions older than 60 days
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const deleteResult = await Session.deleteMany({ date: { $lt: twoMonthsAgo } });
    console.log(`🧹 Deleted ${deleteResult.deletedCount} old sessions`);

    const today = new Date();

    for (let i = 0; i < 3; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      targetDate.setHours(0, 0, 0, 0);
      const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });

      const subscriptions = await UserSubscription.find({
        isActive: true,
        startDate: { $lte: targetDate },
        endDate: { $gte: targetDate },
      });

      const processedCoaches = new Set();

      for (const sub of subscriptions) {
        const coachId = sub.coach.toString();
        if (processedCoaches.has(coachId)) continue;
        processedCoaches.add(coachId);

        const schedule = await CoachSchedule.findOne({ coach: sub.coach });
        if (!schedule || !schedule.days.includes(dayName)) continue;

        const existing = await Session.findOne({ coach: sub.coach, date: targetDate });
        if (existing) continue;

        const coachProfile = await CoachProfile.findOne({ user: sub.coach });
        const coachZoom = await CoachZoom.findOne({ user: sub.coach });
        if (!coachProfile || !coachZoom || !coachZoom.zoomRefreshToken || !coachZoom.zoomUserId) continue;

        const [startH, startM] = schedule.startTime.split(":").map(Number);
        const meetingStart = new Date(targetDate);
        meetingStart.setHours(startH, startM, 0, 0);

        const duration = calculateDuration(schedule.startTime, schedule.endTime);

        let zoomToken;
        try {
          zoomToken = await getValidZoomToken(coach.user);
        } catch (err) {
          console.error(`Zoom token refresh failed for coach ${coach.user}`, err);
          continue;
        }

        let zoomRes;
        try {
          zoomRes = await axios.post(
            `https://api.zoom.us/v2/users/${coach.zoomUserId}/meetings`,
            {
              topic: "Fitness Coaching Session",
              type: 2,
              start_time: meetingStart.toISOString(),
              duration,
              settings: { join_before_host: true },
            },
            {
              headers: {
                Authorization: `Bearer ${zoomToken}`,
                "Content-Type": "application/json",
              },
            }
          );
        } catch (err) {
          console.error(`Zoom meeting creation failed for coach ${coach.user}`, err.response?.data || err);
          continue;
        }

        const clients = await UserSubscription.find({
          coach: sub.coach,
          isActive: true,
          startDate: { $lte: targetDate },
          endDate: { $gte: targetDate },
        }).select("client");

        for (const client of clients) {
          try {
            await Session.create({
              user: client.client,
              coach: sub.coach,
              date: targetDate,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              zoomJoinUrl: zoomRes.data.join_url,
              zoomMeetingId: zoomRes.data.id,
              monthlyFee: coachProfile.monthlyFee || 0,
              currency: coachProfile.currency || 'INR',
            });

            console.log(`✅ Created session for user ${client.client} with coach ${sub.coach} on ${targetDate.toDateString()}`);
          } catch (err) {
            console.error(`❌ Failed to create session for user ${client.client}`, err.message || err);
          }
        }
      }
    }

    console.log("✅ Zoom session cron job completed.");
  } catch (err) {
    console.error("🔥 Cron job critical error:", err?.response?.data || err);
  }
});


// Helper: calculate duration in minutes
function calculateDuration(startTime, endTime) {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

// Helper: Get valid Zoom token, refresh if expired
async function getValidZoomToken(userId) {
  const coachZoom = await CoachZoom.findOne({ user: userId });
  if (!coachZoom) throw new Error("Coach Zoom not found");

  const now = new Date();
  if (coachZoom.zoomTokenExpiry && coachZoom.zoomTokenExpiry > now) {
    return coachZoom.zoomAccessToken;
  }

  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await axios.post(
    `https://zoom.us/oauth/token`,
    `grant_type=refresh_token&refresh_token=${coach.zoomRefreshToken}`,
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const { access_token, refresh_token, expires_in } = response.data;
  coachZoom.zoomAccessToken = access_token;
  coachZoom.zoomRefreshToken = refresh_token;
  coachZoom.zoomTokenExpiry = new Date(Date.now() + expires_in * 1000);
  await coachZoom.save();

  return access_token;
}

async function generateZoomSessions() {
  const today = new Date();
  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  // Step 1: Delete sessions older than 60 days
  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const deleteResult = await Session.deleteMany({ date: { $lt: twoMonthsAgo } });
  console.log(`🧹 Deleted ${deleteResult.deletedCount} old sessions`);

  for (let i = 0; i < 3; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    targetDate.setHours(0, 0, 0, 0);
    const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });

    const subscriptions = await UserSubscription.find({
      isActive: true,
      startDate: { $lte: targetDate },
      endDate: { $gte: targetDate },
    });

    const processedCoaches = new Set();

    for (const sub of subscriptions) {
      const coachId = sub.coach.toString();
      if (processedCoaches.has(coachId)) continue;
      processedCoaches.add(coachId);

      const schedule = await CoachSchedule.findOne({ coach: sub.coach });
      if (!schedule || !schedule.days.includes(dayName)) continue;

      const startOfDay = new Date(targetDate);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const clients = await UserSubscription.find({
        coach: sub.coach,
        isActive: true,
        startDate: { $lte: targetDate },
        endDate: { $gte: targetDate },
      }).select("client");

      const clientIds = clients.map(c => c.client.toString());

      const existingSession = await Session.findOne({
        coach: sub.coach,
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      if (existingSession) {
        const existingUserIds = existingSession.users.map(u => u.toString());
        const newUserIds = clientIds.filter(id => !existingUserIds.includes(id));

        console.log(`👥 Coach ${coachId}:`);
        console.log("📋 Existing users in session:", existingUserIds);
        console.log("🆕 Client IDs from subscriptions:", clientIds);
        console.log("➕ Users to add:", newUserIds);

        if (newUserIds.length > 0) {
          existingSession.users.push(...newUserIds);
          await existingSession.save();
          updatedCount++;
          console.log(`✅ Session updated with ${newUserIds.length} new user(s)`);
        }

        continue;
      }

      const coachProfile = await CoachProfile.findOne({ user: sub.coach });
      const coachZoom = await CoachZoom.findOne({ user: sub.coach });
      if (!coachProfile || !coachZoom || !coachZoom.zoomRefreshToken || !coachZoom.zoomUserId) {
        console.warn(`⚠️ Missing Zoom credentials for coach ${sub.coach}`);
        continue;
      }

      const [startH, startM] = schedule.startTime.split(":").map(Number);
      const meetingStart = new Date(targetDate);
      meetingStart.setHours(startH, startM, 0, 0);
      const duration = calculateDuration(schedule.startTime, schedule.endTime);

      let zoomToken;
      try {
        zoomToken = await getValidZoomToken(coach.user);
      } catch (err) {
        console.error(`❌ Zoom token refresh failed for coach ${coach.user}:`, err.message || err);
        errorCount++;
        continue;
      }

      let zoomRes;
      try {
        zoomRes = await axios.post(
          `https://api.zoom.us/v2/users/${coach.zoomUserId}/meetings`,
          {
            topic: "Fitness Coaching Session",
            type: 2,
            start_time: meetingStart.toISOString(),
            duration,
            settings: { join_before_host: true },
          },
          {
            headers: {
              Authorization: `Bearer ${zoomToken}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (err) {
        console.error(`❌ Zoom meeting creation failed for coach ${coach.user}:`, err.response?.data || err);
        errorCount++;
        continue;
      }

      try {
        await Session.create({
          users: clientIds,
          coach: sub.coach,
          date: targetDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          zoomJoinUrl: zoomRes.data.join_url,
          zoomMeetingId: zoomRes.data.id,
          monthlyFee: coachProfile.monthlyFee || 0,
          currency: coachProfile.currency || 'INR',
        });

        createdCount++;
        console.log(`✅ Created session for coach ${sub.coach} with ${clientIds.length} user(s)`);
      } catch (err) {
        console.error("❌ Failed to create session in DB:", err.message || err);
        errorCount++;
      }
    }
  }

  console.log(`📊 Done: ${createdCount} created | ${updatedCount} updated | ${errorCount} errors`);
}





exports.triggerSessionGeneration = async (req, res) => {
  try {
    await generateZoomSessions();
    res.status(200).json({ success: true, message: "Zoom sessions manually triggered" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Manual session trigger failed", error: err.message });
  }
};




// ========== ZOOM AUTHENTICATION FLOW ==========


exports.connectZoom = (req, res) => {
  const { userId } = req.query;
  console.log("Connecting Zoom for user:", userId);
  const redirectUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${process.env.ZOOM_CLIENT_ID}&redirect_uri=${process.env.ZOOM_REDIRECT_URI}&state=${userId}`;
  res.status(200).json({ success: true, authUrl: redirectUrl }); // ✅ Send URL
};




exports.zoomCallback = async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    console.log("Zoom Callback received with code:", code, "and userId:", userId);
    const authHeader = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");

    const tokenRes = await axios.post(
      "https://zoom.us/oauth/token",
      `grant_type=authorization_code&code=${code}&redirect_uri=${process.env.ZOOM_REDIRECT_URI}`,
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;
    const userInfoRes = await axios.get("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const zoomUserId = userInfoRes.data.id;

    console.log("access_token:", access_token," refresh_token:", refresh_token)

 const updateAuth = await CoachZoom.findOneAndUpdate(
  { user: userId },
  {
    user: userId, // required for upsert to create new doc
    zoomAccessToken: access_token,
    zoomRefreshToken: refresh_token,
    zoomTokenExpiry: new Date(Date.now() + expires_in * 1000),
    zoomUserId,
    isConnected: true,
    lastConnectedAt: new Date()
  },
  { new: true, upsert: true }
);


    if (!updateAuth) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    res.status(200).send("Zoom account connected successfully! You may close this window.");
  } catch (err) {
    console.error("Zoom Callback Error:", err.response?.data || err);
    res.status(500).send("Failed to connect Zoom account.");
  }
};

// ========== CHECK ZOOM CONNECTION STATUS ==========
exports.getZoomConnectionStatus = async (req, res) => {
  const coachZoom = await CoachZoom.findOne({ user: req.user.id });
  if (!coachZoom || !coachZoom.zoomUserId) {
    return res.status(200).json({ connected: false });
  }
  res.status(200).json({ connected: true });
};



// ========== ZOOM DISCONNECT FLOW ==========
exports.disconnectZoom = async (req, res) => {
  try {
    const { id: userId } = req.user;

    const coachZoom = await CoachZoom.findOne({ user: userId });
    if (!coachZoom || !coachZoom.zoomAccessToken) {
      return res.status(400).json({ success: false, message: "Zoom is not connected" });
    }

    // Optional: Revoke token from Zoom API
    try {
      const authHeader = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
      await axios.post(
        "https://zoom.us/oauth/revoke",
        null,
        {
          params: { token: coach.zoomAccessToken },
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
    } catch (revokeErr) {
      console.warn("Zoom token revoke failed (may be already expired):", revokeErr.response?.data || revokeErr.message);
    }

  const updateAuth = await CoachZoom.findOneAndUpdate(
      { user: userId },
      {
        $unset: {
          zoomAccessToken: "",
          zoomRefreshToken: "",
          zoomTokenExpiry: "",
          zoomUserId: "",
        },
        $set: {
          isConnected: false
        }
      },
      { new: true }
    );

    if (!updateAuth) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    res.status(200).json({ success: true, message: "Zoom disconnected successfully" });
  } catch (err) {
    console.error("Zoom Disconnect Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



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
        endTime,
        title: 'Coaching Session' // Distinguish from sales schedules
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

// ===================== COACH PROFILE MANAGEMENT =====================

// Get coach profile
exports.getCoachProfile = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    const coach = await User.findById(userId)
      .populate('additionalInfo', 'name email profilePicture bio experience')
      .select('-password');

    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found.',
      });
    }

    // Get coach profile with fee information
    const coachProfile = await CoachProfile.findOne({ user: userId });

    // Get coach schedule
    const schedule = await CoachSchedule.findOne({ coach: userId });

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
        schedule,
        stats: {
          activeSubscriptions,
          totalSessions,
          thisMonthSessions
        }
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

// Update coach profile
exports.updateCoachProfile = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { name, email, bio, experience, monthlyFee, currency, specialization } = req.body;

    // Validation
    const { error } = updateCoachProfileValidation({ name, email, bio, experience });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message),
      });
    }

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    const coach = await User.findById(userId);
    if (!coach) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found.',
      });
    }

    // Update additional info
    if (coach.additionalInfo) {
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (bio !== undefined) updateData.bio = bio;
      if (experience !== undefined) updateData.experience = experience;

      await UserAdditionalInfo.findByIdAndUpdate(coach.additionalInfo, updateData);
    }

    // Update or create CoachProfile
    const coachProfileUpdate = {};
    if (bio !== undefined) coachProfileUpdate.bio = bio;
    if (experience !== undefined) coachProfileUpdate.experience = experience;
    if (specialization !== undefined) coachProfileUpdate.specialization = specialization;
    if (monthlyFee !== undefined) coachProfileUpdate.monthlyFee = monthlyFee;
    if (currency !== undefined) coachProfileUpdate.currency = currency;

    if (Object.keys(coachProfileUpdate).length > 0) {
      await CoachProfile.findOneAndUpdate(
        { user: userId },
        coachProfileUpdate,
        { new: true, upsert: true }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
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

// ===================== COACH DASHBOARD =====================

// Get coach dashboard data
exports.getCoachDashboard = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    // Get active subscriptions
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

    // Get today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysSessions = await Session.countDocuments({
      coach: userId,
      date: { $gte: today, $lt: tomorrow }
    });

    // Get upcoming sessions (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingSessions = await Session.find({
      coach: userId,
      date: { $gte: today, $lte: nextWeek }
    }).populate('users', 'additionalInfo')
      .select('date startTime endTime users')
      .sort('date');

    // Get recent clients (last 5)
    const recentClients = await UserSubscription.find({
      coach: userId,
      isActive: true
    })
      .populate({
        path: 'client',
        select: 'additionalInfo',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      })
      .sort('-createdAt')
      .limit(5);

    // Calculate estimated revenue
    const estimatedRevenue = activeSubscriptions * 1000; // Adjust based on your pricing

    res.status(200).json({
      success: true,
      dashboard: {
        stats: {
          activeSubscriptions,
          totalSessions,
          thisMonthSessions,
          todaysSessions,
          estimatedRevenue
        },
        upcomingSessions: upcomingSessions.map(session => ({
          date: session.date.toDateString(),
          time: `${session.startTime} - ${session.endTime}`,
          clientCount: session.users.length
        })),
        recentClients: recentClients.map(sub => ({
          name: sub.client.additionalInfo?.name || 'Unknown',
          email: sub.client.additionalInfo?.email || '',
          subscriptionDate: sub.startDate
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

// ===================== COACH ANALYTICS =====================

// Get coach analytics
exports.getCoachAnalytics = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    // Get all subscriptions for this coach
    const subscriptions = await UserSubscription.find({
      coach: userId
    }).populate({
      path: 'client',
      select: 'additionalInfo',
      populate: {
        path: 'additionalInfo',
        select: 'name email'
      }
    });

    // Get all sessions for this coach
    const sessions = await Session.find({
      coach: userId
    }).populate('users', 'additionalInfo');

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

    // Get client retention data
    const totalClients = subscriptions.length;
    const activeClients = subscriptions.filter(sub => sub.isActive).length;
    const retentionRate = totalClients > 0 ? (activeClients / totalClients) * 100 : 0;

    res.status(200).json({
      success: true,
      analytics: {
        summary: {
          totalSubscriptions: totalClients,
          activeSubscriptions: activeClients,
          totalSessions: sessions.length,
          retentionRate: Math.round(retentionRate * 100) / 100,
          totalEstimatedRevenue: totalClients * 1000
        },
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

// ===================== SESSION MANAGEMENT =====================

// Get session details
exports.getSessionDetails = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { sessionId } = req.params;

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    const session = await Session.findById(sessionId)
      .populate('users', 'additionalInfo')
      .where('coach').equals(userId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.',
      });
    }

    res.status(200).json({
      success: true,
      session: {
        id: session._id,
        date: session.date.toDateString(),
        time: `${session.startTime} - ${session.endTime}`,
        zoomJoinUrl: session.zoomJoinUrl,
        zoomMeetingId: session.zoomMeetingId,
        clients: session.users.map(user => ({
          id: user._id,
          name: user.additionalInfo?.name || 'Unknown',
          email: user.additionalInfo?.email || ''
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Cancel a session
exports.cancelSession = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { sessionId } = req.params;
    const { reason } = req.body;

    // Validation
    const { error } = cancelSessionValidation({ reason });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message),
      });
    }

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    const session = await Session.findById(sessionId)
      .where('coach').equals(userId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.',
      });
    }

    // Check if session is in the future
    if (session.date <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel past or ongoing sessions.',
      });
    }

    // Delete the session
    await Session.findByIdAndDelete(sessionId);

    res.status(200).json({
      success: true,
      message: 'Session cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};



// ===================== CLIENT MANAGEMENT =====================

// Get client details
exports.getClientDetails = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { clientId } = req.params;

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    // Check if client is subscribed to this coach
    const subscription = await UserSubscription.findOne({
      coach: userId,
      client: clientId,
      isActive: true
    }).populate({
      path: 'client',
      select: 'phone additionalInfo',
      populate: {
        path: 'additionalInfo',
        select: 'name email'
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Client not found or not subscribed.',
      });
    }

    // Get client's sessions with this coach
    const sessions = await Session.find({
      coach: userId,
      users: clientId
    }).select('date startTime endTime')
      .sort('-date')
      .limit(10);

    res.status(200).json({
      success: true,
      client: {
        id: subscription.client._id,
        name: subscription.client.additionalInfo?.name || 'Unknown',
        email: subscription.client.additionalInfo?.email || '',
        phone: subscription.client.phone,
        subscriptionStart: subscription.startDate,
        subscriptionEnd: subscription.endDate,
        recentSessions: sessions.map(session => ({
          date: session.date.toDateString(),
          time: `${session.startTime} - ${session.endTime}`
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== COACH NOTIFICATIONS =====================

// Get coach notifications
exports.getCoachNotifications = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only coaches can access this resource.',
      });
    }

    // Get today's sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysSessions = await Session.countDocuments({
      coach: userId,
      date: { $gte: today, $lt: tomorrow }
    });

    // Get new subscriptions in last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const newSubscriptions = await UserSubscription.countDocuments({
      coach: userId,
      startDate: { $gte: lastWeek }
    });

    // Get upcoming sessions in next 24 hours
    const next24Hours = new Date();
    next24Hours.setHours(next24Hours.getHours() + 24);

    const upcomingSessions = await Session.countDocuments({
      coach: userId,
      date: { $gte: new Date(), $lte: next24Hours }
    });

    res.status(200).json({
      success: true,
      notifications: {
        todaysSessions,
        newSubscriptions,
        upcomingSessions,
        hasNotifications: (todaysSessions > 0 || newSubscriptions > 0 || upcomingSessions > 0)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== IN-APP PURCHASE CONTROLLERS =====================

// Verify Apple App Store receipt and create subscription
exports.verifyAppleReceipt = async (req, res) => {
  try {
    const { receiptData, productId, transactionId, userId, coachId } = req.body;

    // Validate required fields
    if (!receiptData || !productId || !transactionId || !userId || !coachId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: receiptData, productId, transactionId, userId, coachId'
      });
    }

    // TODO: Implement Apple receipt verification
    // This would typically involve calling Apple's verification API
    const isReceiptValid = await verifyAppleReceiptWithApple(receiptData);

    if (!isReceiptValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid receipt'
      });
    }

    // Get coach profile for fee information
    const coachProfile = await CoachProfile.findOne({ user: coachId });
    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    // Get product information
    const product = await InAppProduct.findOne({ 'appleProduct.productId': productId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Create subscription
    const subscription = await UserSubscription.create({
      client: userId,
      coach: coachId,
      platform: 'ios',
      monthlyFee: coachProfile.monthlyFee,
      currency: coachProfile.currency,
      startDate: new Date(),
      endDate: new Date(Date.now() + product.subscriptionDetails.duration * 24 * 60 * 60 * 1000),
      sessionsPerMonth: product.subscriptionDetails.sessionsPerMonth,
      paymentStatus: 'completed',
      receiptVerified: true,
      receiptVerifiedAt: new Date(),
      platformSubscriptionStatus: 'active',
      autoRenewStatus: product.subscriptionDetails.autoRenewable,
      applePurchase: {
        transactionId,
        productId,
        receiptData,
        environment: process.env.NODE_ENV === 'production' ? 'Production' : 'Sandbox',
        bundleId: product.appleProduct.bundleId
      },
      metadata: {
        purchaseSource: 'app_store',
        deviceId: req.body.deviceId,
        appVersion: req.body.appVersion,
        osVersion: req.body.osVersion
      }
    });

    // Update product statistics
    await InAppProduct.findByIdAndUpdate(product._id, {
      $inc: {
        'stats.totalPurchases': 1,
        'stats.activeSubscriptions': 1,
        'stats.totalRevenue': coachProfile.monthlyFee
      }
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      subscription: {
        id: subscription._id,
        platform: subscription.platform,
        monthlyFee: subscription.monthlyFee,
        currency: subscription.currency,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        sessionsPerMonth: subscription.sessionsPerMonth,
        paymentStatus: subscription.paymentStatus,
        receiptVerified: subscription.receiptVerified,
        autoRenewStatus: subscription.autoRenewStatus
      }
    });

  } catch (error) {
    console.error('Error verifying Apple receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Verify Google Play purchase and create subscription
exports.verifyGooglePurchase = async (req, res) => {
  try {
    const { purchaseToken, productId, orderId, userId, coachId, packageName } = req.body;

    // Validate required fields
    if (!purchaseToken || !productId || !userId || !coachId || !packageName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: purchaseToken, productId, userId, coachId, packageName'
      });
    }

    // TODO: Implement Google Play purchase verification
    // This would typically involve calling Google Play Developer API
    const isPurchaseValid = await verifyGooglePurchaseWithGoogle(purchaseToken, productId, packageName);

    if (!isPurchaseValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid purchase'
      });
    }

    // Get coach profile for fee information
    const coachProfile = await CoachProfile.findOne({ user: coachId });
    if (!coachProfile) {
      return res.status(404).json({
        success: false,
        message: 'Coach profile not found'
      });
    }

    // Get product information
    const product = await InAppProduct.findOne({ 'googleProduct.productId': productId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Create subscription
    const subscription = await UserSubscription.create({
      client: userId,
      coach: coachId,
      platform: 'android',
      monthlyFee: coachProfile.monthlyFee,
      currency: coachProfile.currency,
      startDate: new Date(),
      endDate: new Date(Date.now() + product.subscriptionDetails.duration * 24 * 60 * 60 * 1000),
      sessionsPerMonth: product.subscriptionDetails.sessionsPerMonth,
      paymentStatus: 'completed',
      receiptVerified: true,
      receiptVerifiedAt: new Date(),
      platformSubscriptionStatus: 'active',
      autoRenewStatus: product.subscriptionDetails.autoRenewable,
      googlePurchase: {
        purchaseToken,
        orderId,
        productId,
        packageName,
        purchaseTime: new Date(),
        purchaseState: 1, // 1 = purchased
        isAcknowledged: true,
        isAutoRenewing: product.subscriptionDetails.autoRenewable,
        purchaseType: 'subscription'
      },
      metadata: {
        purchaseSource: 'play_store',
        deviceId: req.body.deviceId,
        appVersion: req.body.appVersion,
        osVersion: req.body.osVersion
      }
    });

    // Update product statistics
    await InAppProduct.findByIdAndUpdate(product._id, {
      $inc: {
        'stats.totalPurchases': 1,
        'stats.activeSubscriptions': 1,
        'stats.totalRevenue': coachProfile.monthlyFee
      }
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      subscription: {
        id: subscription._id,
        platform: subscription.platform,
        monthlyFee: subscription.monthlyFee,
        currency: subscription.currency,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        sessionsPerMonth: subscription.sessionsPerMonth,
        paymentStatus: subscription.paymentStatus,
        receiptVerified: subscription.receiptVerified,
        autoRenewStatus: subscription.autoRenewStatus
      }
    });

  } catch (error) {
    console.error('Error verifying Google purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get user's active subscriptions
exports.getUserSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;

    const subscriptions = await UserSubscription.find({
      client: userId,
      isActive: true
    })
      .populate('coach', 'phone')
      .populate({
        path: 'coach',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    const activeSubscriptions = subscriptions.filter(sub => sub.isValid);

    res.status(200).json({
      success: true,
      count: activeSubscriptions.length,
      subscriptions: activeSubscriptions.map(sub => ({
        id: sub._id,
        coach: sub.coach,
        platform: sub.platform,
        monthlyFee: sub.monthlyFee,
        currency: sub.currency,
        startDate: sub.startDate,
        endDate: sub.endDate,
        sessionsPerMonth: sub.sessionsPerMonth,
        sessionsUsed: sub.sessionsUsed,
        paymentStatus: sub.paymentStatus,
        receiptVerified: sub.receiptVerified,
        autoRenewStatus: sub.autoRenewStatus,
        platformSubscriptionStatus: sub.platformSubscriptionStatus,
        isValid: sub.isValid
      }))
    });

  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Cancel in-app purchase subscription
exports.cancelInAppSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;

    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Update subscription status
    subscription.isActive = false;
    subscription.paymentStatus = 'cancelled';
    subscription.platformSubscriptionStatus = 'cancelled';
    subscription.notes = reason || 'Cancelled by user';
    await subscription.save();

    // Update product statistics
    const product = await InAppProduct.findOne({
      $or: [
        { 'appleProduct.productId': subscription.applePurchase?.productId },
        { 'googleProduct.productId': subscription.googlePurchase?.productId }
      ]
    });

    if (product) {
      await InAppProduct.findByIdAndUpdate(product._id, {
        $inc: { 'stats.activeSubscriptions': -1 }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: {
        id: subscription._id,
        isActive: subscription.isActive,
        paymentStatus: subscription.paymentStatus,
        platformSubscriptionStatus: subscription.platformSubscriptionStatus
      }
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get available products for a coach
exports.getCoachProducts = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { platform } = req.query; // 'ios', 'android', or both

    let query = { isActive: true };
    
    if (coachId) {
      query.$or = [
        { coach: coachId },
        { isGlobal: true }
      ];
    }

    if (platform) {
      if (platform === 'ios') {
        query['platformStatus.apple'] = 'active';
      } else if (platform === 'android') {
        query['platformStatus.google'] = 'active';
      }
    }

    const products = await InAppProduct.find(query)
      .populate('coach', 'phone')
      .populate({
        path: 'coach',
        populate: {
          path: 'additionalInfo',
          select: 'name email'
        }
      });

    res.status(200).json({
      success: true,
      count: products.length,
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        description: product.description,
        productType: product.productType,
        subscriptionDetails: product.subscriptionDetails,
        pricing: product.pricing,
        platformInfo: product.platformInfo,
        isAvailable: product.isAvailable,
        coach: product.coach,
        isGlobal: product.isGlobal,
        category: product.metadata?.category
      }))
    });

  } catch (error) {
    console.error('Error fetching coach products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// ===================== UTILITY FUNCTIONS =====================

// Verify Apple receipt with Apple's servers
async function verifyAppleReceiptWithApple(receiptData) {
  // TODO: Implement actual Apple receipt verification
  // This would involve:
  // 1. Sending receipt data to Apple's verification endpoint
  // 2. Checking the response for validity
  // 3. Verifying the product ID and transaction details
  
  // For now, return true (mock implementation)
  return true;
}

// Verify Google Play purchase with Google's servers
async function verifyGooglePurchaseWithGoogle(purchaseToken, productId, packageName) {
  // TODO: Implement actual Google Play purchase verification
  // This would involve:
  // 1. Using Google Play Developer API
  // 2. Verifying the purchase token
  // 3. Checking the product ID and package name
  
  // For now, return true (mock implementation)
  return true;
}