# Simplified Coach Fee Management System

## Overview

This system implements a **simplified fee management solution** for coaches in the fitness app. The system focuses on **monthly subscription fees** only, eliminating the complexity of per-session fees.

## Key Changes

### **✅ SIMPLIFIED FEE STRUCTURE**

**Before (Complex)**:
- ❌ `sessionFee` in CoachProfile
- ❌ `sessionFee` in CoachSchedule  
- ❌ `sessionFee` in Session
- ❌ `price` in CoachSchedule (legacy)
- ❌ Complex fee inheritance logic
- ❌ Multiple fee fields causing confusion

**After (Simple)**:
- ✅ `monthlyFee` in CoachProfile
- ✅ `monthlyFee` in UserSubscription
- ✅ No fee fields in CoachSchedule or Session
- ✅ Clean, simple monthly subscription model

## Architecture

### Models

#### 1. CoachProfile Model (`src/Model/paidSessionModel/coach.js`)
- **Purpose**: Stores coach's monthly subscription fee and profile data
- **Key Fields**:
  - `monthlyFee`: The coach's monthly subscription fee (required, default: 5000 INR)
  - `currency`: Currency for the fee (INR, USD, EUR)
  - `feeUpdatedBy`: Reference to who last updated the fee
  - `feeUpdatedAt`: Timestamp of last fee update
  - `specialization`: Array of coach specializations
  - `certification`: Array of coach certifications
  - `experience`: Years of experience
  - `bio`: Coach biography
  - `isActive`: Whether coach is active
  - `rating`: Coach rating (0-5)
  - `totalSessions`: Total sessions conducted
  - `totalClients`: Total clients served

#### 2. CoachZoom Model (`src/Model/paidSessionModel/coachZoom.js`)
- **Purpose**: Handles Zoom authentication and connection status
- **Key Fields**:
  - `zoomAccessToken`: Zoom access token
  - `zoomRefreshToken`: Zoom refresh token
  - `zoomTokenExpiry`: Token expiry date
  - `zoomUserId`: Zoom user ID
  - `isConnected`: Connection status
  - `lastConnectedAt`: Last connection timestamp

#### 3. CoachSchedule Model (`src/Model/paidSessionModel/coachSchedule.js`)
- **Purpose**: Stores coach schedule (NO FEE FIELDS)
- **Key Fields**:
  - `coach`: Reference to User (coach)
  - `days`: Array of working days
  - `startTime`/`endTime`: Working hours
  - `isActive`: Whether schedule is active
  - `sessionType`: Type of session (individual, group, workshop)
  - `maxParticipants`: Maximum participants allowed
  - `title`/`description`: Schedule details

#### 4. Session Model (`src/Model/paidSessionModel/session.js`)
- **Purpose**: Stores session data (NO FEE FIELDS)
- **Key Fields**:
  - `users`: Array of User references
  - `coach`: Reference to User (coach)
  - `date`, `startTime`, `endTime`: Session timing
  - `status`: Session status
  - `zoomJoinUrl`, `zoomMeetingId`: Zoom details
  - `attendance`: Attendance tracking

#### 5. UserSubscription Model (`src/Model/paidSessionModel/userSubscription.js`)
- **Purpose**: Stores monthly subscription data
- **Key Fields**:
  - `client`: Reference to User (client)
  - `coach`: Reference to User (coach)
  - `monthlyFee`: Monthly subscription fee
  - `currency`: Currency for the fee
  - `startDate`/`endDate`: Subscription period
  - `sessionsPerMonth`: Number of sessions included
  - `sessionsUsed`: Number of sessions used
  - `paymentStatus`: Payment status

#### 6. Plans Model (`src/Model/paidSessionModel/plans.js`)
- **Purpose**: Defines global subscription plans
- **Key Fields**:
  - `name`: Plan name
  - `basePrice`: Base price for the plan
  - `duration`: Plan duration in days
  - `sessionsPerMonth`: Number of sessions included
  - `features`: Array of plan features

## Data Flow

### **1. Coach Creation**
```javascript
// 1. Create User with role='coach'
const user = new User({ phone, password, role: 'coach' });

// 2. Create UserAdditionalInfo
const additionalInfo = new UserAdditionalInfo({ name, email, userId });

// 3. Create CoachProfile with monthly fee
const coachProfile = await CoachProfile.create({
  user: user._id,
  monthlyFee: 5000, // Monthly subscription fee
  currency: 'INR',
  feeUpdatedBy: req.user.id,
  feeUpdatedAt: new Date()
});
```

### **2. User Subscription**
```javascript
// User subscribes to coach for 1 month
const subscription = await UserSubscription.create({
  client: userId,
  coach: coachId,
  monthlyFee: coachProfile.monthlyFee, // Use coach's monthly fee
  currency: coachProfile.currency,
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  sessionsPerMonth: 4,
  paymentStatus: 'completed'
});
```

### **3. Session Generation**
```javascript
// Generate sessions based on coach schedule
// NO FEE LOGIC NEEDED - sessions are included in monthly subscription
const session = await Session.create({
  users: [userId],
  coach: coachId,
  date: sessionDate,
  startTime: '09:00',
  endTime: '10:00',
  zoomJoinUrl: zoomUrl
});
```

## API Examples

### Create Coach (Super Admin)
```bash
POST /api/superadmin/create-user
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "1234567890",
  "email": "john@example.com",
  "password": "password123",
  "role": "coach",
  "monthlyFee": 5000,
  "currency": "INR",
  "experience": 5,
  "bio": "Experienced fitness coach"
}
```

