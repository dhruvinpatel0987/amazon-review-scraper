const express = require('express');
const { createRequest, exportRequestData, getRequests, getRequestDetail } = require('../controller/request.controller');
const router = express.Router();

router.post('/create', createRequest);
router.post('/export-data', exportRequestData);
router.get('/', getRequests);
router.get('/:requestId', getRequestDetail);

module.exports = router;