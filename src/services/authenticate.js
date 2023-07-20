const passport = require("passport");
const localStrategy = require("passport-local").Strategy;
const userModel = require("../models/userSchema");
const JWTStrategy = require("passport-jwt").Strategy;
const ExtractJWT = require("passport-jwt").ExtractJwt;

require("dotenv").config({ path: ".env" });

passport.use(
	"login",
	new localStrategy(
		{
			usernameField: "email",
			passwordField: "password",
		},
		(email, password, done) => {
			userModel
				.findOne({ email: email })
				.populate("shopId", [
					'name','email','location','phoneNumber','image','description','open',"ownerId"
				])
				.populate(
					"joinedclubs", 
					[
						"title", "imageurl"
					]
				)
				.then(
					(user) => {
						if (!user)
							return done(null, false, { message: "Invalid email address" });

						/*.................nested promise to verify  password....................... */
						user
							.isValidPassword(password)
							.then(
								(validate) => {
									if (validate) done(null, validate, user);
									else if (!validate)
										done(null, false, { message: "Invalid password" });
								},
								(err) => done(null, false, { message: "incorrect password" })
							)
							.catch((err) =>
								done(null, false, { message: "Incorrect password" })
							);
						/*......................end of nested promise..............................*/
					},
					(err) => done(null, false, { message: err.message })
				)
				.catch((err) => done(null, false, { message: err.message }));
		}
	)
);


passport.use(
  "jwt",
  new JWTStrategy(
    {
      secretOrKey: process.env.secret_key,
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    },
    async (token, done) => {
      try {
        return done(null, token, { message: "Success" });
      } catch (error) {
        done(error);
      }
    }
  )
);
