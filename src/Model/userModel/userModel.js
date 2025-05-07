const userSchema = new mongoose.Schema({
    phone: {
      type: String,
      required: true,
      unique: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
    additionalInfo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserAdditionalInfo',
    },
    role:{
        type: String,
        enum: ['user', 'coach','superadmin','admin','doctor','seller'],
        default: 'user',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },{ timestamps: true});
  
  // Add TTL index to automatically remove expired OTPs
  userSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });


  module.exports = mongoose.model("User",profileSchema)