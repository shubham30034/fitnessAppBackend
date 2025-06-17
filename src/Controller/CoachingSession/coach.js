const axios = require("axios");
const cron = require("node-cron");
const CoachSchedule = require("../../Model/paidSessionModel/coachSheduleSchema");
const UserSubscription = require("../../Model/paidSessionModel/userBookingCoach");
const Coach = require("../../Model/paidSessionModel/coach");
const Session = require("../../Model/paidSessionModel/session");

// Helper: calculate duration in minutes from HH:mm format
function calculateDuration(startTime, endTime) {
  const [startH, startM] = startTime.split(":" ).map(Number);
  const [endH, endM] = endTime.split(":" ).map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}


// Helper: Get a valid Zoom token (refresh if expired)
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

  try {
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
  } catch (err) {
    console.error("Zoom token refresh failed:", err.response?.data || err.message);
    throw new Error("Zoom token refresh failed. Please reconnect your Zoom account.");
  }
}

// get list of all coaches

exports.getAllCoaches = async (req, res) => {
  try {
    const scheduledCoaches = await CoachSchedule.find().distinct("coach");

    if (!scheduledCoaches.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        coaches: [],
      });
    }

    const coaches = await Coach.find({ user: { $in: scheduledCoaches } }).populate({
      path: "user",
      populate: { path: "additionalInfo" },
    });

    const formattedCoaches = coaches.map(coach => {
      const user = coach.user || {};
      const info = user.additionalInfo || {};

      return {
        id: coach._id,
        phone: user.phone || null,
        role: user.role || null,
        zoomConnected: !!coach.zoomUserId,
        name: info.name || null,
        coachEmail: info.email || null, // clearer naming
        userId: info.userId || null,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedCoaches.length,
      coaches: formattedCoaches,
    });

  } catch (err) {
    console.error("Error fetching scheduled coaches:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};




// get coach by id

exports.getCoachById = async (req, res) => {
  try {
    const coachId = req.params.coachId;
    console.log("Fetching coach with ID:", coachId);

    const coach = await Coach.findById(coachId).populate({
      path: "user",
      populate: { path: "additionalInfo" },
    });

    if (!coach || !coach.user) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const user = coach.user;
    const info = user.additionalInfo || {};

    res.status(200).json({
      success: true,
      coach: {
        id: coach._id,
        phone: user.phone || null,
        role: user.role || null,
        zoomConnected: !!coach.zoomUserId,
        name: info.name || null,
        coachEmail: info.email || null,
        userId: info.userId || null,
      },
    });
  } catch (err) {
    console.error("Error fetching coach:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};







// ========== SUBSCRIBE TO COACH ==========
exports.subscribeToCoach = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.body;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const existing = await UserSubscription.findOne({ user: userId, coach: coachId, isActive: true });
    if (existing) {
      return res.status(400).json({ success: false, message: "Already subscribed" });
    }

    const subscription = await UserSubscription.create({ user: userId, coach: coachId, startDate, endDate, isActive: true });

    res.status(201).json({ success: true, message: "Subscribed successfully", subscription });
  } catch (err) {
    console.error("Subscription error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ========== GET TODAY'S SESSION ==========
exports.getTodaysSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

    const subscription = await UserSubscription.findOne({
      user: userId,
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

    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const session = await Session.findOne({
      user: userId,
      coach: subscription.coach,
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

// ========== DAILY CRON JOB FOR ZOOM SESSION GENERATION ==========
cron.schedule("0 6 * * *", async () => {
  try {
    console.log("Cron job started: Creating Zoom sessions...");
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

      for (const sub of subscriptions) {
        const existingSession = await Session.findOne({ user: sub.user, coach: sub.coach, date: targetDate });
        if (existingSession) continue;

        const schedule = await CoachSchedule.findOne({ coach: sub.coach });
        if (!schedule || !schedule.days.includes(dayName)) continue;

        const coach = await Coach.findOne({ user: sub.coach });
        if (!coach || !coach.zoomRefreshToken || !coach.zoomUserId) continue;

        const [startH, startM] = schedule.startTime.split(":" ).map(Number);
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

        const zoomRes = await axios.post(
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

        await Session.create({
          user: sub.user,
          coach: sub.coach,
          date: targetDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          zoomJoinUrl: zoomRes.data.join_url,
          zoomMeetingId: zoomRes.data.id,
        });

        console.log(`Created Zoom session for user ${sub.user} with coach ${sub.coach} on ${targetDate.toDateString()}`);
      }
    }
    console.log("Cron job completed.");
  } catch (err) {
    console.error("Cron job error:", err.response?.data || err);
  }
});

// ========== COACH VIEW: UPCOMING SESSIONS ==========
exports.getUpcomingCoachSessions = async (req, res) => {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const coachRecord = await Coach.findOne({ user: req.user.id });
    if (!coachRecord) return res.status(403).json({ success: false, message: 'Coach profile not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await Session.find({ coach: coachRecord.user, date: { $gte: today } }).populate("user", "name email");

    res.status(200).json({
      success: true,
      count: sessions.length,
      sessions: sessions.map(session => ({
        userName: session.user.name,
        userEmail: session.user.email,
        date: session.date.toDateString(),
        time: `${session.startTime} - ${session.endTime}`,
        join_url: session.zoomJoinUrl,
      })),
    });
  } catch (err) {
    console.error("Error fetching coach sessions:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ========== GET COACH SCHEDULE ==========
exports.getCoachSchedule = async (req, res) => {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const coachRecord = await Coach.findOne({ user: req.user.id });
    if (!coachRecord) return res.status(403).json({ success: false, message: 'Coach profile not found' });

    const schedule = await CoachSchedule.findOne({ coach: coachRecord.user });
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });

    res.status(200).json({
      success: true,
      schedule: {
        days: schedule.days,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
    });
  } catch (err) {
    console.error("Error fetching coach schedule:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};



exports.getMyClients = async (req, res) => {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const coachRecord = await Coach.findOne({ user: req.user.id });
    if (!coachRecord) {
      return res.status(403).json({ success: false, message: 'Coach profile not found' });
    }

    const clients = await UserSubscription.find({ coach: coachRecord.user, isActive: true })
      .populate({
        path: "user",
        select: "phone role additionalInfo",
        populate: {
          path: "additionalInfo",
          select: "name email",
        },
      });

    res.status(200).json({
      success: true,
      count: clients.length,
      clients: clients.map(client => ({
        id: client.user._id,
        phone: client.user.phone,
        role: client.user.role,
        name: client.user.additionalInfo?.name || null,
        email: client.user.additionalInfo?.email || null,
      })),
    });
  } catch (err) {
    console.error("Error fetching clients:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};









// ========== ZOOM AUTHENTICATION FLOW ==========


exports.connectZoom = (req, res) => {
  const { userId } = req.query; // <- get userId from query
  console.log("Connecting Zoom for user:", userId);
  const redirectUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${process.env.ZOOM_CLIENT_ID}&redirect_uri=${process.env.ZOOM_REDIRECT_URI}&state=${userId}`;
  res.redirect(redirectUrl);
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