import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../../models/user.model.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `${profile.id}@google.com`;
        const name = profile.displayName || profile.name?.givenName || 'Google User';

        const user = await User.findOrCreateByProvider(email, name, 'google', profile.id);
        return done(null, user);
    } catch (err) {
        console.error('Google Auth Error:', err);
        return done(err, null);
    }
}));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: '/api/auth/github/callback',
    scope: ['user:email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `${profile.id}@github.com`;
        const name = profile.displayName || profile.username || 'GitHub User';

        const user = await User.findOrCreateByProvider(email, name, 'github', profile.id);
        return done(null, user);
    } catch (err) {
        console.error('GitHub Auth Error:', err);
        return done(err, null);
    }
}));

// We use JWTs, but Passport still expects serialize/deserialize for session management
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

export default passport;

