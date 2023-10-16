const { default: mongoose } = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { requestEnum } = require("../common/constant");

const crawlRequestSchema = new mongoose.Schema({
    request_id: { type: String, default: uuidv4() },
    source_url: { type: String, require: true },
    timestamp: { type: Date, require: true },
    status: {
        type: String,
        enum: [requestEnum.REQUESTED, requestEnum.IN_PROGRESS, requestEnum.COMPLETED, requestEnum.FAILED],
        default: requestEnum.REQUESTED
    },

}, { timestamps: true })

module.exports = mongoose.model('crawl_request', crawlRequestSchema);