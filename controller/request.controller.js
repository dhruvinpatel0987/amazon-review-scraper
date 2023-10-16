
const requestModel = require('../model/request.model');
const Amazon = require('../util/amazon.service');

exports.createRequest = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.includes('https://www.amazon.com')) return res.status(400).json({ message: 'Please provide valid Amazon URL', data: [] });
    const requestData = await requestModel.create({ source_url: url, timestamp: new Date() });
    const amazon = new Amazon(requestData.source_url, requestData.request_id, requestData._id);
    amazon.startCrawl();
    return res.status(200).json({
      message: 'Your Request has been created',
      data: {
        requestId: requestData.request_id,
        timestamp: requestData.timestamp,
        source_url: requestData.source_url,
        status: requestData.status
      }
    })
  } catch (err) {
    console.log('err :>> ', err);
    return res.status(500).json({ message: 'Something went wrong, Please try again later' })
  }
}

exports.exportRequestData = async (req, res) => {
  try {
    const requestId = req.body.requestId;
    if (!requestId) return res.status(400).json({ message: 'Please provide valid Request ID', data: [] });
    const requestData = await requestModel.findOne({ request_id: requestId });
    const amazon = new Amazon(requestData.source_url, requestData.request_id, requestData._id);
    const { url } = await amazon.extractJsonToCsv();
    return res.status(200).json({ message: 'Your Request data has been exported', data: { requestId: requestData.request_id, url } })
  } catch (err) {
    console.log('err :>> ', err);
    return res.status(500).json({ message: 'Something went wrong, Please try again later' })
  }
}

exports.getRequests = async (req, res) => {
  try {
    const requestData = await requestModel.find({}, { request_id: 1, source_url: 1, status: 1, timestamp: 1 }).sort({ createdAt: -1 }).lean().exec();
    return res.render('../views/index.ejs', { data: requestData, baseUrl:process.env.BASE_URL });
  } catch (err) {
    console.log('err :>> ', err);
    return res.status(500).json({ message: 'Something went wrong, Please try again later' })
  }
}
exports.getRequestDetail = async (req, res) => {
  try {
    const requestId = req.params.requestId;
    if (!requestId) return res.status(400).json({ message: 'Please provide valid Request ID', data: [] });
    const requestData = await requestModel.aggregate([
      {
        '$match': {
          'request_id': requestId
        }
      }, {
        '$project': {
          'request_id': 1,
          'target_url': '$source_url',
          'timestamp': 1,
          'status': 1
        }
      }, {
        '$lookup': {
          'from': 'items',
          'let': {
            'id': '$_id'
          },
          'pipeline': [
            {
              '$match': {
                '$expr': {
                  '$eq': [
                    '$request_id', '$$id'
                  ]
                }
              }
            }, {
              '$project': {
                'average_rating': 1,
                'number_of_reviews': 1,
                'source_url': 1,
                'request_id': 1
              }
            }, {
              '$lookup': {
                'from': 'reviews',
                'let': {
                  'items_id': '$_id'
                },
                'pipeline': [
                  {
                    '$match': {
                      '$expr': {
                        '$eq': [
                          '$item_id', '$$items_id'
                        ]
                      }
                    }
                  }, {
                    '$project': {
                      'customer_name': 1,
                      'starts': 1,
                      'title': 1,
                      'content': 1,
                      'review_url': 1
                    }
                  }
                ],
                'as': 'reviews'
              }
            }
          ],
          'as': 'items'
        }
      }, {
        '$project': {
          'items._id': 0,
          'items.reviews._id': 0
        }
      }
    ]);
    return res.render('../views/detail.ejs', { data: requestData[0], baseUrl:process.env.BASE_URL });
  } catch (err) {
    console.log('err :>> ', err);
    return res.status(500).json({ message: 'Something went wrong, Please try again later' })
  }
}