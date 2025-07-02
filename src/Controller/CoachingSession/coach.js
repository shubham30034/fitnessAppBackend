const axios = require("axios");
const cron = require("node-cron");
const CoachSchedule = require("../../Model/paidSessionModel/coachSheduleSchema");
const UserSubscription = require("../../Model/paidSessionModel/userBookingCoach");
const Coach = require("../../Model/paidSessionModel/coach");
const Session = require("../../Model/paidSessionModel/session");
const User = require("../../Model/userModel/userModel");



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

exports.subscribeToCoach = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.body;

    // 1. Validate coach
    const coachUser = await User.findOne({ _id: coachId, role: "coach" });
    if (!coachUser) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    // 2. Ensure coach has a schedule
    const coachSchedule = await CoachSchedule.findOne({
      coach: coachId,
      days: { $exists: true, $ne: [] },
      startTime: { $exists: true },
      endTime: { $exists: true },
    });

    if (!coachSchedule) {
      return res.status(400).json({ success: false, message: "Coach has no active schedule" });
    }

    // 3. Prevent duplicate subscription
    const existing = await UserSubscription.findOne({
      client: userId,
      coach: coachId,
      isActive: true,
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "Already subscribed" });
    }

    // 4. Set start and end dates (truncate startDate to midnight)
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // 👈 ensure startDate matches session date logic

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // 5. Create subscription
    const subscription = await UserSubscription.create({
      client: userId,
      coach: coachId,
      startDate,
      endDate,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Subscribed successfully. Sessions will be scheduled soon.",
      subscription,
    });
  } catch (err) {
    console.error("❌ Subscription error:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

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

    const schedule = await CoachSchedule.findOne({ coach: coachRecord._id }).select('days startTime endTime');
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
// cron.schedule("0 6 * * *", async () => {
//   try {
//     console.log("⏰ Cron job started: Zoom session generation...");

//     // Auto-delete sessions older than 60 days
//     const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
//     const deleteResult = await Session.deleteMany({ date: { $lt: twoMonthsAgo } });
//     console.log(`🧹 Deleted ${deleteResult.deletedCount} old sessions`);

//     const today = new Date();

//     for (let i = 0; i < 3; i++) {
//       const targetDate = new Date(today);
//       targetDate.setDate(today.getDate() + i);
//       targetDate.setHours(0, 0, 0, 0);
//       const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });

//       const subscriptions = await UserSubscription.find({
//         isActive: true,
//         startDate: { $lte: targetDate },
//         endDate: { $gte: targetDate },
//       });

//       const processedCoaches = new Set();

//       for (const sub of subscriptions) {
//         const coachId = sub.coach.toString();
//         if (processedCoaches.has(coachId)) continue;
//         processedCoaches.add(coachId);

//         const schedule = await CoachSchedule.findOne({ coach: sub.coach });
//         if (!schedule || !schedule.days.includes(dayName)) continue;

//         const existing = await Session.findOne({ coach: sub.coach, date: targetDate });
//         if (existing) continue;

//         const coach = await Coach.findOne({ user: sub.coach });
//         if (!coach || !coach.zoomRefreshToken || !coach.zoomUserId) continue;

//         const [startH, startM] = schedule.startTime.split(":").map(Number);
//         const meetingStart = new Date(targetDate);
//         meetingStart.setHours(startH, startM, 0, 0);

//         const duration = calculateDuration(schedule.startTime, schedule.endTime);

//         let zoomToken;
//         try {
//           zoomToken = await getValidZoomToken(coach.user);
//         } catch (err) {
//           console.error(`Zoom token refresh failed for coach ${coach.user}`, err);
//           continue;
//         }

//         let zoomRes;
//         try {
//           zoomRes = await axios.post(
//             `https://api.zoom.us/v2/users/${coach.zoomUserId}/meetings`,
//             {
//               topic: "Fitness Coaching Session",
//               type: 2,
//               start_time: meetingStart.toISOString(),
//               duration,
//               settings: { join_before_host: true },
//             },
//             {
//               headers: {
//                 Authorization: `Bearer ${zoomToken}`,
//                 "Content-Type": "application/json",
//               },
//             }
//           );
//         } catch (err) {
//           console.error(`Zoom meeting creation failed for coach ${coach.user}`, err.response?.data || err);
//           continue;
//         }

//         const clients = await UserSubscription.find({
//           coach: sub.coach,
//           isActive: true,
//           startDate: { $lte: targetDate },
//           endDate: { $gte: targetDate },
//         }).select("client");

//         for (const client of clients) {
//           try {
//             await Session.create({
//               user: client.client,
//               coach: sub.coach,
//               date: targetDate,
//               startTime: schedule.startTime,
//               endTime: schedule.endTime,
//               zoomJoinUrl: zoomRes.data.join_url,
//               zoomMeetingId: zoomRes.data.id,
//             });

//             console.log(`✅ Created session for user ${client.client} with coach ${sub.coach} on ${targetDate.toDateString()}`);
//           } catch (err) {
//             console.error(`❌ Failed to create session for user ${client.client}`, err.message || err);
//           }
//         }
//       }
//     }

//     console.log("✅ Zoom session cron job completed.");
//   } catch (err) {
//     console.error("🔥 Cron job critical error:", err?.response?.data || err);
//   }
// });


// Helper: calculate duration in minutes
function calculateDuration(startTime, endTime) {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

// Helper: Get valid Zoom token, refresh if expired
async function getValidZoomToken(userId) {
  const coach = await Coach.findOne({ user: userId });
  if (!coach) throw new Error("Coach not found");

  const now = new Date();
  if (coach.zoomTokenExpiry && coach.zoomTokenExpiry > now) {
    return coach.zoomAccessToken;
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
  coach.zoomAccessToken = access_token;
  coach.zoomRefreshToken = refresh_token;
  coach.zoomTokenExpiry = new Date(Date.now() + expires_in * 1000);
  await coach.save();

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

      const coach = await Coach.findOne({ user: sub.coach });
      if (!coach || !coach.zoomRefreshToken || !coach.zoomUserId) {
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

 const updateAuth = await Coach.findOneAndUpdate(
  { user: userId },
  {
    user: userId, // required for upsert to create new doc
    zoomAccessToken: access_token,
    zoomRefreshToken: refresh_token,
    zoomTokenExpiry: new Date(Date.now() + expires_in * 1000),
    zoomUserId,
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
  const coach = await Coach.findOne({ user: req.user.id });
  if (!coach || !coach.zoomUserId) {
    return res.status(200).json({ connected: false });
  }
  res.status(200).json({ connected: true });
};



// ========== ZOOM DISCONNECT FLOW ==========
exports.disconnectZoom = async (req, res) => {
  try {
    const { id: userId } = req.user;

    const coach = await Coach.findOne({ user: userId });
    if (!coach || !coach.zoomAccessToken) {
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

  const updateAuth = await Coach.findOneAndUpdate(
      { user: userId },
      {
        $unset: {
          zoomAccessToken: "",
          zoomRefreshToken: "",
          zoomTokenExpiry: "",
          zoomUserId: "",
        },
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