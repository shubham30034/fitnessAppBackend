# Coach Manager Role - Fitness App

## Overview

The Coach Manager is a new role that has been added to the Fitness App to manage coaches, their students, and financial data. This role sits between the Super Admin and regular coaches, providing specialized management capabilities.

## Features

### 🏋️ Coach Management
- **Create Coaches**: Add new coaches to the system with full profile information
- **View All Coaches**: See a comprehensive list of all coaches with their details
- **Update Coach Information**: Modify coach profiles, experience, and bio
- **Delete Coaches**: Remove coaches (only if they have no active subscriptions)
- **Manage Coach Schedules**: Set and update coaching schedules

### 👥 Student Management
- **View Coach Students**: See all students for a specific coach
- **View All Students**: Get a complete overview of all students across all coaches
- **Student Details**: Access student information including subscription dates

### 💰 Financial Management
- **Financial Overview**: Get comprehensive financial data for all coaches
- **Coach Financial Data**: Detailed financial breakdown for individual coaches
- **Revenue Tracking**: Track estimated revenue based on active subscriptions
- **Monthly Analytics**: View financial trends over the last 6 months

## API Endpoints

### Authentication
Both Super Admins and Coach Managers use the same login endpoint:
```
POST /api/v1/coach-seller/login
```

### Super Admin Endpoints
Super Admins can access **ALL** endpoints including:

#### System Overview
```
GET /api/v1/superadmin/system/overview
```

#### Coach Management (Enhanced)
```
GET /api/v1/superadmin/coaches
GET /api/v1/superadmin/coaches/:coachId
DELETE /api/v1/superadmin/coaches/:coachId/force  ← Force delete with active subscriptions
```

#### Student Management
```
GET /api/v1/superadmin/students
```

#### Financial Management
```
GET /api/v1/superadmin/financial/overview
GET /api/v1/superadmin/coaches/:coachId/financial
GET /api/v1/superadmin/sellers/financial
GET /api/v1/superadmin/sellers/:sellerId/financial
GET /api/v1/superadmin/financial/comprehensive
GET /api/v1/superadmin/sellers/analytics
```

#### User Management
```
POST /api/v1/superadmin/create-user
GET /api/v1/superadmin/users
DELETE /api/v1/superadmin/user/:id
```

#### Product & Order Management
```
GET /api/v1/superadmin/invoices
GET /api/v1/superadmin/officials
```

### Coach Manager Endpoints

#### Create Coach
```
POST /api/v1/coach-manager/coaches
```
**Body:**
```json
{
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "password": "password123",
  "experience": "5 years of fitness coaching",
  "bio": "Certified personal trainer specializing in strength training"
}
```

#### Get All Coaches
```
GET /api/v1/coach-manager/coaches
```

#### Get Coach by ID
```
GET /api/v1/coach-manager/coaches/:coachId
```

#### Update Coach
```
PUT /api/v1/coach-manager/coaches/:coachId
```
**Body:**
```json
{
  "name": "John Doe Updated",
  "email": "john.updated@example.com",
  "experience": "6 years of fitness coaching",
  "bio": "Updated bio information"
}
```

#### Delete Coach
```
DELETE /api/v1/coach-manager/coaches/:coachId
```

### Student Management Endpoints

#### Get Coach Students
```
GET /api/v1/coach-manager/coaches/:coachId/students
```

#### Get All Students
```
GET /api/v1/coach-manager/students
```

### Financial Management Endpoints

#### Get Financial Overview
```
GET /api/v1/coach-manager/financial/overview
```

#### Get Coach Financial Data
```
GET /api/v1/coach-manager/coaches/:coachId/financial
```

### Schedule Management Endpoints

#### Create/Update Coach Schedule
```
POST /api/v1/coach-manager/coaches/:coachId/schedule
```
**Body:**
```json
{
  "days": ["Monday", "Wednesday", "Friday"],
  "startTime": "09:00",
  "endTime": "10:00"
}
```

#### Get Coach Schedule
```
GET /api/v1/coach-manager/coaches/:coachId/schedule
```

## Setup Instructions

### 1. Create Coach Manager Account

Run the seed script to create a coach manager account:

```bash
node src/seed/createCoachManager.js
```

Or manually create one through the Super Admin interface.

### 2. Environment Variables

Add these optional environment variables to your `.env` file:

