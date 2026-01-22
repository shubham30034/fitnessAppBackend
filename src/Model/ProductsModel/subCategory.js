// models/SubCategory.js
const mongoose = require("mongoose");

const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    description: { type: String, trim: true, maxlength: 500 },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

// ✅ Same subcategory name can exist in different categories, but not in same category
subCategorySchema.index(
  { categoryId: 1, name: 1 },
  { unique: true }
);

subCategorySchema.index({ categoryId: 1, isActive: 1, sortOrder: 1 });

subCategorySchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }
  next();
});

module.exports = mongoose.model("SubCategory", subCategorySchema);
