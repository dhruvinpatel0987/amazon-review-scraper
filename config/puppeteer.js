module.exports = {
  puppeteerConfig: {
    headless: true,
    args: [
      "--disable-web-security",
      "--no-sandbox",
      "--disable-features=IsolateOrigins,site-per-process",
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list '
    ],
  },
  args: [],
  auth: {},
};
