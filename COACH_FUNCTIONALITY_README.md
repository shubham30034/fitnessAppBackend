# Coach Functionality - Fitness App

## Overview

The Coach functionality provides comprehensive tools for coaches to manage their profiles, sessions, clients, and analytics. This includes dashboard, profile management, session handling, client management, and performance analytics.

## Features

### 🏋️ Profile Management
- **View Profile**: Get complete coach profile with statistics
- **Update Profile**: Modify name, email, bio, and experience
- **Profile Statistics**: View active subscriptions, total sessions, and monthly performance

### 📊 Dashboard & Analytics
- **Coach Dashboard**: Comprehensive overview with key metrics
- **Performance Analytics**: Monthly trends and client retention data
- **Revenue Tracking**: Estimated revenue based on active subscriptions
- **Session Statistics**: Today's sessions, upcoming sessions, and total conducted

### 👥 Client Management
- **View All Clients**: List of all active clients
- **Client Details**: Individual client information and session history
- **Client Analytics**: Track client engagement and session attendance

### 📅 Session Management
- **Session Details**: View complete session information
- **Session Cancellation**: Cancel future sessions with reason
- **Upcoming Sessions**: View scheduled sessions for next 7 days
- **Session History**: Track all conducted sessions

### 🔔 Notifications
- **Today's Sessions**: Count of today's scheduled sessions
- **New Subscriptions**: Recent client subscriptions
- **Upcoming Sessions**: Sessions in next 24 hours

## API Endpoints

### Authentication
Coaches use the same login endpoint as other roles:
```
POST /api/v1/coach-seller/login
```

### Profile Management Endpoints

#### Get Coach Profile
```
GET /api/v1/coaching/coach/profile
```
**Response:**
```json
{
  "success": true,
  "coach": {
    "_id": "coach_id",
    "phone": "9876543210",
    "role": "coach",
    "additionalInfo": {
      "name": "John Doe",
      "email": "john@example.com",
      "bio": "Certified personal trainer",
      "experience": "5 years"
    },
    "schedule": {
      "days": ["Monday", "Wednesday", "Friday"],
      "startTime": "09:00",
      "endTime": "10:00"
    },
    "stats": {
      "activeSubscriptions": 15,
      "totalSessions": 120,
      "thisMonthSessions": 8
    }
  }
}
```

#### Update Coach Profile
```
PUT /api/v1/coaching/coach/profile
```
**Body:**
```json
{
  "name": "John Doe Updated",
  "email": "john.updated@example.com",
  "bio": "Updated bio information",
  "experience": "6 years of experience"
}
```

### Dashboard Endpoints

