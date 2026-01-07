const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const pool = require('./database');
require('dotenv').config();

/* ================= JWT Strategy ================= */

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [payload.id]
      );

      if (result.rows.length > 0) {
        return done(null, result.rows[0]);
      }

      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;

        // Check if user exists with Google ID
        let result = await pool.query(
          'SELECT * FROM users WHERE google_id = $1',
          [googleId]
        );

        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        }

        // Check if email exists
        result = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (result.rows.length > 0) {
          // Link Google account
          await pool.query(
            'UPDATE users SET google_id = $1 WHERE email = $2',
            [googleId, email]
          );

          return done(null, result.rows[0]);
        }

        // Create new user
        result = await pool.query(
          'INSERT INTO users (email, google_id, country) VALUES ($1, $2, $3) RETURNING *',
          [email, googleId, 'IN']
        );

        return done(null, result.rows[0]);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

module.exports = passport;
