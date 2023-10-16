const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");
const { auth, puppeteerConfig } = require("../config/puppeteer");
const { platform, requestEnum } = require("../common/constant");
const reviewModel = require("../model/review.model");
const itemModel = require("../model/item.model");
const requestModel = require("../model/request.model");
const { Parser } = require('json2csv');
const path = require("path");

module.exports = class Amazon {
  constructor(url, requestId, id) {
    this.url = url;
    this.requestId = requestId;
    this.id = id;
  }
  async get(url, page, retries = 3) {
    let badText = [
      "We have detected some odd traffic",
      "Please verify you're a human to continue",
      "Please Wait... | Cloudflare",
      "The site owner may have set restrictions that prevent you from accessing the site",
    ];

    try {
      console.log('url :>> ', url);
      let html = await page
        .evaluate(async (url) => {
          async function fetchWithTimeout(resource, options = {}) {
            const { timeout = 30000 } = options;

            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(resource, {
              ...options,
              "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9",
                "cache-control": "max-age=0",
                "device-memory": "8",
                "downlink": "2.45",
                "dpr": "1",
                "ect": "4g",
                "rtt": "50",
                "sec-ch-device-memory": "8",
                "sec-ch-dpr": "1",
                "sec-ch-ua": "\"Google Chrome\";v=\"117\", \"Not;A=Brand\";v=\"8\", \"Chromium\";v=\"117\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-ch-ua-platform-version": "\"10.0.0\"",
                "sec-ch-viewport-width": "1920",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "viewport-width": "1920"
              },
              "referrerPolicy": "strict-origin-when-cross-origin",
              "body": null,
              "method": "GET",
              "mode": "cors",
              "credentials": "include",
              signal: controller.signal,
            });
            clearTimeout(id);
            return response;
          }

          let r = await fetchWithTimeout(url).catch((e) => {
            debugger;
          });
          return r?.text();
        }, url)
        .catch((e) => {
          console.log("e :>> ", e);
          // debugger
        });
      if (!html && retries > 0) {
        return await this.get(url, page, retries - 1);
      }

      if (!html) {
        debugger;
      }

      if (badText.find((text) => html?.includes(text))) {
        if (retries > 0) {
          return await this.get(url, page, retries - 1);
        } else {
          throw new Error("too many!");
        }
      }
      return html || "";
    } catch (error) {
      throw "Get Err:" + error;
    }
  }

  async doReview($, el, source_url, item_id) {
    try {
      let match = $(el)
        .text()
        .match(/(\d(\.\d)?) out of 5/);
      let average_rating = $('[data-hook="rating-out-of-text"]')
        .text()
        .match(/(.*?) /)[1];
      let item = {
        platform: platform.amazon,
        feedback_type: "service",
        reviewid: $(el)
          .find('[id*="customer_review-"]')
          .attr("id")
          ?.replace(/.*-/, ""),
        date: new Date(
          Date.parse($(el).find('[data-hook="review-date"]').text())
        ),
        customer_name: $(el).find(".a-profile-name").text().trim().slice(0, 255),
        stars: parseFloat(match ? match[1] : "0"),
        normalized_score: parseFloat(match ? match[1] : 0) * 2,
        average_rating,
        title: $(el)
          .find('[data-hook="review-title"]')
          .text()
          .slice(0, 255)
          .replace(match[0] + ' stars', '')
          .replaceAll('\n', '')
          .trim(),
        content: $(el)
          .find('[data-hook="review-body"]')
          .text()
          .replace("Read more", "")
          .trim(),
        review_url:
          "https://www.amazon.com" +
          $(el).find("[data-hook='review-title']").attr("href"),
        source_url,
        item_id,
        target_url: this.url,
        request_id: this.id
      };
      return item;
    } catch (error) {
      throw "Do Review Err:" + error;
    }
  }

  async doReviewUrl($, source_url, page, item_id) {
    try {
      let href = $('[data-hook="see-all-reviews-link-foot"]').attr("href");
      const entries = [];

      if (href) {
        let reviewsUrl = new URL(href, source_url).href + "&sortBy=recent";
        let html = await this.get(reviewsUrl, page);
        $ = cheerio.load(html);

        for (let el of $('[data-hook="review"]').get()) {
          const data = await this.doReview($, el, reviewsUrl, item_id);
          entries.push(data);
        }
        // keep going
        while (
          (href = $('a:contains("Next page"):not(:disabled)').attr("href"))
        ) {
          let nextUrl = new URL(href, "https://www.amazon.com/").href;
          html = await this.get(nextUrl, page);
          $ = cheerio.load(html);
          for (let el of $('[data-hook="review"]').get()) {
            const data = await this.doReview($, el, nextUrl, item_id);
            entries.push(data);
          }
        }
      }
      console.log('entries.length :>> ', entries.length);
      if (entries.length) {
        try {
          await reviewModel.insertMany(entries);
        } catch (error) {
          console.log("error", error);
          throw "Insert Rows Err:" + error
        }
      }
    } catch (error) {
      throw "Do ReviewURL Err:" + error
    }
  }

  async doProductUrls(row, page) {
    try {
      let error;
      let html = await this.get(row.url, page).catch((e) => {
        error = e;
      });
      if (error) {
        console.log(error.message);
        return;
      }
      let $ = cheerio.load(html);
      let productListHtml = $('[data-component-type="s-search-results"]').children('div').html();
      $ = cheerio.load(productListHtml);

      let productListUrls = [];
      const divsWithAsin = $('div[data-asin]');
      divsWithAsin.each((_, element) => {
        // Get the data-asin value
        const dataAsin = $(element).attr('data-asin');

        // Check if data-asin exists
        if (dataAsin) {
          // Extract the URL from the 'a' tag within the selected div
          const url = $(element).find('a').attr('href');
          productListUrls.push(new URL(url, "https://www.amazon.com/").href);
        }
      });

      let productUrl = '';
      while ((productUrl = productListUrls.shift())) {
        let item = {
          platform: platform.amazon,
          average_rating: null,
          number_of_reviews: null,
          source_url: productUrl,
          request_id: this.id
        };
        const itemData = await itemModel.create(item)
        const reviewData = await this.doQueue({ url: productUrl }, page, itemData._id);

        itemData.average_rating = reviewData[0];
        itemData.number_of_reviews = reviewData[1];
        await itemData.save();
      }
    } catch (error) {
      throw "Do ProductURLs ERR:" + error;
    }
  }

  async doQueue(row, page, item_id) {
    try {

      let error;
      await page.goto(row.url, { waitUntil: "networkidle0", timeout: 0 });
      let html = await this.get(row.url, page).catch((e) => {
        error = e;
      });
      if (error) {
        console.log(error.message);
        return;
      }
      let $ = cheerio.load(html, row.url);

      const href = await this.doReviewUrl($, row.url, page, item_id);

      if (href) {
        row.url = new URL(href, "https://www.amazon.com/").href;
        await doQueue(row, page, item_id);
      }
      let total_reviews = null;
      let average = null;
      total_reviews = parseInt(
        $("[data-action='acrLink-click-metrics']").text().split(' ratings')[0].trim().replace(',', '')
      );
      average = parseFloat(
        $("[id='acrPopover']").text().trim().replace(" out of 5 stars", "")
      );

      const data = [average, total_reviews];
      return data;
    } catch (error) {
      console.log('do queue error :>> ', error);
      throw "DO Queue Err:" + error
    }
  }

  async crawlProductPage() {
    const browser = await puppeteer.launch(puppeteerConfig);
    try {
      const page = await browser.newPage();
      const urls = [];
      let row = { url: this.url };
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
      await page.goto(row.url, { waitUntil: "load", timeout: 0 });
      urls.push(row.url);
      let item = {
        platform: platform.amazon,
        average_rating: null,
        number_of_reviews: null,
        source_url: row?.url,
        request_id: this.id
      };
      const itemData = await itemModel.create(item)
      const reviewData = await this.doQueue(row, page, itemData._id);

      if (reviewData[1]) {
        try {
          itemData.average_rating = reviewData[0],
            itemData.number_of_reviews = reviewData[1],
            await itemData.save();
        } catch (error) {
          throw "Item Create Error:" + error;
        }
      }
      await requestModel.updateOne({ _id: this.id }, { $set: { status: requestEnum.COMPLETED } }, { new: true })
    } catch (error) {
      console.log("Product Page error ------------->:>> ", error);
      await requestModel.updateOne({ _id: this.id }, { $set: { status: requestEnum.FAILED } }, { new: true })
    } finally {
      await browser?.close();
    }
  }

  async crawlProductList() {
    const browser = await puppeteer.launch(puppeteerConfig);
    try {
      const page = await browser.newPage();
      let row = { url: this.url };
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36');
      await page.goto(row.url, { waitUntil: "load", timeout: 0 });
      await this.doProductUrls(row, page);
      await requestModel.updateOne({ _id: this.id }, { $set: { status: requestEnum.COMPLETED } }, { new: true })
    } catch (error) {
      console.log('Product List error ------------->:>> ', error);
      await requestModel.updateOne({ _id: this.id }, { $set: { status: requestEnum.FAILED } }, { new: true })
    } finally {
      await browser?.close();
    }
  }

  async startCrawl() {
    const isProductPage = this.url.match(/(?:[/dp/]|$)([A-Z0-9]{10})/g);
    await requestModel.updateOne({ _id: this.id }, { $set: { status: requestEnum.IN_PROGRESS } }, { new: true })
    if (isProductPage?.length) {
      this.crawlProductPage()
    } else {
      this.crawlProductList()
    }
  }

  async extractJsonToCsv() {
    try {
      const jsonFileContent = await reviewModel.find(
        { request_id: this.id },
        {
          "ID": '$_id',
          "Customer Name": '$customer_name',
          "Starts": "$starts",
          "Title": '$title',
          "Content": "$content",
          "Source URL": "$source_url",
          "Review URL": "$review_url",
          "Date": "$date",
          _id: 0
        }
      ).lean().exec();
      // Parse JSON data
      const jsonData = JSON.parse(JSON.stringify(jsonFileContent));

      const fields = Object.keys(jsonData[0])

      // Create a JSON to CSV parser
      const json2csvParser = new Parser({ fields });

      // Convert JSON data to CSV format
      const csv = json2csvParser.parse(jsonData);

      // Write the CSV data to a file
      const fileName = this.requestId + '.csv'
      const filePath = path.join(__dirname, '../public/download/' + fileName);
      fs.writeFileSync(filePath, csv);

      console.log('CSV file successfully written.');

      return { url: `${process.env.BASE_URL}/download/${fileName}` }

    } catch (err) {
      console.error('Error:', err);
    }
  }
};
