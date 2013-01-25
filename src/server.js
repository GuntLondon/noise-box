/**
 * NoiseBox
 * server.js
 *
 * Server module.
 * Main application entry point.
 */

var express = require("express");
var expressPartials = require("express-partials");
var socketIO = require("socket.io");
var constants = require("./public/js/const");
var error = require("./app/middleware/error");
var AppModel = require("./app/model/AppModel");
var log = require("./app/lib/log");

// Detect environment:

var port = process.env.PORT || ( process.argv[2] || constants.DEFAULT_PORT );
var env = process.env.NODE_ENV || constants.DEV;

// Create and configure an Express app instance:

var app = express();

app.set("port",port);
app.set("views",__dirname+"/app/views");
app.set("view engine","ejs");

// Middleware:

app.use(express.favicon());
app.use(express.static(__dirname + "/public"));
app.use(expressPartials());
app.use(express.cookieParser("N01ZEBOXX"));
app.use(express.cookieSession({key:"sid"}));
app.use(express.bodyParser());
app.use(app.router);
app.use(error());

// Start the Express server:

var server = app.listen(port,function () {
    log.info("noise-box server started",{port:port,env:env});
});

// Start socket.io:

var io = socketIO.listen(server,{"log level":0});

// Expose app actors:

module.exports.constants = constants;
module.exports.app = app;
module.exports.io = io;
module.exports.env = env;
module.exports.port = port;
module.exports.model = new AppModel();

// Init controllers:

var HomeController = require("./app/controllers/home");
var HostController = require("./app/controllers/host");
var UserController = require("./app/controllers/user");

HomeController();
HostController.init();
UserController.init();
