const express = require("express");
const path = require('path');
require("dotenv").config();
require('./config/database');
const requestRouter = require('./router/request.routes');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }))

app.use(express.static('public'))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.get("/", async (req, res) => {
  res.send("Server working 🔥");
});
app.use('/crawl-request', requestRouter)
const port = process.env.PORT || 5000;

app.listen(port, () => `Server running on port port 🔥`);