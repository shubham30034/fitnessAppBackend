const mongoose = require('mongoose');

const coachScheduleSchema = new mongoose.Schema({
  coach: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // Basic schedule fields
  days: [{ 
    type: String, 
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
  }],
  startTime: { 
    type: String, 
    required: true 
  }, // e.g., "18:00"
  endTime: { 
    type: String, 
    required: true 
  }, // e.g., "19:00"
  isActive: {
    type: Boolean,
    default: true
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  
  // Session details
  title: { 
    type: String, 
    default: 'Coaching Session'
  },
  description: { 
    type: String, 
    default: ''
  },
  sessionType: { 
    type: String, 
    enum: ['individual', 'group', 'workshop'], 
    default: 'individual' 
  },
  duration: { 
    type: Number, 
    default: 60 // in minutes
  },
  maxParticipants: { 
    type: Number, 
    default: 1 
  },
  startDate: { 
    type: Date 
  },
  endDate: { 
    type: Date 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  category: { 
    type: String, 
    enum: ['fitness', 'yoga', 'nutrition', 'cardio', 'strength', 'flexibility', 'other'], 
    default: 'fitness' 
  },
  difficulty: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced'], 
    default: 'beginner' 
  }
}, { timestamps: true });

// Indexes for better performance
coachScheduleSchema.index({ coach: 1 });
coachScheduleSchema.index({ isActive: 1 });
coachScheduleSchema.index({ days: 1 });

module.exports = mongoose.model('CoachSchedule', coachScheduleSchema);
