'use strict';

// https://aaronparecki.com/oauth-2-simplified/
const oauth2orize = require('@poziworld/oauth2orize');
const passport = require('passport');
const login = require('connect-ensure-login');

const {
  Users,
  OAuthClients,
  OAuthTokens,
  OAuthCodes,
} = require('./common/models.common.js');

// Create OAuth 2.0 server
const server = oauth2orize.createServer();

// Register serialization and deserialization functions.
//
// When a client redirects a user to user authorization endpoint, an
// authorization transaction is initiated. To complete the transaction, the
// user must authenticate and approve the authorization request. Because this
// may involve multiple HTTP request/response exchanges, the transaction is
// stored in the session.
//
// An application must supply serialization functions, which determine how the
// client object is serialized into the session. Typically this will be a
// simple matter of serializing the client's ID, and deserializing by finding
// the client by ID from the database.

server.serializeClient((client, done) => done(null, client.id));

server.deserializeClient(async (id, done) => {
  try {
    const client = await OAuthClients.findById(id);
    done(null, client);
  } catch (error) {
    done(error);
  }
});

// Register supported grant types.
//
// OAuth 2.0 specifies a framework that allows users to grant client
// applications limited access to their protected resources. It does this
// through a process of the user granting access, and the client exchanging
// the grant for an access token.

// Grant authorization codes. The callback takes the `client` requesting
// authorization, the `redirectUri` (which is used as a verifier in the
// subsequent exchange), the authenticated `user` granting access, and
// their response, which contains approved scope, duration, etc. as parsed by
// the application. The application issues a code, which is bound to these
// values, and will be exchanged for an access token.

server.grant(
  oauth2orize.grant.code(async (client, redirectUri, user, ares, done) => {
    // const code = getUid()
    try {
      const code = await OAuthCodes.create({
        // code,
        clientId: client.id,
        redirectUri,
        userId: user.id,
        userEmail: user.email,
      });
      done(null, code._id);
    } catch (error) {
      done(error);
    }
  })
);

// Grant implicit authorization. The callback takes the `client` requesting
// authorization, the authenticated `user` granting access, and
// their response, which contains approved scope, duration, etc. as parsed by
// the application. The application issues a token, which is bound to these
// values.

server.grant(
  oauth2orize.grant.token(async (client, user, ares, done) => {
    // const token = getUid()
    console.log(`grant token`);
    console.log({ client, user });
    try {
      const token = OAuthTokens.create({
        userId: user.id,
        clientId: client.clientId,
      });
      done(null, token._id);
    } catch (error) {
      done(error);
    }
  })
);

// Exchange authorization codes for access tokens. The callback accepts the
// `client`, which is exchanging `code` and any `redirectUri` from the
// authorization request for verification. If these values are validated, the
// application issues an access token on behalf of the user who authorized the
// code. The issued access token response can include a refresh token and
// custom parameters by adding these to the `done()` call

server.exchange(
  oauth2orize.exchange.code(async (client, code, redirectUri, done) => {
    try {
      const authCode = await OAuthCodes.findById(code);
      if (!authCode) return done(null, false);
      if (client.id !== authCode.clientId) return done(null, false);
      if (redirectUri !== authCode.redirectUri) return done(null, false);
      const token = await OAuthTokens.create({
        userId: authCode.userId,
        clientId: authCode.clientId,
      });
      // Add custom params, e.g. the username
      const params = { email: authCode.userEmail };
      // Call `done(err, accessToken, [refreshToken], [params])` to issue an access token
      return done(null, token._id, null, params);
    } catch (error) {
      done(error);
    }
  })
);

// Exchange user id and password for access tokens. The callback accepts the
// `client`, which is exchanging the user's name and password from the
// authorization request for verification. If these values are validated, the
// application issues an access token on behalf of the user who authorized the code.