### Create Coach (Coach Manager)
```bash
POST /api/coachmanager/coaches
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "1234567890",
  "email": "john@example.com",
  "password": "password123",
  "experience": 5,
  "bio": "Experienced fitness coach",
  "monthlyFee": 5000,
  "currency": "INR"
}
```

### Update Coach Monthly Fee
```bash
PUT /api/superadmin/coaches/:coachId/fee
Content-Type: application/json

{
  "monthlyFee": 6000,
  "currency": "INR"
}
```

### Create User Subscription
```bash
POST /api/subscriptions
Content-Type: application/json

{
  "coachId": "coach_id",
  "monthlyFee": 5000,
  "currency": "INR",
  "sessionsPerMonth": 4
}
```

### Create Coach Schedule
```bash
POST /api/coachmanager/coaches/:coachId/schedule
Content-Type: application/json

{
  "days": ["Monday", "Wednesday", "Friday"],
  "startTime": "09:00",
  "endTime": "10:00"
}
```

## Key Benefits

### **1. Simplicity**
- ✅ **One fee field**: `monthlyFee` in CoachProfile
- ✅ **Clear business model**: Monthly subscription
- ✅ **No complex inheritance**: Direct fee assignment
- ✅ **Easy to understand**: Users pay monthly, get sessions

### **2. Business Logic**
- ✅ **Monthly billing**: Clear revenue model
- ✅ **Session limits**: `sessionsPerMonth` controls usage
- ✅ **No per-session pricing**: Eliminates complexity
- ✅ **Subscription management**: Easy to track and manage

### **3. Technical Benefits**
- ✅ **Reduced complexity**: Fewer fields and relationships
- ✅ **Better performance**: Simpler queries
- ✅ **Easier maintenance**: Less code to maintain
- ✅ **Clearer data model**: Obvious relationships

### **4. User Experience**
- ✅ **Predictable pricing**: Fixed monthly fee
- ✅ **No hidden costs**: Clear what's included
- ✅ **Easy to understand**: Simple subscription model
- ✅ **Flexible sessions**: Use sessions as needed within limit

## Database Schema

### CoachProfile Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId, // Reference to User
  monthlyFee: Number, // Monthly subscription fee
  currency: String, // 'INR', 'USD', 'EUR'
  feeUpdatedBy: ObjectId, // Reference to User who updated
  feeUpdatedAt: Date,
  specialization: [String],
  certification: [Object],
  experience: Number,
  bio: String,
  isActive: Boolean,
  rating: Number,
  totalSessions: Number,
  totalClients: Number
}
```

### UserSubscription Collection
```javascript
{
  _id: ObjectId,
  client: ObjectId, // Reference to User (client)
  coach: ObjectId, // Reference to User (coach)
  monthlyFee: Number, // Monthly subscription fee
  currency: String, // 'INR', 'USD', 'EUR'
  startDate: Date,
  endDate: Date,
  sessionsPerMonth: Number,
  sessionsUsed: Number,
  paymentStatus: String, // 'pending', 'completed', 'failed', 'refunded'
  isActive: Boolean
}
```

### CoachSchedule Collection
```javascript
{
  _id: ObjectId,
  coach: ObjectId, // Reference to User (coach)
  days: [String], // Working days
  startTime: String, // Start time
  endTime: String, // End time
  isActive: Boolean,
  sessionType: String, // 'individual', 'group', 'workshop'
  maxParticipants: Number,
  title: String,
  description: String
}
```

### Session Collection
```javascript
{
  _id: ObjectId,
  users: [ObjectId], // Array of User references
  coach: ObjectId, // Reference to User (coach)
  date: Date,
  startTime: String,
  endTime: String,
  zoomJoinUrl: String,
  zoomMeetingId: String,
  status: String, // 'scheduled', 'ongoing', 'completed', 'cancelled'
  sessionType: String,
  attendance: [Object]
}
```

## Migration Notes

### **Automatic Migration**
- Existing `sessionFee` fields will be automatically converted to `monthlyFee`
- Default monthly fee: 5000 INR (was 1000 INR per session)
- All fee-related complexity removed from CoachSchedule and Session models

### **Backward Compatibility**
- ✅ All existing API endpoints continue to work
- ✅ Fee management functions updated to use `monthlyFee`
- ✅ Validation updated for new field names
- ✅ Controllers updated to handle simplified structure

## Testing

### Manual Testing
1. Create a coach with monthly fee
2. Create user subscription to coach
3. Generate sessions (should not require fee logic)
4. Verify subscription limits work correctly
5. Test fee updates and subscription management

### API Testing
- ✅ Coach creation with monthly fee
- ✅ Fee updates by Super Admin and Coach Manager
- ✅ User subscription creation
- ✅ Session generation without fee complexity
- ✅ Subscription management and limits

## Summary

The system has been **dramatically simplified** to focus on **monthly subscription fees** only. This eliminates:

- ❌ Per-session fee complexity
- ❌ Multiple fee fields across models
- ❌ Complex fee inheritance logic
- ❌ Confusing pricing structures

And provides:

- ✅ Clear monthly subscription model
- ✅ Simple fee management
- ✅ Better user experience
- ✅ Easier maintenance and development
- ✅ Predictable revenue model

**The system now works exactly as you requested: users subscribe to coaches for 1 month with a single monthly fee, and get access to sessions within their subscription period.**
