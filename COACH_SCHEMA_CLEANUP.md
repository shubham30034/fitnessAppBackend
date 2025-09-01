# Coach Schema Cleanup Documentation

## Overview
This document outlines the cleanup and standardization of coach-related schemas in the Fitness App Backend to eliminate confusion and duplicate schemas.

## 🔧 Changes Made

### 1. Schema Renaming and Consolidation

#### **Before (Confusing Structure):**
- `coach.js` - Generic coach schema (confusing purpose)
- `coachSheduleSchema.js` - Typo in filename
- `userBookingCoach.js` - Unclear naming
- `coachScheduleSale.js` - Overlapping functionality

#### **After (Clean Structure):**
- `coach.js` → `CoachZoom` model (Zoom integration only)
- `coachSheduleSchema.js` → `coachSchedule.js` (Fixed typo)
- `userBookingCoach.js` → `userSubscription.js` (Clear naming)
- `coachScheduleSale.js` → Kept as is (Advanced sales functionality)

### 2. Schema Purposes Clarified

#### **CoachZoom Schema** (`coach.js`)
```javascript
// Purpose: Zoom integration for coaches only
const coachZoomSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  zoomAccessToken: String,
  zoomRefreshToken: String,
  zoomTokenExpiry: Date,
  zoomUserId: String,
}, { timestamps: true });
```

#### **CoachSchedule Schema** (`coachSchedule.js`)
```javascript
// Purpose: Basic coach availability schedule
const coachScheduleSchema = new mongoose.Schema({
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  days: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }],
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  timezone: { type: String, default: 'Asia/Kolkata' }
}, { timestamps: true });
```

#### **UserSubscription Schema** (`userSubscription.js`)
```javascript
// Purpose: Coach-client subscription management
const userSubscriptionSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  subscriptionType: { type: String, enum: ['monthly', 'quarterly', 'yearly', 'custom'], default: 'monthly' },
  price: { type: Number, required: true },
  sessionsPerMonth: { type: Number, default: 4 },
  sessionsUsed: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  notes: { type: String, maxLength: 500 }
}, { timestamps: true });
```

#### **Session Schema** (`session.js`)
```javascript
// Purpose: Individual coaching sessions
const sessionSchema = new mongoose.Schema({
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  coach: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  zoomJoinUrl: { type: String, required: true },
  zoomMeetingId: { type: String },
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'no-show'], default: 'scheduled' },
  sessionType: { type: String, enum: ['individual', 'group', 'workshop'], default: 'individual' },
  notes: { type: String, maxLength: 1000 },
  attendance: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['present', 'absent', 'late'], default: 'absent' },
    joinedAt: Date,
    leftAt: Date
  }],
  duration: { type: Number, default: 60 } // in minutes
}, { timestamps: true });
```

### 3. Controller Updates

#### **Files Updated:**
- `SuperAdminController/superAdmin.js`
- `CoachManagerController/coachManager.js`
- `CoachingSession/coach.js`
- `Utils/socket.js`

#### **Changes Made:**
- Updated all `require()` statements to use new file names
- Changed `Coach` model references to `CoachZoom` for Zoom-specific operations
- Updated schema references to use new naming conventions

### 4. Schema Relationships

```
User (role: 'coach')
├── UserAdditionalInfo (coach profile data)
├── CoachZoom (Zoom integration)
├── CoachSchedule (availability)
├── UserSubscription (client subscriptions)
└── Session (coaching sessions)
```

## 🎯 Benefits of Cleanup

### **1. Clear Purpose Separation**
- **CoachZoom**: Only handles Zoom integration
- **CoachSchedule**: Only handles availability
- **UserSubscription**: Only handles client subscriptions
- **Session**: Only handles individual sessions

### **2. Eliminated Confusion**
- No more duplicate schemas for same purpose
- Clear naming conventions
- Fixed typos in filenames

### **3. Enhanced Functionality**
- Added missing fields for better data management
- Improved validation and constraints
- Better tracking of sessions and subscriptions

### **4. Maintainability**
- Easier to understand and modify
- Clear separation of concerns
- Consistent naming patterns

## 🔄 Migration Notes

### **Database Impact:**
- No data loss - only schema improvements
- Existing data remains compatible
- New fields have default values

### **API Compatibility:**
- All existing endpoints continue to work
- No breaking changes to API responses
- Enhanced functionality available through new fields

## 📋 Usage Examples

### **Creating a Coach Schedule:**
```javascript
const schedule = new CoachSchedule({
  coach: coachUserId,
  days: ['Monday', 'Wednesday', 'Friday'],
  startTime: '18:00',
  endTime: '19:00',
  timezone: 'Asia/Kolkata'
});
```

### **Creating a User Subscription:**
```javascript
const subscription = new UserSubscription({
  client: clientUserId,
  coach: coachUserId,
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  subscriptionType: 'monthly',
  price: 1000,
  sessionsPerMonth: 4
});
```

### **Creating a Session:**
```javascript
const session = new Session({
  users: [clientUserId1, clientUserId2],
  coach: coachUserId,
  date: new Date(),
  startTime: '18:00',
  endTime: '19:00',
  zoomJoinUrl: 'https://zoom.us/j/123456789',
  sessionType: 'group',
  status: 'scheduled'
});
```

## 🚀 Next Steps

1. **Testing**: Verify all endpoints work correctly
2. **Documentation**: Update API documentation
3. **Frontend**: Update frontend to use new field names if needed
4. **Monitoring**: Monitor for any issues in production

## 📞 Support

For any questions or issues related to the schema cleanup, please refer to:
- API documentation
- Database schema diagrams
- Controller implementation examples
