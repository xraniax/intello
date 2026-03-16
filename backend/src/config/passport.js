import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/user.model.js';

const getCallbackURL = (provider) => {
    const apiBase = process.env.BACKEND_URL || 'http://localhost:5000';
    return `${apiBase}/api/auth/${provider}/callback`;
};

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'mock-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock-secret',
    callbackURL: getCallbackURL('google')
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const provider = 'google';
        const providerId = profile.id;

        const user = await User.findOrCreateByProvider(email, name, provider, providerId);
        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
}));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'mock-id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'mock-secret',
    callbackURL: getCallbackURL('github')
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // GitHub might not return email if it's private.
        const email = profile.emails?.[0]?.value || profile._json?.email || `${profile.username}@github.com`;
        const name = profile.displayName || profile.username;
        const provider = 'github';
        const providerId = profile.id;

        const user = await User.findOrCreateByProvider(email, name, provider, providerId);
        return done(null, user);
    } catch (err) {
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
