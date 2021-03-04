'use strict';

// https://github.com/jaredhanson/oauth2orize
// https://github.com/awais786327/oauth2orize-examples
// https://github.com/solderjs/example-oauth2orize-consumer

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const BasicStrategy = require('passport-http').BasicStrategy;
const ClientPasswordStrategy = require('passport-oauth2-client-password')
  .Strategy;
const BearerStrategy = require('passport-http-bearer').Strategy;
const createError = require('http-errors');
const xmlParser = require('xml2json');

const config = require('../node.config.js');
const Roles = require('../user/role');

const {
  Users,
  OAuthClients,
  OAuthTokens,
  Groups,
} = require('../common/models.common.js');

const adminUser = Object.freeze({
  isAdmin: true,
  id: config.admin.id,
  email: config.emailOptions.from,
  name: 'admin',
});

module.exports = {
  adminUser,
  GUARD_USER: guard(Roles.REGULAR_USER),
  GUARD_USER_REDIRECT: guard(Roles.REGULAR_USER, true),
  GUARD_ADMIN: guard(Roles.SUPER_ADMIN),
  GUARD_GROUP_ADMIN: guard(Roles.GROUP_ADMIN),
  GUARD_ADMIN_OR_GROUP_ADMIN: guard([Roles.GROUP_ADMIN, Roles.SUPER_ADMIN]),
  GUARD_CAN_MANAGE_GROUP: guardCanManageGroup(),
  GUARD_GROUP_ADMIN_REDIRECT: guard(Roles.GROUP_ADMIN, true),
  GUARD_ADMIN_REDIRECT: guard(Roles.SUPER_ADMIN, true),
};

/// ///
// GUARD MIDDLEWARE
/// ///

// redirect parameter is used for pages outside Nuxt application
// • like the mosaico editor
function guard(role = Roles.REGULAR_USER, redirect = false) {
  const isAdminRoute = Array.isArray(role)
    ? role.includes(Roles.SUPER_ADMIN)
    : role === Roles.SUPER_ADMIN;
  const isGroupAdminRoute = Array.isArray(role)
    ? role.includes(Roles.GROUP_ADMIN)
    : role === Roles.GROUP_ADMIN;
  return function guardRoute(req, res, next) {
    const { user } = req;
    // non connected user shouldn't access those pages
    if (!user) {
      redirect
        ? res.redirect('/account/login')
        : next(new createError.Unauthorized());
      return;
    }

    // non group admin user shouldn't access those pages
    if (isGroupAdminRoute && !isAdminRoute && !user.isGroupAdmin) {
      redirect
        ? res.redirect('/account/login')
        : next(new createError.Unauthorized());
      return;
    }

    // non admin user shouldn't access those pages
    if (isAdminRoute && !isGroupAdminRoute && !user.isAdmin) {
      redirect
        ? res.redirect('/account/admin')
        : next(new createError.Unauthorized());
      return;
    }

    // Prevent the case where the route is admin and group admin then we check if user is one of them
    if (
      isGroupAdminRoute &&
      isAdminRoute &&
      !user.isGroupAdmin &&
      !user.isAdmin
    ) {
      redirect
        ? res.redirect('/account/login')
        : next(new createError.Unauthorized());
      return;
    }
    next();
  };
}

function guardCanManageGroup() {
  return function guardManageGroup(req, res, next) {
    const { user } = req;
    const { groupId } = req.params || req.body;
    if (user?._company?.id && groupId && groupId !== user?._company?.id) {
      next(new createError.Unauthorized());
    }
    next();
  };
}

/**
 * LocalStrategy
 *
 * This strategy is used to authenticate users based on a username and password.
 * Anytime a request is made to authorize an application, we must ensure that
 * a user is logged in before asking them to approve the request.
 */
