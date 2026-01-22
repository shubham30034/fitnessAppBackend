// models/Product.js
const mongoose = require("mongoose");

const variantOptionSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true }, // e.g. "Red", "XL"
    price: { type: Number, min: 0 }, // optional override
    quantity: { type: Number, min: 0, default: 0 },
    sku: { type: String, trim: true },
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true }, // e.g. "Color", "Size"
    options: { type: [variantOptionSchema], default: [] },
  },
  { _id: false }
);

const optimizedImageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true }, // ✅ stable image id
    optimized: {
      thumbnail: { type: String, required: true },
      small: { type: String, required: true },
      medium: { type: String, required: true },
      large: { type: String, required: true },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },

    brand: { type: String, trim: true, maxlength: 60 },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
      index: true,
    },

    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },

    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // inventory
    quantity: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },

    // shipping
    weight: { type: Number, min: 0 },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
    },

    productImages: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: "Maximum 10 images allowed.",
      },
    },

    productImagesOptimized: { type: [optimizedImageSchema], default: [] },

    variants: { type: [variantSchema], default: [] },

    // SEO
    metaTitle: { type: String, trim: true, maxlength: 60 },
    metaDescription: { type: String, trim: true, maxlength: 160 },
    keywords: { type: [String], default: [] },

    // analytics
    viewCount: { type: Number, default: 0, min: 0 },
    saleCount: { type: Number, default: 0, min: 0 },

    // rating
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingSum: { type: Number, default: 0, min: 0 }, // internal helper
    reviewCount: { type: Number, default: 0, min: 0 },

    // status
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

/* =========================
   INDEXES (IMPORTANT)
========================= */

productSchema.index({ sellerId: 1, isActive: 1, createdAt: -1 });
productSchema.index({ category: 1, isActive: 1, createdAt: -1 });
productSchema.index({ subcategory: 1, isActive: 1, createdAt: -1 });

productSchema.index({ price: 1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ viewCount: -1 });
productSchema.index({ saleCount: -1 });
productSchema.index({ isFeatured: 1, isActive: 1 });

// ✅ ONE text index only
productSchema.index({
  name: "text",
  description: "text",
  brand: "text",
});

/* =========================
   HOOKS & HELPERS
========================= */

// slug auto
productSchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }
  next();
});

// discount auto calc
productSchema.pre("save", function (next) {
  if (this.originalPrice && this.originalPrice > 0 && this.price >= 0) {
    const disc = ((this.originalPrice - this.price) / this.originalPrice) * 100;
    this.discountPercentage = Math.max(0, Math.min(100, Math.round(disc)));
  } else {
    this.discountPercentage = 0;
  }
  next();
});

// ✅ static method: generate unique slug
productSchema.statics.generateUniqueSlug = async function (name, excludeId = null) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  let slug = base;
  let i = 0;

  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };

    const exists = await this.findOne(query).select("_id").lean();
    if (!exists) break;

    i += 1;
    slug = `${base}-${i}`;
  }

  return slug;
};

module.exports = mongoose.model("Product", productSchema);
