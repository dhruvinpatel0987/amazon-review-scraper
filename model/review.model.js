const { default: mongoose } = require("mongoose");

const reviewSchema = new mongoose.Schema({
    platform: { type: String, required: true },
    feedback_type: { type: String, required: true },
    date: { type: Date, default: new Date() },
    customer_name: { type: String, required: true },
    stars: { type: Number, required: true },
    normalized_score: { type: Number, required: true },
    average_rating: { type: String },
    title: { type: String },
    content: { type: String },
    review_url: { type: String },
    source_url: { type: String },
    item_id:{ type: mongoose.Schema.Types.ObjectId, ref: 'items' },
    request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'crawl_requests' },
    target_url:{type:String},
    deletedAt: { type: Date, default: null }
}, { timestamps: true })

module.exports = mongoose.model('reviews', reviewSchema);