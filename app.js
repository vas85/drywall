'use strict';

//dependencies
var config = require('./config'),
    express = require('express'),
    mongoStore = require('connect-mongo')(express),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    passport = require('passport'),
    mongoose = require('mongoose'),
    fs = require('fs'),
    helmet = require('helmet');

//create httpApp to redirect to https
var httpApp = express();
httpApp.set('port', config.port);
httpApp.get("*", function (req, res, next) {
    res.redirect("https://" + req.headers.host + req.path);
});

http.createServer(httpApp).listen(httpApp.get('port'), function() {
    console.log('Express HTTP server listening on port ' + httpApp.get('port'));
});

//create express app
var app = express();

var privateKey  = fs.readFileSync('sslcert/server.key', 'utf8');
var certificate = fs.readFileSync('sslcert/server.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};

//keep reference to config
app.config = config;

//setup the web server
app.server = https.createServer(credentials, app);

//setup mongoose
app.db = mongoose.createConnection(config.mongodb.uri);
app.db.on('error', console.error.bind(console, 'mongoose connection error: '));
app.db.once('open', function () {
  //and... we have a data store
});

//config data models
require('./models')(app, mongoose);

//setup the session store
app.sessionStore = new mongoStore({ url: config.mongodb.uri });

//config express in all environments
app.configure(function(){
  //settings
  app.disable('x-powered-by');
  app.set('sport', config.sport);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('strict routing', true);
  app.set('project-name', config.projectName);
  app.set('company-name', config.companyName);
  app.set('system-email', config.systemEmail);
  app.set('crypto-key', config.cryptoKey);
  app.set('require-account-verification', config.requireAccountVerification);

  //smtp settings
  app.set('smtp-from-name', config.smtp.from.name);
  app.set('smtp-from-address', config.smtp.from.address);
  app.set('smtp-credentials', config.smtp.credentials);

  //twitter settings
  app.set('twitter-oauth-key', config.oauth.twitter.key);
  app.set('twitter-oauth-secret', config.oauth.twitter.secret);

  //github settings
  app.set('github-oauth-key', config.oauth.github.key);
  app.set('github-oauth-secret', config.oauth.github.secret);

  //facebook settings
  app.set('facebook-oauth-key', config.oauth.facebook.key);
  app.set('facebook-oauth-secret', config.oauth.facebook.secret);

  //google settings
  app.set('google-oauth-key', config.oauth.google.key);
  app.set('google-oauth-secret', config.oauth.google.secret);

  //middleware
  app.use(express.logger('dev'));
  app.use(express.compress());
  app.use(express.favicon(__dirname + '/public/favicon.ico'));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded());
  app.use(express.json());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: config.cryptoKey,
    store: app.sessionStore
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  helmet.defaults(app);

  //response locals
  app.use(function(req, res, next) {
    res.locals.user = {};
    res.locals.user.defaultReturnUrl = req.user && req.user.defaultReturnUrl();
    res.locals.user.username = req.user && req.user.username;
    next();
  });

  //mount the routes
  app.use(app.router);

  //error handler
  app.use(require('./views/http/index').http500);

  //global locals
  app.locals.projectName = app.get('project-name');
  app.locals.copyrightYear = new Date().getFullYear();
  app.locals.copyrightName = app.get('company-name');
  app.locals.cacheBreaker = 'br34k-01';
});

//config express in dev environment
app.configure('development', function(){
  app.use(express.errorHandler());
});

//setup passport
require('./passport')(app, passport);

//route requests
require('./routes')(app, passport);

//setup utilities
app.utility = {};
app.utility.sendmail = require('drywall-sendmail');
app.utility.slugify = require('drywall-slugify');
app.utility.workflow = require('drywall-workflow');

//listen up
app.server.listen(app.get('sport'), function(){
  //and... we're live
    console.log('Express HTTPS server listening on port ' + app.get('sport'));
});
