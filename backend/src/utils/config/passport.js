import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../../models/user.model.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL}/api/auth/google/callback`
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `${profile.id}@google.com`;
            const name = profile.displayName || profile.name?.givenName || 'Google User';

            const { user, isNew } = await User.findOrCreateByProvider(email, name, 'google', profile.id);
            user.isNewRecord = isNew; // use isNewRecord to avoid conflicts
            return done(null, user);
        } catch (err) {
            console.error('Google Auth Error:', err);
            return done(err, null);
        }
    }));
} else {
    console.warn('[passport] Google OAuth disabled: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL}/api/auth/github/callback`,
        scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : `${profile.id}@github.com`;
            const name = profile.displayName || profile.username || 'GitHub User';

            const { user, isNew } = await User.findOrCreateByProvider(email, name, 'github', profile.id);
            user.isNewRecord = isNew;
            return done(null, user);
        } catch (err) {
            console.error('GitHub Auth Error:', err);
            return done(err, null);
        }
    }));
} else {
    console.warn('[passport] GitHub OAuth disabled: missing GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET');
}

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