```env
COACHMANAGER_PHONE=9876543210
COACHMANAGER_EMAIL=coachmanager@fitnessapp.com
COACHMANAGER_PASSWORD=coachmanager123
```

### 3. Login as Coach Manager

Use the coach-seller login endpoint:

```bash
curl -X POST http://localhost:3000/api/v1/coach-seller/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "password": "coachmanager123"
  }'
```

## Role Hierarchy

```
Super Admin ← Complete Control (Owner)
    ↓
Coach Manager ← Coach Management
    ↓
Coach
    ↓
User
```

## Super Admin Powers

The Super Admin has **COMPLETE CONTROL** over the entire system and can:

### 🏋️ Coach Management (Same as Coach Manager + More)
- ✅ Create, read, update, delete coaches
- ✅ **Force delete coaches** (even with active subscriptions)
- ✅ View all students across all coaches
- ✅ Access financial data and analytics
- ✅ Manage coach schedules
- ✅ View coach performance metrics

### 👥 User Management
- ✅ Create, read, update, delete **ALL** users (admin, coach, seller, coachmanager, user)
- ✅ View all user data and statistics
- ✅ Manage user roles and permissions

### 💰 Financial Management
- ✅ Access **ALL** financial data
- ✅ View system-wide revenue and analytics
- ✅ Monitor all transactions and orders
- ✅ Generate comprehensive reports
- ✅ **Seller Financial Oversight** - Complete seller revenue tracking
- ✅ **Product Sales Analytics** - Detailed product performance data
- ✅ **Revenue Comparison** - Coaches vs Sellers revenue analysis

### 🏢 System Management
- ✅ **System overview** - Complete dashboard with all metrics
- ✅ **Product management** - Create, update, delete products
- ✅ **Order management** - View and manage all orders
- ✅ **Category management** - Manage product categories
- ✅ **Analytics and metrics** - Access all system analytics

### 🔧 Administrative Control
- ✅ **Complete database access**
- ✅ **Force operations** (bypass safety checks)
- ✅ **System configuration**
- ✅ **User role management**
- ✅ **Security and access control**

## Permissions

### Super Admin Can (Complete Control):
- ✅ **Everything** - Complete system access
- ✅ **Force operations** - Bypass safety checks
- ✅ **User management** - Create/delete any user type
- ✅ **System configuration** - Full administrative control
- ✅ **Financial oversight** - All revenue and analytics
- ✅ **Coach management** - Enhanced with force delete
- ✅ **Seller management** - Complete seller financial oversight
- ✅ **Product management** - Full e-commerce control
- ✅ **Database access** - Complete data access

### Coach Manager Can:
- ✅ Create, read, update, delete coaches (with safety checks)
- ✅ View all students across all coaches
- ✅ Access financial data and analytics
- ✅ Manage coach schedules
- ✅ View coach performance metrics

### Coach Manager Cannot:
- ❌ Access Super Admin features
- ❌ Manage other admin roles
- ❌ Access product management
- ❌ Manage user accounts directly
- ❌ Force delete coaches with active subscriptions

## Data Models

### Coach Manager User
```javascript
{
  phone: String,
  role: 'coachmanager',
  password: String,
  additionalInfo: ObjectId
}
```

### Financial Data Structure
```javascript
{
  summary: {
    totalCoaches: Number,
    totalActiveSubscriptions: Number,
    totalEstimatedRevenue: Number
  },
  coachData: [{
    coachId: ObjectId,
    coachName: String,
    activeSubscriptions: Number,
    totalSessions: Number,
    estimatedRevenue: Number
  }]
}
```

## Security

- All endpoints require authentication
- Coach Manager role verification on all routes
- Input validation for all data
- Password hashing for coach accounts
- Protection against unauthorized access

## Error Handling

The API includes comprehensive error handling:
- Validation errors with detailed messages
- Authorization errors for unauthorized access
- Not found errors for missing resources
- Server errors with appropriate status codes

## Testing

Test the Coach Manager functionality:

1. **Create a coach manager account**
2. **Login and get access token**
3. **Create a test coach**
4. **View financial overview**
5. **Manage coach schedule**

## Future Enhancements

Potential future features:
- Coach performance analytics
- Automated reporting
- Student progress tracking
- Payment integration
- Advanced scheduling features
- Coach rating and review system
