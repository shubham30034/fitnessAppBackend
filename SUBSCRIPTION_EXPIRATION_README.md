# Subscription Expiration Management

## Overview

This document describes the comprehensive subscription expiration system implemented to ensure that student subscriptions to coaches are properly managed and automatically expire after their designated period (typically 1 month).

## Problem Solved

**Previous Issue**: Subscriptions had correct `endDate` values but remained `isActive: true` in the database even after expiration, leading to:
- Expired subscriptions appearing in active subscription queries
- Incorrect financial calculations
- Session generation for expired subscriptions
- Data inconsistency

**Solution**: Implemented automatic subscription expiration with proper cleanup and validation.

## Components

### 1. Database Schema Updates

**File**: `src/Model/paidSessionModel/userSubscription.js`

**New Fields Added**:
```javascript
// Track when subscription was expired
expiredAt: {
  type: Date,
  sparse: true
},

// Reason for expiration
expirationReason: {
  type: String,
  enum: ['automatic_expiration', 'manual_cancellation', 'payment_failed', 'admin_action'],
  sparse: true
}
```

**New Indexes**:
```javascript
userSubscriptionSchema.index({ isActive: 1, endDate: 1 }); // For expiration queries
userSubscriptionSchema.index({ endDate: 1 }); // For finding expired subscriptions
```

### 2. Automatic Expiration Cron Job

**File**: `src/Controller/CoachingSession/coach.js`

**Schedule**: Daily at 6:00 AM (`"0 6 * * *"`)

**Process**:
1. **Subscription Cleanup**: Finds and deactivates expired subscriptions
2. **Session Cleanup**: Removes sessions older than 60 days
3. **Session Generation**: Creates Zoom sessions for next 3 days (only for active subscriptions)

**Key Features**:
- Logs detailed information about expired subscriptions
- Sets `expiredAt` timestamp and `expirationReason`
- Only processes truly active subscriptions for session generation

### 3. Manual Cleanup Endpoints

**Endpoints**:
- `POST /admin/subscription-cleanup` - Manual cleanup trigger
- `GET /admin/subscription-stats` - Get expiration statistics

**Access**: Super Admin only

**Features**:
- Immediate cleanup of expired subscriptions
- Detailed statistics and reporting
- Testing and debugging capabilities

### 4. Query Updates

**Updated Queries** to always check both `isActive: true` AND `endDate: { $gte: new Date() }`:

- `getMyClients()` - Coach's active clients
- `getUserSubscriptions()` - User's active subscriptions
- `cancelSubscription()` - Active subscription cancellation
- `getFinancialOverview()` - Coach financial data

## API Endpoints

### Manual Subscription Cleanup
```http
POST /admin/subscription-cleanup
Authorization: Bearer <superadmin_token>
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully deactivated 5 expired subscriptions",
  "expiredCount": 5,
  "deactivatedCount": 5,
  "expiredSubscriptions": [
    {
      "subscriptionId": "...",
      "client": "...",
      "coach": "...",
      "endDate": "2024-01-01T00:00:00.000Z",
      "monthlyFee": 1000,
      "platform": "web"
    }
  ]
}
```

### Subscription Statistics
```http
GET /admin/subscription-stats
Authorization: Bearer <superadmin_token>
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalSubscriptions": 150,
    "activeSubscriptions": 120,
    "expiredButStillActive": 0,
    "properlyExpired": 30,
    "expiringInNext7Days": 5,
    "lastChecked": "2024-01-15T10:30:00.000Z"
  }
}
```

## Testing

### Test Script
**File**: `test_subscription_expiration.js`

**Run Tests**:
```bash
cd FitnessAppBackend
node test_subscription_expiration.js
```

**Test Coverage**:
- ✅ Subscription creation with correct end dates
- ✅ Expired subscription detection
- ✅ Manual cleanup functionality
- ✅ Query filtering after cleanup
- ✅ Data consistency validation

### Manual Testing

1. **Create Test Subscription**:
   ```javascript
   const subscription = await UserSubscription.create({
     client: userId,
     coach: coachId,
     startDate: new Date(),
     endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
     isActive: true,
     // ... other fields
   });
   ```