#### Get Coach Dashboard
```
GET /api/v1/coaching/coach/dashboard
```
**Response:**
```json
{
  "success": true,
  "dashboard": {
    "stats": {
      "activeSubscriptions": 15,
      "totalSessions": 120,
      "thisMonthSessions": 8,
      "todaysSessions": 2,
      "estimatedRevenue": 15000
    },
    "upcomingSessions": [
      {
        "date": "Mon Dec 16 2024",
        "time": "09:00 - 10:00",
        "clientCount": 3
      }
    ],
    "recentClients": [
      {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "subscriptionDate": "2024-12-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Get Coach Analytics
```
GET /api/v1/coaching/coach/analytics
```
**Response:**
```json
{
  "success": true,
  "analytics": {
    "summary": {
      "totalSubscriptions": 25,
      "activeSubscriptions": 15,
      "totalSessions": 120,
      "retentionRate": 60.0,
      "totalEstimatedRevenue": 25000
    },
    "monthlyData": [
      {
        "month": "December 2024",
        "newSubscriptions": 3,
        "sessionsConducted": 8,
        "estimatedRevenue": 3000
      }
    ]
  }
}
```

### Session Management Endpoints

#### Get Session Details
```
GET /api/v1/coaching/coach/sessions/:sessionId
```
**Response:**
```json
{
  "success": true,
  "session": {
    "id": "session_id",
    "date": "Mon Dec 16 2024",
    "time": "09:00 - 10:00",
    "zoomJoinUrl": "https://zoom.us/j/123456789",
    "zoomMeetingId": "123456789",
    "clients": [
      {
        "id": "client_id",
        "name": "Jane Smith",
        "email": "jane@example.com"
      }
    ]
  }
}
```

#### Cancel Session
```
DELETE /api/v1/coaching/coach/sessions/:sessionId
```
**Body:**
```json
{
  "reason": "Emergency cancellation"
}
```

### Client Management Endpoints

#### Get All Clients
```
GET /api/v1/coaching/coach/clients
```
**Response:**
```json
{
  "success": true,
  "message": "Clients retrieved successfully.",
  "count": 15,
  "clients": [
    {
      "subscriptionId": "subscription_id",
      "client": {
        "_id": "client_id",
        "phone": "9876543210",
        "additionalInfo": {
          "name": "Jane Smith",
          "email": "jane@example.com"
        }
      }
    }
  ]
}
```

#### Get Client Details
```
GET /api/v1/coaching/coach/clients/:clientId
```
**Response:**
```json
{
  "success": true,
  "client": {
    "id": "client_id",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "9876543210",
    "subscriptionStart": "2024-12-01T00:00:00.000Z",
    "subscriptionEnd": "2025-01-01T00:00:00.000Z",
    "recentSessions": [
      {
        "date": "Mon Dec 16 2024",
        "time": "09:00 - 10:00"
      }
    ]
  }
}
```

### Schedule Management Endpoints

#### Get Coach Schedule
```
GET /api/v1/coaching/coach/schedule
```
**Response:**
```json
{
  "success": true,
  "message": "Schedule retrieved successfully.",
  "schedule": {
    "days": ["Monday", "Wednesday", "Friday"],
    "startTime": "09:00",
    "endTime": "10:00"
  }
}
```

#### Get Upcoming Sessions
```
GET /api/v1/coaching/coach/upcoming-sessions
```
**Response:**
```json
{
  "success": true,
  "count": 5,
  "sessions": [
    {
      "date": "Mon Dec 16 2024",
      "time": "09:00 - 10:00",
      "join_url": "https://zoom.us/j/123456789",
      "clients": [
        {
          "name": "Jane Smith",
          "email": "jane@example.com"
        }
      ]
    }
  ]
}
```

### Notification Endpoints

#### Get Coach Notifications
```
GET /api/v1/coaching/coach/notifications
```
**Response:**
```json
{
  "success": true,
  "notifications": {
    "todaysSessions": 2,
    "newSubscriptions": 1,
    "upcomingSessions": 3,
    "hasNotifications": true
  }
}
```

## Data Models

### Coach Profile Structure
```javascript
{
  _id: ObjectId,
  phone: String,
  role: 'coach',
  additionalInfo: {
    name: String,
    email: String,
    bio: String,
    experience: String,
    profilePicture: String
  },
  schedule: {
    days: [String],
    startTime: String,
    endTime: String
  },
  stats: {
    activeSubscriptions: Number,
    totalSessions: Number,
    thisMonthSessions: Number
  }
}
```

### Dashboard Data Structure
```javascript
{
  stats: {
    activeSubscriptions: Number,
    totalSessions: Number,
    thisMonthSessions: Number,
    todaysSessions: Number,
    estimatedRevenue: Number
  },
  upcomingSessions: [{
    date: String,
    time: String,
    clientCount: Number
  }],
  recentClients: [{
    name: String,
    email: String,
    subscriptionDate: Date
  }]
}
```

### Analytics Data Structure
```javascript
{
  summary: {
    totalSubscriptions: Number,
    activeSubscriptions: Number,
    totalSessions: Number,
    retentionRate: Number,
    totalEstimatedRevenue: Number
  },
  monthlyData: [{
    month: String,
    newSubscriptions: Number,
    sessionsConducted: Number,
    estimatedRevenue: Number
  }]
}
```

## Security

- All endpoints require authentication
- Coach role verification on all routes
- Input validation for all data
- Protection against unauthorized access
- Session ownership verification

## Error Handling

The API includes comprehensive error handling:
- Validation errors with detailed messages
- Authorization errors for unauthorized access
- Not found errors for missing resources
- Server errors with appropriate status codes

## Testing

Test the Coach functionality:

1. **Login as a coach**
2. **View profile and dashboard**
3. **Update profile information**
4. **View analytics and notifications**
5. **Manage sessions and clients**

## Integration with Other Roles

### Coach Manager Integration
- Coach Managers can view all coach data
- Coach Managers can manage coach schedules
- Coach Managers can access coach analytics

### Super Admin Integration
- Super Admins have complete access to all coach data
- Super Admins can force delete coaches
- Super Admins can view system-wide coach analytics

## Future Enhancements

Potential future features:
- Real-time chat with clients
- Session recording and playback
- Advanced analytics and reporting
- Payment integration for coaches
- Client progress tracking
- Automated session reminders
- Coach rating and review system
