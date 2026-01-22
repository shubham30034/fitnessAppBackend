// models/Category.js
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: [
        "supplement",
        "clothes",
        "accessories",
        "equipment",
        "nutrition",
        "wellness",
        "technology",
        "books",
        "apparel",
        "footwear",
      ],
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: { type: String, trim: true, maxlength: 500 },
    image: { type: String, trim: true },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

// Unique + fast search
categorySchema.index({ name: 1 }, { unique: true });
categorySchema.index({ isActive: 1, sortOrder: 1 });

// slug generation
categorySchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }
  next();
});

module.exports = mongoose.model("Category", categorySchema);