passport.use(
  new LocalStrategy(async (username, password, done) => {
    // admin
    if (username === config.admin.username) {
      if (password === config.admin.password) {
        return done(null, { ...adminUser });
      }
      return done(null, false, { message: 'password.error.incorrect' });
    }
    // user
    try {
      const user = await Users.findOne({
        email: username,
        isDeactivated: { $ne: true },
        token: { $exists: false },
      });
      if (!user) return done(null, false, { message: 'password.error.nouser' });
      const isPasswordValid = user.comparePassword(password);
      if (!isPasswordValid) {
        return done(null, false, { message: 'password.error.incorrect' });
      }
      return done(null, user);
    } catch (err) {
      console.error(err);
      return done(null, false, { message: 'login.error.internal' });
    }
  })
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  if (id === config.admin.id) return done(null, { ...adminUser });
  try {
    const user = await Users.findOneForApi({
      _id: id,
      isDeactivated: { $ne: true },
      token: { $exists: false },
    });
    if (!user) return done(null, false);
    done(null, user.toJSON());
  } catch (err) {
    done(null, false, err);
  }
});

/**
 * BasicStrategy & ClientPasswordStrategy
 *
 * These strategies are used to authenticate registered OAuth clients. They are
 * employed to protect the `token` endpoint, which consumers use to obtain
 * access tokens. The OAuth 2.0 specification suggests that clients use the
 * HTTP Basic scheme to authenticate. Use of the client password strategy
 * allows clients to send the same credentials in the request body (as opposed
 * to the `Authorization` header). While this approach is not recommended by
 * the specification, in practice it is quite common.
 */
async function verifyClient(clientId, clientSecret, done) {
  try {
    const client = await OAuthClients.findByClientId(clientId);
    if (!client) return done(null, false);
    if (client.clientSecret !== clientSecret) return done(null, false);
    return done(null, client);
  } catch (error) {
    done(error);
  }
}

passport.use(new BasicStrategy(verifyClient));

passport.use(new ClientPasswordStrategy(verifyClient));

/**
 * BearerStrategy
 *
 * This strategy is used to authenticate either users or clients based on an access token
 * (aka a bearer token). If a user, they must have previously authorized a client
 * application, which is issued an access token to make requests on behalf of
 * the authorizing user.
 */
passport.use(
  new BearerStrategy(async (accessToken, done) => {
    try {
      const token = await OAuthTokens.findById(accessToken);
      if (!token) return done(null, false);
      // The request came from a client only since userId is null,
      // therefore the client is passed back instead of a user.
      const queryToRun = token.userId
        ? Users.findById(token.userId)
        : OAuthClients.findByClientId(token.clientId);
      const result = await queryToRun;
      if (!result) return done(null, false);
      // To keep this example simple, restricted scopes are not implemented,
      // and this is just for illustrative purposes.

      // FIXME: declare user somewhere and remove linter ignore comment
      // eslint-disable-next-line no-undef
      done(null, user, { scope: '*' });
    } catch (error) {
      done(error);
    }
  })
);

const MultiSamlStrategy = require('passport-saml/multiSamlStrategy');

passport.use(
  new MultiSamlStrategy(
    {
      passReqToCallback: true, // makes req available in callback
      getSamlOptions: async (request, done) => {
        let email = request.query.email;

        if (!email) {
          const buff = Buffer.from(request.body.SAMLResponse, 'base64');
          const jsonObject = xmlParser.toJson(buff.toString(), {
            object: true,
            sanitize: true,
            trim: true,
          });
          email =
            jsonObject['saml2p:Response']['saml2:Assertion']['saml2:Subject'][
              'saml2:NameID'
            ].$t;
        }

        const user = await Users.findOne({
          email: email,
          isDeactivated: { $ne: true },
          token: { $exists: false },
        });

        if (user) {
          const group = await Groups.findOne({
            _id: user.group,
          });
          if (group && group.entryPoint && group.issuer) {
            return done(null, {
              entryPoint: group.entryPoint,
              issuer: group.issuer,
            });
          }
          return done(new Error('Provider informations not found'), null);
        }
        return done(new Error('SAML provider not found'), null);
      },
    },
    async (req, profile, done) => {
      const user = await Users.findOne({
        email: profile.nameID,
        isDeactivated: { $ne: true },
        token: { $exists: false },
      });
      if (!user)
        return done(new Error('No user found'), false, {
          message: 'password.error.nouser',
        });
      done(null, user);
    }
  )
);
