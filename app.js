//jshint esversion:6
require("dotenv").config();

const express = require("express");

const bodyParser = require("body-parser");

const ejs = require("ejs");

const mongoose = require("mongoose");

const session = require("express-session");

const passport = require("passport");

const passportLocalMongoose = require("passport-local-mongoose");

const GoogleStrategy = require("passport-google-oauth20").Strategy;

const FacebookStrategy = require("passport-facebook").Strategy;

const findOrCreate = require("mongoose-findorcreate");


// const md5 = require("md5");

// const bcrypt = require("bcrypt");
//
// const saltRounds = 10;

// const encrypt = require("mongoose-encryption"); commenting because we tried encrption now we are using next method of secruity

const app = express();

// console.log(process.env.API_KEY);
// console.log(md5("1999"));


app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());

app.use(passport.session());

// mongoose.connect("mongodb://localhost:27017/userDB", {
//   useNewUrlParser: true
// });
mongoose.connect(process.env.MONGODB_ID, {
  useNewUrlParser: true,
});







const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);

userSchema.plugin(findOrCreate);

// const secret = process.env.SECRET;

// userSchema.plugin(encrypt,{secret:secret, encryptedFields:["password"]}); for encryption

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

//serializing and deserializing for local authentication
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

// for any kind of authentication
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://secrets-appl.herokuapp.com/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));


passport.use(new FacebookStrategy({
    clientID: process.env.FB_APP_ID,
    clientSecret: process.env.FB_APP_SECRET,
    callbackURL: "https://secrets-appl.herokuapp.com/auth/facebook/secrets",
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      facebookId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));






app.get("/", function(req, res) {
  res.render("home");
});

// gets for google
app.get("/auth/google",
  passport.authenticate("google", {
    scope: ['profile']
  }));


app.get("/auth/google/secrets",
  passport.authenticate("google", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  });

// gets for facebook
app.get("/auth/facebook",
  passport.authenticate("facebook",{
    scope: ["email"]
  }));

app.get("/auth/facebook/secrets",
  passport.authenticate("facebook", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  });



app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/secrets", function(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.isAuthenticated()) {
    User.find({
      "secret": {
        $ne: null
      }
    }, function(err, foundUsers) {
      if (err) {
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("secrets", {
            userWithSecrets: foundUsers
          });
        }
      }
    });

  } else {
    res.redirect("/login");
  }

});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");

});

app.post("/register", function(req, res) {

  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
  // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
  //
  //   const newUser = new User({
  //     email: req.body.username,
  //     password: hash
  //   });
  //   newUser.save(function(err) {
  //     if (err) {
  //       console.log(err);
  //     } else {
  //       res.render("secrets");
  //     }
  //   });
  // });
});


app.post("/login", function(req, res) {
  const newUser = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(newUser, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local", {
        failureRedirect: "/login"
      })(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
  // const userName = req.body.username;
  // const password = req.body.password;
  //
  // User.findOne({
  //   email: userName
  // }, function(err, foundUser) {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     // console.log(foundUser);
  //     if (foundUser) {
  //       bcrypt.compare(password, foundUser.password, function(err, result) {
  //         if (result == true) {
  //           res.render("secrets");
  //         }
  //       });
  //     } else {
  //       res.send("user not found");
  //     }
  //   }
  // });
});

app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;
  console.log(req.user.id);
  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function() {
          res.redirect("/secrets");
        });

      }
    }

  });

});









app.listen(process.env.PORT || 3000, function() {
  console.log("Server has started Successfully.");
});