2. **Run Manual Cleanup**:
   ```bash
   curl -X POST http://localhost:3000/admin/subscription-cleanup \
     -H "Authorization: Bearer <superadmin_token>"
   ```

3. **Check Statistics**:
   ```bash
   curl -X GET http://localhost:3000/admin/subscription-stats \
     -H "Authorization: Bearer <superadmin_token>"
   ```

## Monitoring

### Logs to Monitor

**Cron Job Logs**:
```
⏰ Cron job started: Subscription expiration and Zoom session generation...
🔄 Checking for expired subscriptions...
📅 Found 3 expired subscriptions to deactivate
✅ Deactivated 3 expired subscriptions
   - Subscription 507f1f77bcf86cd799439011: Client 507f1f77bcf86cd799439012, Coach 507f1f77bcf86cd799439013, Expired: 2024-01-01
✅ Subscription expiration and Zoom session cron job completed.
```

**Manual Cleanup Logs**:
```
🧹 Manual subscription cleanup triggered...
📅 Found 2 expired subscriptions to deactivate
✅ Deactivated 2 expired subscriptions
```

### Key Metrics

- **expiredButStillActive**: Should always be 0 after proper cleanup
- **properlyExpired**: Should increase as subscriptions expire
- **expiringInNext7Days**: For proactive renewal campaigns

## Configuration

### Environment Variables
```bash
# MongoDB connection
MONGODB_URI=mongodb://localhost:27017/fitnessapp

# Cron job schedule (default: "0 6 * * *" - daily at 6 AM)
CRON_SCHEDULE="0 6 * * *"
```

### Cron Job Schedule
- **Default**: `"0 6 * * *"` (Daily at 6:00 AM)
- **Customizable**: Change the schedule in `coach.js` line 374

## Troubleshooting

### Common Issues

1. **Cron Job Not Running**:
   - Check server logs for cron job startup
   - Verify cron job is not commented out
   - Check server timezone settings

2. **Subscriptions Not Expiring**:
   - Verify `endDate` is set correctly during creation
   - Check if manual cleanup works
   - Review cron job logs

3. **Performance Issues**:
   - Ensure database indexes are created
   - Monitor query performance
   - Consider batch processing for large datasets

### Debug Commands

```javascript
// Check expired subscriptions
const expired = await UserSubscription.find({
  isActive: true,
  endDate: { $lt: new Date() }
});

// Check subscription statistics
const stats = await UserSubscription.aggregate([
  {
    $group: {
      _id: null,
      total: { $sum: 1 },
      active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
      expired: { $sum: { $cond: [{ $and: [{ $eq: ["$isActive", true] }, { $lt: ["$endDate", new Date()] }] }, 1, 0] } }
    }
  }
]);
```

## Security Considerations

- Manual cleanup endpoints require Super Admin authentication
- All subscription modifications are logged
- Expiration reasons are tracked for audit trails
- No sensitive data is exposed in logs

## Performance Impact

- **Minimal**: Cron job runs once daily
- **Indexed Queries**: All expiration queries use proper indexes
- **Batch Operations**: Uses `updateMany()` for efficient bulk updates
- **Selective Processing**: Only processes necessary subscriptions

## Future Enhancements

1. **Email Notifications**: Notify users before subscription expires
2. **Grace Period**: Allow short grace period after expiration
3. **Auto-Renewal**: Implement automatic subscription renewal
4. **Analytics Dashboard**: Real-time subscription expiration monitoring
5. **Webhook Support**: Notify external systems of subscription changes

## Conclusion

The subscription expiration system ensures data consistency and proper business logic enforcement. With automatic daily cleanup, manual testing capabilities, and comprehensive monitoring, the system provides reliable subscription management for the fitness coaching platform.

**Key Benefits**:
- ✅ Automatic expiration handling
- ✅ Data consistency
- ✅ Proper financial calculations
- ✅ Clean session generation
- ✅ Comprehensive testing
- ✅ Monitoring and debugging tools