server.exchange(
  oauth2orize.exchange.password(
    async (client, userEmail, password, scope, done) => {
      try {
        // Validate the client
        const localClient = await OAuthClients.findById(client.clientId);
        if (!localClient) return done(null, false);
        if (localClient.clientSecret !== client.clientSecret) {
          return done(null, false);
        }
        // Validate the user
        const user = await Users.findOne({ email: userEmail });
        if (!user) return done(null, false);
        if (!user.comparePassword(password)) return done(null, false);
        // Everything validated, return the token
        const token = await OAuthTokens.create({
          userId: user._id,
          clientId: client.clientId,
        });
        // Call `done(err, accessToken, [refreshToken], [params])`, see oauth2orize.exchange.code
        return done(null, token._id);
      } catch (error) {
        done(null);
      }
    }
  )
);

// Exchange the client id and password/secret for an access token. The callback accepts the
// `client`, which is exchanging the client's id and password/secret from the
// authorization request for verification. If these values are validated, the
// application issues an access token on behalf of the client who authorized the code.

server.exchange(
  oauth2orize.exchange.clientCredentials(async (client, scope, done) => {
    try {
      // Validate the client
      const localClient = await OAuthClients.findByClientId(client.clientId);
      if (localClient.clientSecret !== client.clientSecret) {
        return done(null, false);
      }
      // Everything validated, return the token
      // Pass in a null for user id since there is no user with this grant type
      const token = await OAuthTokens.create({
        clientId: client.clientId,
      });
      // Call `done(err, accessToken, [refreshToken], [params])`, see oauth2orize.exchange.code
      return done(null, token._id);
    } catch (error) {
      done(error);
    }
  })
);

// User authorization endpoint.
//
// `authorization` middleware accepts a `validate` callback which is
// responsible for validating the client making the authorization request. In
// doing so, is recommended that the `redirectUri` be checked against a
// registered value, although security requirements may vary across
// implementations. Once validated, the `done` callback must be invoked with
// a `client` instance, as well as the `redirectUri` to which the user will be
// redirected after an authorization decision is obtained.
//
// This middleware simply initializes a new authorization transaction. It is
// the application's responsibility to authenticate the user and render a dialog
// to obtain their approval (displaying details about the client requesting
// authorization). We accomplish that here by routing through `ensureLoggedIn()`
// first, and rendering the `dialog` view.

module.exports.authorization = [
  login.ensureLoggedIn(),
  server.authorization(
    async (clientId, redirectUri, done) => {
      try {
        const client = await OAuthClients.findByClientId(clientId);
        // WARNING: For security purposes, it is highly advisable to check that
        //          redirectUri provided by the client matches one registered with
        //          the server. For simplicity, this example does not. You have
        //          been warned.
        return done(null, client, redirectUri);
      } catch (error) {
        done(error);
      }
    },
    async (client, user, done) => {
      // Check if grant request qualifies for immediate approval

      // Auto-approve
      if (client.isTrusted) return done(null, true);

      try {
        const token = await OAuthTokens.findByUserIdAndClientId(
          user.id,
          client.clientId
        );
        if (!token) return done(null, false);
        return done(null, true);
        // eslint-disable-next-line no-empty
      } catch (error) {}
    }
  ),
  (request, response) => {
    const {
      user,
      oauth2: { client },
      transactionID,
    } = request;
    const html = `
    <p>Hi ${user.name}!</p>
    <p><b>${client.name}</b> is requesting access to your account.</p>
    <p>Do you approve?</p>

    <form action="/dialog/authorize/decision" method="post">
      <input name="transaction_id" type="hidden" value="${transactionID}" />
      <div>
        <input type="submit" value="Allow" id="allow" />
        <input type="submit" value="Deny" name="cancel" id="deny" />
      </div>
    </form>
`;
    response.send(html);
  },
];

// User decision endpoint.
//
// `decision` middleware processes a user's decision to allow or deny access
// requested by a client application. Based on the grant type requested by the
// client, the above grant middleware configured above will be invoked to send
// a response.

module.exports.decision = [login.ensureLoggedIn(), server.decision()];

// Token endpoint.
//
// `token` middleware handles client requests to exchange authorization grants
// for access tokens. Based on the grant type being exchanged, the above
// exchange middleware will be invoked to handle the request. Clients must
// authenticate when making requests to this endpoint.

module.exports.token = [
  passport.authenticate(['basic', 'oauth2-client-password'], {
    session: false,
  }),
  server.token(),
  server.errorHandler(),
];
