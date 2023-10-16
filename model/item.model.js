const { default: mongoose } = require("mongoose");

const itemSchema = new mongoose.Schema({
    title: { type: String, require: true },
    description: { type: [String] },
    brand: { type: String },
    asin: { type: String },
    price: { type: Number },
    currency: { type: String },
    color: { type: String },
    bestSellersRank: { type: Number },
    category: { type: String },
    subCategory: { type: String },
    platform: { type: String, required: true },
    average_rating: { type: Number, },
    number_of_reviews: { type: Number, },
    date: { type: Date, default: new Date() },
    source_url: { type: String },
    target_url: { type: String },
    request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'crawl_requests' },
    deletedAt: { type: Date, default: null }
}, { timestamps: true })

module.exports = mongoose.model('items', itemSchema);